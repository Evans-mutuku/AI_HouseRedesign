// The generation pipeline, run out of band.
//
// One redesign is: survey the room (once, cached), design the board, render the
// "after", then check the render actually kept the room's windows and doors —
// and if it did not, say so precisely and try once more.
//
// The worker polls rather than being pushed to. Polling one indexed row every
// couple of seconds costs nothing next to the model calls, and it means a job
// enqueued by a process that has since restarted is still picked up.

import { query, withTransaction } from './db.js';
import { storage } from './storage.js';
import { storeImage, KIND } from './assets.js';
import { assertHeadroom, QuotaError } from './plans.js';
import {
  readRoom,
  designRoom,
  planFloor,
  buildImagePrompt,
  verifyRender,
  reinforceImagePrompt,
} from './design.js';
import { generateAfterImage, imagesEnabled } from './images.js';
import {
  validateSurvey,
  validateBoard,
  normalizeFloorPlan,
  normalizeFidelity,
  ValidationError,
} from './validate.js';
import { ClaudeError } from './claude.js';
import { tasteFor } from './taste.js';
import * as jobs from './jobs.js';

const POLL_MS = Number(process.env.WORKER_POLL_MS || 1500);

/** How many times we will re-render because the check found a missing window. */
const FIDELITY_RETRIES = Number(process.env.RENDER_FIDELITY_RETRIES ?? 1);

let running = false;
let timer = null;

/* ── The redesign pipeline ───────────────────────────────────────────────── */

async function loadRoom(roomId, userId) {
  const { rows } = await query(
    `SELECT r.*, a.storage_key, a.mime AS asset_mime, h.palette_json AS home_palette
       FROM rooms r
       LEFT JOIN assets a ON a.id = r.photo_asset_id
       LEFT JOIN homes  h ON h.id = r.home_id AND h.deleted_at IS NULL
      WHERE r.id = $1 AND r.user_id = $2 AND r.deleted_at IS NULL`,
    [roomId, userId],
  );
  return rows[0] || null;
}

async function loadParentBoard(parentId, userId) {
  if (!parentId) return null;
  const { rows } = await query(
    `SELECT d.result_json, d.revision_no
       FROM redesigns d
       JOIN rooms r ON r.id = d.room_id
      WHERE d.id = $1 AND r.user_id = $2 AND d.deleted_at IS NULL`,
    [parentId, userId],
  );
  return rows[0] || null;
}

async function nextRevisionNo(roomId) {
  const { rows } = await query(
    `SELECT COALESCE(MAX(revision_no), 0) + 1 AS next
       FROM redesigns WHERE room_id = $1 AND deleted_at IS NULL`,
    [roomId],
  );
  return rows[0]?.next || 1;
}

