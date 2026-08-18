// Housekeeping.
//
// Two jobs, both of which exist because storage costs a user their quota:
//
//   1. Purge trash older than the retention window, for real.
//   2. Sweep assets nothing points at any more. These should not happen — every
//      write path cleans up after itself — but a process killed between writing
//      a file and committing its row would leave one behind, and an orphan that
//      silently eats someone's 500 MB is worse than the cost of looking.

import { query } from './db.js';
import { removeAsset } from './assets.js';
import { TRASH_DAYS } from './routes/library.js';

const SWEEP_INTERVAL_MS = Number(process.env.JANITOR_INTERVAL_MS || 60 * 60 * 1000);
/** Grace period so a row still mid-transaction is never mistaken for an orphan. */
const ORPHAN_GRACE_HOURS = 6;

let timer = null;

async function purgeExpiredTrash() {
  // Revisions first, so a room's renders are gone before the room row is.
  const revisions = await query(
    `SELECT d.id, d.render_asset_id
       FROM redesigns d
      WHERE d.deleted_at IS NOT NULL
        AND d.deleted_at < now() - ($1 || ' days')::interval`,
    [String(TRASH_DAYS)],
  );
  for (const row of revisions.rows) {
    await removeAsset(row.render_asset_id);
    await query('DELETE FROM redesigns WHERE id = $1', [row.id]);
  }

  const rooms = await query(
    `SELECT r.id, r.photo_asset_id,
            ARRAY(SELECT render_asset_id FROM redesigns
                   WHERE room_id = r.id AND render_asset_id IS NOT NULL) AS renders
       FROM rooms r
      WHERE r.deleted_at IS NOT NULL
        AND r.deleted_at < now() - ($1 || ' days')::interval`,
    [String(TRASH_DAYS)],
  );
  for (const row of rooms.rows) {
    for (const assetId of [row.photo_asset_id, ...(row.renders || [])]) {
      await removeAsset(assetId);
    }
    await query('DELETE FROM rooms WHERE id = $1', [row.id]);
  }

  const total = revisions.rows.length + rooms.rows.length;
  if (total) console.log(`[janitor] purged ${total} item(s) past ${TRASH_DAYS} days`);
}

async function sweepOrphanAssets() {
  const { rows } = await query(
    `SELECT a.id FROM assets a
      WHERE a.parent_id IS NULL
        AND a.created_at < now() - ($1 || ' hours')::interval
        AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.photo_asset_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM redesigns d WHERE d.render_asset_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM progress_entries p WHERE p.photo_asset_id = a.id)
      LIMIT 200`,
    [String(ORPHAN_GRACE_HOURS)],
  );
  for (const row of rows) await removeAsset(row.id);
  if (rows.length) console.log(`[janitor] swept ${rows.length} orphaned asset(s)`);
}

async function sweep() {
  try {
    await purgeExpiredTrash();
    await sweepOrphanAssets();
  } catch (err) {
    console.error('[janitor]', err.message);
  }
}

export function startJanitor() {
  if (timer) return;
  // Give the server a moment to finish booting before the first pass.
  setTimeout(sweep, 30_000).unref?.();
  timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.log(`[janitor] sweeping every ${Math.round(SWEEP_INTERVAL_MS / 60000)} min`);
}

export function stopJanitor() {
  if (timer) clearInterval(timer);
  timer = null;
}
