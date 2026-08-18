// Brings data written by earlier versions up to the current shape.
//
// Runs automatically after the schema migration and is idempotent — every step
// selects only rows that have not been converted yet, so re-running it is a
// no-op. Nothing is destructive: original files stay exactly as they are on
// disk and are simply registered in `assets` at their real size, with a
// thumbnail generated alongside.

import sharp from 'sharp';

import { query } from './db.js';
import { storage } from './storage.js';
import { THUMB_EDGE } from './assets.js';

const log = (...args) => console.log('[backfill]', ...args);

/* ── 1. Register legacy image files as assets ────────────────────────────── */

async function registerImage({ userId, storageKey, kind }) {
  const existing = await query('SELECT id FROM assets WHERE storage_key = $1', [
    storageKey,
  ]);
  if (existing.rows.length) return existing.rows[0].id;

  const buffer = await storage.read(storageKey);
  if (!buffer) {
    log(`skipping ${storageKey} — file is gone`);
    return null;
  }

  let meta = {};
  try {
    meta = await sharp(buffer, { failOn: 'none' }).metadata();
  } catch {
    /* unreadable; still register it so the bytes are accounted for */
  }

  const mime =
    meta.format === 'png'
      ? 'image/png'
      : meta.format === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const { rows } = await query(
    `INSERT INTO assets (user_id, kind, variant, storage_key, mime, bytes, width, height)
     VALUES ($1, $2, 'full', $3, $4, $5, $6, $7) RETURNING id`,
    [userId, kind, storageKey, mime, buffer.length, meta.width ?? null, meta.height ?? null],
  );
  const assetId = rows[0].id;

  // Give it a thumbnail so the grid does not keep loading full-size images.
  try {
    const { data, info } = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer({ resolveWithObject: true });
    const thumbKey = await storage.save(data, 'image/webp');
    await query(
      `INSERT INTO assets (user_id, kind, variant, storage_key, mime, bytes, width, height, parent_id)
       VALUES ($1, $2, 'thumb', $3, 'image/webp', $4, $5, $6, $7)`,
      [userId, kind, thumbKey, data.length, info.width, info.height, assetId],
    );
  } catch (err) {
    log(`could not thumbnail ${storageKey}: ${err.message}`);
  }

  return assetId;
}

async function backfillAssets() {
  const rooms = await query(
    `SELECT id, user_id, image_path FROM rooms
      WHERE photo_asset_id IS NULL AND image_path IS NOT NULL`,
  );
  for (const room of rooms.rows) {
    const assetId = await registerImage({
      userId: room.user_id,
      storageKey: room.image_path,
      kind: 'original',
    });
    if (assetId) {
      await query('UPDATE rooms SET photo_asset_id = $2 WHERE id = $1', [room.id, assetId]);
    }
  }
  if (rooms.rows.length) log(`registered ${rooms.rows.length} room photo(s)`);

  const renders = await query(
    `SELECT d.id, d.after_image_path, r.user_id
       FROM redesigns d JOIN rooms r ON r.id = d.room_id
      WHERE d.render_asset_id IS NULL AND d.after_image_path IS NOT NULL`,
  );
  for (const row of renders.rows) {
    const assetId = await registerImage({
      userId: row.user_id,
      storageKey: row.after_image_path,
      kind: 'render',
    });
    if (assetId) {
      await query('UPDATE redesigns SET render_asset_id = $2 WHERE id = $1', [row.id, assetId]);
    }
  }
  if (renders.rows.length) log(`registered ${renders.rows.length} render(s)`);
}

/* ── 2. Upgrade boards written against the old JSON shape ────────────────── */

const slug = (text, i) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `item-${i + 1}`;

/**
 * The old board had `furniture` and an untyped `shoppingList` with price tiers
 * rather than amounts. There is no way to invent the costs it never captured,
 * so the money fields stay zero and `budget.note` says why — better an honest
 * blank than a fabricated total.
 */
