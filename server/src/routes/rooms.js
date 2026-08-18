// Rooms and their revision timelines.
//
// A room is the durable thing: one photo, one architectural survey, and a chain
// of redesigns hanging off it. Uploading creates the room and enqueues the
// first revision; asking for a change enqueues another against the same room,
// so the survey and the photo are reused and only the design work re-runs.
//
// Every query is scoped by `req.user.id`. Nothing accepts an account identifier
// from the client.

import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

import { query, withTransaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { storeImage, removeAsset, KIND } from '../assets.js';
import { assertHeadroom, QuotaError, storageStatus } from '../plans.js';
import { assetJoin, assetSelect, imageOf, roomCard, redesignSummary } from '../serialize.js';
import * as jobs from '../jobs.js';

const router = Router();

const MAX_BYTES = 12 * 1024 * 1024; // generous: we re-encode on the way in
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

class MulterTypeError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new MulterTypeError('Unsupported file type. Use JPG, PNG, WebP, or HEIC.'));
  },
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.REDESIGN_RATE_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Too many redesigns. Please wait a minute and try again.' },
});

router.use(requireAuth);

/* ── Reading the brief off a request ─────────────────────────────────────── */

function readIntents(body) {
  const style = String(body.style || '').trim().slice(0, 80);
  const note = String(body.note || '').trim().slice(0, 600);
  const instruction = String(body.instruction || '').trim().slice(0, 600);
  const currency = String(body.currency || 'USD').trim().toUpperCase().slice(0, 3);

  // Budget arrives as a plain number of major units ("2400"); we work in cents
  // everywhere below so there is no floating point in the money path.
  let budgetCents = null;
  if (body.budget !== undefined && body.budget !== null && String(body.budget).trim() !== '') {
    const amount = Number(String(body.budget).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(amount) && amount > 0) {
      budgetCents = Math.round(amount * 100);
    }
  }

  // A masked edit region, normalised 0–1.
  let region = null;
  if (body.region) {
    try {
      const raw = typeof body.region === 'string' ? JSON.parse(body.region) : body.region;
      const clamp = (v) => Math.min(1, Math.max(0, Number(v)));
      if (raw && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(Number(raw[k])))) {
        const candidate = {
          x: clamp(raw.x),
          y: clamp(raw.y),
          w: clamp(raw.w),
          h: clamp(raw.h),
        };
        // A sliver of a region produces mush; ignore anything degenerate.
        if (candidate.w > 0.02 && candidate.h > 0.02) region = candidate;
      }
    } catch {
      /* malformed region - treat as a whole-image edit */
    }
  }

  return { style, note, instruction, currency, budgetCents, region };
}

/* ── Create a room from a photo, and start its first redesign ────────────── */