async function runRedesign(job) {
  const input = job.input_json || {};
  const userId = job.user_id;

  const room = await loadRoom(input.roomId, userId);
  if (!room) throw new ValidationError('That room is no longer available.');

  const { rows: userRows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userRows[0];
  if (!user) throw new ValidationError('Account not found.');

  // A render plus its thumbnail must still fit when we come to store it.
  await assertHeadroom(user, 0);

  const photo = await storage.read(room.storage_key);
  if (!photo) throw new ValidationError('The room photo is no longer stored.');
  const base64 = photo.toString('base64');
  const mediaType = room.asset_mime || room.mime || 'image/webp';

  /* 1 — Survey. Cached: a room's architecture does not change between
     revisions, so this runs once per uploaded photo. */
  let survey = room.architecture_json;
  if (!survey) {
    await jobs.report(job.id, { stage: 'Reading the room', progress: 8 });
    const { survey: raw } = await readRoom({ base64, mediaType });
    survey = validateSurvey(raw);
    await query('UPDATE rooms SET architecture_json = $2, room_type = COALESCE(room_type, $3) WHERE id = $1', [
      room.id,
      survey,
      survey.roomType,
    ]);
  }

  if (await jobs.isCancelled(job.id)) return null;

  /* 2 — Design. */
  await jobs.report(job.id, {
    stage: input.parentRedesignId ? 'Applying your changes' : 'Composing the direction',
    progress: 28,
  });

  const parent = await loadParentBoard(input.parentRedesignId, userId);
  const taste = await tasteFor(userId);

  const { board: rawBoard, model } = await designRoom({
    base64,
    mediaType,
    survey,
    intents: {
      style: input.style || '',
      budgetCents: input.budgetCents ?? null,
      currency: input.currency || user.currency || 'USD',
      note: input.note || '',
    },
    previous: parent?.result_json || null,
    instruction: input.instruction || '',
    homePalette: room.home_palette || null,
    taste,
  });

  const board = validateBoard(rawBoard, {
    budgetCents: input.budgetCents ?? null,
    currency: input.currency || user.currency || 'USD',
  });

  if (await jobs.isCancelled(job.id)) return null;

  /* 2b — Plan view. Best-effort: a board without a diagram is still a board. */
  await jobs.report(job.id, { stage: 'Drawing the plan view', progress: 42 });
  try {
    board.floorPlan = normalizeFloorPlan(
      await planFloor({ base64, mediaType, survey, board }),
    );
  } catch (err) {
    console.error('[floor-plan]', err.message);
    board.floorPlan = null;
  }

  if (await jobs.isCancelled(job.id)) return null;

  /* 3 — Render, then check it. */
  let renderBuffer = null;
  let renderMime = null;
  let fidelity = null;
  let imageError = null;

  if (!imagesEnabled()) {
    imageError = 'Image rendering is not configured (OPENAI_API_KEY unset).';
  } else {
    const region = input.region || null;
    const basePrompt = buildImagePrompt({ survey, board, region });

    let prompt = basePrompt;
    for (let attempt = 0; attempt <= FIDELITY_RETRIES; attempt += 1) {
      await jobs.report(job.id, {
        stage: attempt === 0 ? 'Rendering the room' : 'Restoring what the render dropped',
        progress: attempt === 0 ? 55 : 78,
      });

      try {
        const render = await generateAfterImage({
          imageBuffer: photo,
          mime: mediaType,
          prompt,
          region,
        });
        renderBuffer = render.buffer;
        renderMime = render.mime;
      } catch (err) {
        console.error('[render]', err.message);
        imageError = 'The after image could not be rendered this time.';
        break;
      }

      if (await jobs.isCancelled(job.id)) return null;

      // Ask whether the windows and doors actually survived.
      await jobs.report(job.id, { stage: 'Checking windows and doors', progress: attempt === 0 ? 70 : 88 });
      try {
        fidelity = normalizeFidelity(
          await verifyRender({
            before: { base64, mediaType },
            after: { base64: renderBuffer.toString('base64'), mediaType: renderMime },
            survey,
          }),
        );
      } catch (err) {
        // The check is advisory: never lose a good render because the checker
        // itself failed.
        console.error('[fidelity]', err.message);
        fidelity = null;
        break;
      }

      if (!fidelity || fidelity.ok) break;
      if (attempt === FIDELITY_RETRIES) break;
      prompt = reinforceImagePrompt(basePrompt, fidelity);
    }
  }

  if (await jobs.isCancelled(job.id)) return null;

  /* 4 — Persist. */
  await jobs.report(job.id, { stage: 'Setting the board', progress: 94 });

  const revisionNo = await nextRevisionNo(room.id);
  const written = [];

  try {
    const redesign = await withTransaction(async (client) => {
      let renderAssetId = null;
      if (renderBuffer) {
        const stored = await storeImage({
          userId,
          buffer: renderBuffer,
          kind: KIND.RENDER,
          client,
        });
        renderAssetId = stored.asset.id;
        written.push(stored.asset.storage_key, stored.thumb.storage_key);
      }

      const { rows } = await client.query(
        `INSERT INTO redesigns
           (room_id, style, budget, user_note, model, result_json, title,
            parent_id, revision_no, instruction, render_asset_id, mask_json,
            budget_cents, currency, fidelity_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          room.id,
          input.style || null,
          input.budgetCents != null ? String(input.budgetCents) : null,
          input.note || null,
          model,
          board,
          board.roomType || survey.roomType || 'Redesign',
          input.parentRedesignId || null,
          revisionNo,
          input.instruction || null,
          renderAssetId,
          input.region || null,
          input.budgetCents ?? null,
          input.currency || user.currency || 'USD',
          fidelity,
        ],
      );
      return rows[0];
    });

    return { redesign, roomId: room.id, imageError };
  } catch (err) {
    // The transaction rolled back, so the asset rows are gone; take their files
    // with them rather than leaving bytes nothing points at.
    await Promise.all(written.map((key) => storage.remove(key)));
    throw err;
  }
}

/* ── The loop ────────────────────────────────────────────────────────────── */

const HANDLERS = { redesign: runRedesign };

async function tick() {
  let job;
  try {
    job = await jobs.claimNext();
  } catch (err) {
    console.error('[worker] could not claim a job:', err.message);
    return;
  }
  if (!job) return;

  const handler = HANDLERS[job.kind];
  if (!handler) {
    await jobs.fail(job.id, `Unknown job kind "${job.kind}".`);
    return;
  }

  try {
    const result = await handler(job);
    if (!result) {
      return;
    }
    await jobs.succeed(job.id, {
      redesignId: result.redesign.id,
      roomId: result.roomId,
    });
    if (result.imageError) {
      await query('UPDATE jobs SET error = $2 WHERE id = $1', [job.id, result.imageError]);
    }
  } catch (err) {
    const retryable =
      err instanceof ClaudeError ||
      err?.name === 'ImageError' ||
      err?.code === 'ECONNRESET';
    const message =
      err instanceof QuotaError || err instanceof ValidationError || err instanceof ClaudeError
        ? err.message
        : 'Something went wrong generating this redesign.';
    if (!(err instanceof QuotaError) && !(err instanceof ValidationError)) {
      console.error('[worker]', job.kind, err);
    }
    await jobs.fail(job.id, message, { retryable });
  }
}

/** Start polling. Idempotent — calling it twice does not double up. */
export function startWorker() {
  if (timer) return;
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } finally {
      running = false;
    }
  };
  timer = setInterval(loop, POLL_MS);
  timer.unref?.(); 
  console.log(`[worker] polling every ${POLL_MS}ms`);
}

export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