function upgradeBoard(old) {
  const plan = (old.furniture || []).map((f, i) => ({
    key: slug(f.item, i),
    action: f.action || 'add',
    item: f.item || '',
    rationale: f.rationale || '',
    phase: f.action === 'add' ? 'month' : 'weekend',
    costCents: 0,
    effort: 'moderate',
    legacyBudget: f.approxBudget || '',
  }));

  const shoppingList = (old.shoppingList || []).map((s, i) => ({
    key: slug(s.item, i),
    item: s.item || '',
    costCents: 0,
    phase: 'month',
    note: s.note || '',
    searchQuery: s.item || '',
    legacyTier: s.priceTier || '',
  }));

  const usedPhases = new Set(plan.map((p) => p.phase));
  const titles = { weekend: 'This weekend', month: 'This month', full: 'The full direction' };

  return {
    roomType: old.roomType || '',
    designConcept: old.designConcept || '',
    revisionNote: '',
    palette: old.palette || [],
    lighting: old.lighting || '',
    materials: old.materials || [],
    plan,
    phases: ['weekend', 'month', 'full']
      .filter((id) => usedPhases.has(id))
      .map((id) => ({ id, title: titles[id], summary: '' })),
    budget: {
      currency: 'USD',
      totalCents: 0,
      weekendCents: 0,
      monthCents: 0,
      fullCents: 0,
      budgetCents: null,
      withinBudget: true,
      overBy: 0,
      note: 'This board was created before costed plans; item prices were not captured.',
      legacy: true,
    },
    layoutNotes: old.layoutNotes || '',
    decor: old.decor || [],
    shoppingList,
    floorPlan: null,
    imageDirection: old.imagePrompt || '',
  };
}

async function backfillBoards() {
  // `plan` is the marker for the new shape; `furniture` for the old one.
  const { rows } = await query(
    `SELECT id, result_json FROM redesigns
      WHERE result_json ? 'furniture' AND NOT (result_json ? 'plan')`,
  );
  for (const row of rows) {
    await query('UPDATE redesigns SET result_json = $2 WHERE id = $1', [
      row.id,
      upgradeBoard(row.result_json),
    ]);
  }
  if (rows.length) log(`upgraded ${rows.length} board(s) to the costed/phased shape`);
}

/* ── 3. Fill in the fields revisions rely on ─────────────────────────────── */

async function backfillRevisions() {
  // Number each room's existing boards oldest-first so the timeline reads
  // correctly, and chain each to its predecessor.
  const { rows } = await query(
    `WITH ordered AS (
       SELECT id, room_id,
              ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at) AS rn,
              LAG(id) OVER (PARTITION BY room_id ORDER BY created_at) AS prev
         FROM redesigns
        WHERE deleted_at IS NULL
     )
     UPDATE redesigns d
        SET revision_no = o.rn,
            parent_id   = COALESCE(d.parent_id, o.prev)
       FROM ordered o
      WHERE d.id = o.id AND (d.revision_no IS DISTINCT FROM o.rn OR d.parent_id IS NULL AND o.prev IS NOT NULL)
      RETURNING d.id`,
  );
  if (rows.length) log(`numbered ${rows.length} revision(s)`);

  const named = await query(
    `UPDATE rooms r
        SET name = COALESCE(r.name, sub.title),
            room_type = COALESCE(r.room_type, sub.title)
       FROM (
         SELECT DISTINCT ON (room_id) room_id,
                COALESCE(title, result_json->>'roomType', 'Room') AS title
           FROM redesigns ORDER BY room_id, created_at
       ) sub
      WHERE r.id = sub.room_id AND r.name IS NULL
      RETURNING r.id`,
  );
  if (named.rows.length) log(`named ${named.rows.length} room(s)`);

  // Rooms that never produced a board still deserve a name.
  await query(`UPDATE rooms SET name = 'Room' WHERE name IS NULL`);
}

export async function runBackfill() {
  await backfillAssets();
  await backfillBoards();
  await backfillRevisions();
  log('done');
}