router.post(
  '/rooms',
  generateLimiter,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof MulterTypeError) {
          return res.status(415).json({ error: err.message });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Image is too large. Max size is 12MB.' });
        }
        return res.status(400).json({ error: 'Upload failed. Try again.' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No image was uploaded.' });

      await assertHeadroom(req.user, file.size);

      const intents = readIntents(req.body);
      const name = String(req.body.name || '').trim().slice(0, 80);
      const homeId = String(req.body.homeId || '').trim() || null;

      if (homeId) {
        const owned = await query(
          'SELECT id FROM homes WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [homeId, req.user.id],
        );
        if (!owned.rows.length) {
          return res.status(404).json({ error: 'That home does not exist.' });
        }
      }

      // Compress, thumbnail, register, and create the room together. If the
      // transaction fails, storeImage has already cleaned up its own files.
      const room = await withTransaction(async (client) => {
        const stored = await storeImage({
          userId: req.user.id,
          buffer: file.buffer,
          kind: KIND.ORIGINAL,
          client,
        });

        const { rows } = await client.query(
          `INSERT INTO rooms (user_id, home_id, name, photo_asset_id, image_path, mime, width, height, bytes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            req.user.id,
            homeId,
            name || null,
            stored.asset.id,
            stored.asset.storage_key,
            stored.asset.mime,
            stored.asset.width,
            stored.asset.height,
            stored.bytes,
          ],
        );
        return { ...rows[0], _saved: stored.savedBytes, _original: stored.originalBytes };
      });

      const job = await jobs.enqueue({
        userId: req.user.id,
        kind: 'redesign',
        roomId: room.id,
        input: { roomId: room.id, ...intents },
      });

      return res.status(202).json({
        roomId: room.id,
        job: jobs.toJobResponse(job),
        upload: {
          originalBytes: room._original,
          storedBytes: Number(room.bytes),
          savedBytes: room._saved,
        },
        storage: await storageStatus(req.user),
      });
    } catch (err) {
      if (err instanceof QuotaError) {
        return res.status(err.status).json({ error: err.message, quota: err.quota });
      }
      console.error('[POST /rooms]', err);
      return res.status(500).json({ error: 'Could not start that redesign.' });
    }
  },
);

/* ── Ask for a revision of an existing room ──────────────────────────────── */

router.post('/rooms/:id/revisions', generateLimiter, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id FROM rooms WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found.' });

    await assertHeadroom(req.user, 0);

    const intents = readIntents(req.body);
    if (!intents.instruction && !intents.style && intents.budgetCents == null && !intents.region) {
      return res.status(400).json({
        error: 'Tell us what to change - an instruction, a different style, a budget, or an area.',
      });
    }

    // Revise from the caller's chosen revision, defaulting to the latest.
    let parentId = String(req.body.parentId || '').trim() || null;
    if (parentId) {
      const parent = await query(
        `SELECT d.id FROM redesigns d JOIN rooms r ON r.id = d.room_id
          WHERE d.id = $1 AND d.room_id = $2 AND r.user_id = $3 AND d.deleted_at IS NULL`,
        [parentId, req.params.id, req.user.id],
      );
      if (!parent.rows.length) {
        return res.status(404).json({ error: 'That revision does not exist.' });
      }
    } else {
      const latest = await query(
        `SELECT id FROM redesigns WHERE room_id = $1 AND deleted_at IS NULL
          ORDER BY revision_no DESC LIMIT 1`,
        [req.params.id],
      );
      parentId = latest.rows[0]?.id || null;
    }

    const job = await jobs.enqueue({
      userId: req.user.id,
      kind: 'redesign',
      roomId: req.params.id,
      input: { roomId: req.params.id, parentRedesignId: parentId, ...intents },
    });

    return res.status(202).json({ roomId: req.params.id, job: jobs.toJobResponse(job) });
  } catch (err) {
    if (err instanceof QuotaError) {
      return res.status(err.status).json({ error: err.message, quota: err.quota });
    }
    if (err.code === '22P02') return res.status(404).json({ error: 'Room not found.' });
    console.error('[POST /rooms/:id/revisions]', err);
    return res.status(500).json({ error: 'Could not start that revision.' });
  }
});

/* ── List ────────────────────────────────────────────────────────────────── */

const ROOM_LIST_SQL = `
  SELECT r.id, r.name, r.room_type, r.home_id, r.created_at, r.deleted_at,
         r.architecture_json,
         h.name AS home_name,
         ${assetSelect('pa', 'photo_')},
         ${assetSelect('ra', 'render_')},
         latest.id            AS latest_redesign_id,
         latest.style         AS style,
         latest.currency      AS currency,
         latest.budget_cents  AS budget_cents,
         latest.created_at    AS last_activity,
         latest.result_json->>'designConcept' AS concept,
         counts.revision_count,
         COALESCE(bytes.total, 0) AS bytes
    FROM rooms r
    LEFT JOIN homes h ON h.id = r.home_id AND h.deleted_at IS NULL
    ${assetJoin('pa', 'r.photo_asset_id')}
    LEFT JOIN LATERAL (
      SELECT d.* FROM redesigns d
       WHERE d.room_id = r.id AND d.deleted_at IS NULL
       ORDER BY d.revision_no DESC LIMIT 1
    ) latest ON true
    ${assetJoin('ra', 'latest.render_asset_id')}
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS revision_count FROM redesigns d
       WHERE d.room_id = r.id AND d.deleted_at IS NULL
    ) counts ON true
    LEFT JOIN LATERAL (
      SELECT SUM(a.bytes)::bigint AS total FROM assets a
       WHERE a.id = r.photo_asset_id OR a.parent_id = r.photo_asset_id
          OR a.id IN (SELECT render_asset_id FROM redesigns WHERE room_id = r.id)
          OR a.parent_id IN (SELECT render_asset_id FROM redesigns WHERE room_id = r.id)
    ) bytes ON true
`;

router.get('/rooms', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 100);
    const homeId = String(req.query.homeId || '').trim();
    const { rows } = await query(
      `${ROOM_LIST_SQL}
        WHERE r.user_id = $1 AND r.deleted_at IS NULL
          ${homeId ? 'AND r.home_id = $3' : ''}
        ORDER BY COALESCE(latest.created_at, r.created_at) DESC
        LIMIT $2`,
      homeId ? [req.user.id, limit, homeId] : [req.user.id, limit],
    );
    return res.json(rows.map((row) => roomCard(row, req.user.id)));
  } catch (err) {
    console.error('[GET /rooms]', err);
    return res.status(500).json({ error: 'Could not load your rooms.' });
  }
});

/* ── One room, with its revision timeline ────────────────────────────────── */

router.get('/rooms/:id', async (req, res) => {
  try {
    const roomRes = await query(
      `${ROOM_LIST_SQL} WHERE r.id = $2 AND r.user_id = $1 AND r.deleted_at IS NULL`,
      [req.user.id, req.params.id],
    );
    if (!roomRes.rows.length) return res.status(404).json({ error: 'Room not found.' });

    const revisions = await query(
      `SELECT d.id, d.revision_no, d.parent_id, d.instruction, d.style, d.title,
              d.currency, d.created_at, d.result_json, d.fidelity_json,
              ${assetSelect('ra', 'render_')},
              (f.user_id IS NOT NULL) AS favorited
         FROM redesigns d
         ${assetJoin('ra', 'd.render_asset_id')}
         LEFT JOIN favorites f ON f.redesign_id = d.id AND f.user_id = $2
        WHERE d.room_id = $1 AND d.deleted_at IS NULL
        ORDER BY d.revision_no DESC`,
      [req.params.id, req.user.id],
    );

    const active = await query(
      `SELECT * FROM jobs
        WHERE room_id = $1 AND user_id = $2 AND status IN ('queued','running')
        ORDER BY created_at DESC LIMIT 1`,
      [req.params.id, req.user.id],
    );

    const room = roomCard(roomRes.rows[0], req.user.id);
    return res.json({
      ...room,
      architecture: roomRes.rows[0].architecture_json || null,
      revisions: revisions.rows.map((row) => redesignSummary(row, req.user.id)),
      activeJob: active.rows[0] ? jobs.toJobResponse(active.rows[0]) : null,
    });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Room not found.' });
    console.error('[GET /rooms/:id]', err);
    return res.status(500).json({ error: 'Could not load that room.' });
  }
});

/* ── Rename / move between homes ─────────────────────────────────────────── */

router.patch('/rooms/:id', async (req, res) => {
  try {
    const name = req.body.name === undefined ? null : String(req.body.name).trim().slice(0, 80);
    const homeId =
      req.body.homeId === undefined ? undefined : String(req.body.homeId || '').trim() || null;

    if (homeId) {
      const owned = await query(
        'SELECT id FROM homes WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [homeId, req.user.id],
      );
      if (!owned.rows.length) return res.status(404).json({ error: 'That home does not exist.' });
    }

    const { rows } = await query(
      `UPDATE rooms SET
         name    = COALESCE($3, name),
         home_id = CASE WHEN $4::boolean THEN $5::uuid ELSE home_id END
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id, name, home_id`,
      [req.params.id, req.user.id, name || null, homeId !== undefined, homeId ?? null],
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found.' });
    return res.json({ id: rows[0].id, name: rows[0].name, homeId: rows[0].home_id });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Room not found.' });
    console.error('[PATCH /rooms/:id]', err);
    return res.status(500).json({ error: 'Could not update that room.' });
  }
});

/* ── Trash a room (recoverable) ──────────────────────────────────────────── */

router.delete('/rooms/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE rooms SET deleted_at = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found.' });
    return res.json({ ok: true, storage: await storageStatus(req.user) });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Room not found.' });
    console.error('[DELETE /rooms/:id]', err);
    return res.status(500).json({ error: 'Could not delete that room.' });
  }
});

/* ── Progress photos ─────────────────────────────────────────────────────── */

router.get('/rooms/:id/progress', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.caption, p.created_at, ${assetSelect('pa', 'photo_')}
         FROM progress_entries p
         ${assetJoin('pa', 'p.photo_asset_id')}
         JOIN rooms r ON r.id = p.room_id
        WHERE p.room_id = $1 AND r.user_id = $2 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC`,
      [req.params.id, req.user.id],
    );
    return res.json(
      rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        createdAt: row.created_at,
        photo: imageOf(row, req.user.id, 'photo_'),
      })),
    );
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Room not found.' });
    console.error('[GET /rooms/:id/progress]', err);
    return res.status(500).json({ error: 'Could not load progress photos.' });
  }
});

router.post(
  '/rooms/:id/progress',
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Upload failed. Try again.' });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image was uploaded.' });

      const owned = await query(
        'SELECT id FROM rooms WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.user.id],
      );
      if (!owned.rows.length) return res.status(404).json({ error: 'Room not found.' });

      await assertHeadroom(req.user, req.file.size);

      const entry = await withTransaction(async (client) => {
        const stored = await storeImage({
          userId: req.user.id,
          buffer: req.file.buffer,
          kind: KIND.PROGRESS,
          client,
        });
        const { rows } = await client.query(
          `INSERT INTO progress_entries (user_id, room_id, photo_asset_id, caption)
           VALUES ($1,$2,$3,$4) RETURNING id, caption, created_at`,
          [
            req.user.id,
            req.params.id,
            stored.asset.id,
            String(req.body.caption || '').trim().slice(0, 200) || null,
          ],
        );
        return { row: rows[0], stored };
      });

      return res.status(201).json({
        id: entry.row.id,
        caption: entry.row.caption,
        createdAt: entry.row.created_at,
        photo: imageOf(
          {
            photo_storage_key: entry.stored.asset.storage_key,
            photo_thumb_key: entry.stored.thumb.storage_key,
            photo_width: entry.stored.asset.width,
            photo_height: entry.stored.asset.height,
          },
          req.user.id,
          'photo_',
        ),
        storage: await storageStatus(req.user),
      });
    } catch (err) {
      if (err instanceof QuotaError) {
        return res.status(err.status).json({ error: err.message, quota: err.quota });
      }
      console.error('[POST /rooms/:id/progress]', err);
      return res.status(500).json({ error: 'Could not save that photo.' });
    }
  },
);

router.delete('/rooms/:roomId/progress/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM progress_entries
        WHERE id = $1 AND room_id = $2 AND user_id = $3
        RETURNING photo_asset_id`,
      [req.params.id, req.params.roomId, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Photo not found.' });
    await removeAsset(rows[0].photo_asset_id);
    return res.json({ ok: true, storage: await storageStatus(req.user) });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Photo not found.' });
    console.error('[DELETE progress]', err);
    return res.status(500).json({ error: 'Could not delete that photo.' });
  }
});

export default router;
