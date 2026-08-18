// Everything you can do to a single revision.
//
// Ownership is a WHERE clause on every statement: a redesign id belonging to
// another account behaves exactly like one that does not exist.

import { Router } from 'express';
import { randomBytes } from 'node:crypto';

import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { storageStatus } from '../plans.js';
import { assetJoin, assetSelect, imageOf, redesignFull } from '../serialize.js';
import { matchPalette, BRANDS } from '../paints.js';
import { recomputeTaste } from '../taste.js';

const router = Router();

router.use(requireAuth);

/** Ownership predicate reused by the small statements below. */
const OWNED = `
  FROM redesigns d
  JOIN rooms r ON r.id = d.room_id
 WHERE d.id = $1 AND r.user_id = $2 AND d.deleted_at IS NULL AND r.deleted_at IS NULL
`;

/** Load a redesign the caller owns, with its images and flags. */
async function loadOwned(id, userId) {
  const { rows } = await query(
    `SELECT d.*, r.name AS room_name, r.architecture_json,
            ${assetSelect('ra', 'render_')},
            ${assetSelect('pa', 'photo_')},
            (f.user_id IS NOT NULL) AS favorited,
            s.token AS share_token
       FROM redesigns d
       JOIN rooms r ON r.id = d.room_id
       ${assetJoin('ra', 'd.render_asset_id')}
       ${assetJoin('pa', 'r.photo_asset_id')}
       LEFT JOIN favorites f ON f.redesign_id = d.id AND f.user_id = $2
       LEFT JOIN shares s
              ON s.redesign_id = d.id
             AND s.revoked_at IS NULL
             AND (s.expires_at IS NULL OR s.expires_at > now())
      WHERE d.id = $1 AND r.user_id = $2
        AND d.deleted_at IS NULL AND r.deleted_at IS NULL
      LIMIT 1`,
    [id, userId],
  );
  return rows[0] || null;
}

/* ── The board ───────────────────────────────────────────────────────────── */

router.get('/redesigns/:id', async (req, res) => {
  try {
    const row = await loadOwned(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Redesign not found.' });

    const checklist = await query(
      'SELECT item_key, done, actual_cost_cents, note FROM checklist_state WHERE redesign_id = $1',
      [row.id],
    );

    return res.json({
      ...redesignFull(row, req.user.id),
      roomName: row.room_name,
      architecture: row.architecture_json || null,
      before: imageOf(row, req.user.id, 'photo_'),
      checklist: checklist.rows.map((c) => ({
        key: c.item_key,
        done: c.done,
        actualCostCents: c.actual_cost_cents == null ? null : Number(c.actual_cost_cents),
        note: c.note,
      })),
    });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[GET /redesigns/:id]', err);
    return res.status(500).json({ error: 'Could not load that redesign.' });
  }
});

/** Trash a single revision. The room and its other revisions stay. */
router.delete('/redesigns/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE redesigns d SET deleted_at = now()
         FROM rooms r
        WHERE d.room_id = r.id AND d.id = $1 AND r.user_id = $2 AND d.deleted_at IS NULL
        RETURNING d.id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Redesign not found.' });
    return res.json({ ok: true, storage: await storageStatus(req.user) });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[DELETE /redesigns/:id]', err);
    return res.status(500).json({ error: 'Could not delete that revision.' });
  }
});

/* ── Paint matching ──────────────────────────────────────────────────────── */

router.get('/redesigns/:id/paints', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT d.result_json ${OWNED}`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Redesign not found.' });

    const brand = String(req.query.brand || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 6);

    return res.json({
      brands: BRANDS,
      ...matchPalette(rows[0].result_json?.palette || [], {
        brand: BRANDS.includes(brand) ? brand : null,
        limit,
      }),
    });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[GET paints]', err);
    return res.status(500).json({ error: 'Could not match those colours.' });
  }
});

/* ── Checklist ───────────────────────────────────────────────────────────── */

router.put('/redesigns/:id/checklist/:key', async (req, res) => {
  try {
    const owned = await query(`SELECT d.id ${OWNED}`, [req.params.id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ error: 'Redesign not found.' });

    const key = String(req.params.key).trim().slice(0, 80);
    const done = Boolean(req.body?.done);
    const note = String(req.body?.note || '').trim().slice(0, 200) || null;
    const cost =
      req.body?.actualCost === undefined || req.body.actualCost === null || req.body.actualCost === ''
        ? null
        : Math.max(0, Math.round(Number(req.body.actualCost) * 100)) || null;

    const { rows } = await query(
      `INSERT INTO checklist_state (user_id, redesign_id, item_key, done, actual_cost_cents, note, done_at)
       VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $4 THEN now() ELSE NULL END)
       ON CONFLICT (redesign_id, item_key) DO UPDATE SET
         done = EXCLUDED.done,
         actual_cost_cents = EXCLUDED.actual_cost_cents,
         note = EXCLUDED.note,
         done_at = CASE WHEN EXCLUDED.done THEN COALESCE(checklist_state.done_at, now()) ELSE NULL END,
         updated_at = now()
       RETURNING item_key, done, actual_cost_cents, note`,
      [req.user.id, req.params.id, key, done, cost, note],
    );
    const row = rows[0];
    return res.json({
      key: row.item_key,
      done: row.done,
      actualCostCents: row.actual_cost_cents == null ? null : Number(row.actual_cost_cents),
      note: row.note,
    });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[PUT checklist]', err);
    return res.status(500).json({ error: 'Could not save that change.' });
  }
});

/* ── Favourites (the taste signal) ───────────────────────────────────────── */

router.put('/redesigns/:id/favorite', async (req, res) => {
  try {
    const owned = await query(`SELECT d.id ${OWNED}`, [req.params.id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ error: 'Redesign not found.' });

    const favorited = Boolean(req.body?.favorited);
    if (favorited) {
      await query(
        `INSERT INTO favorites (user_id, redesign_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [req.user.id, req.params.id],
      );
    } else {
      await query('DELETE FROM favorites WHERE user_id = $1 AND redesign_id = $2', [
        req.user.id,
        req.params.id,
      ]);
    }

    const taste = await recomputeTaste(req.user.id);
    return res.json({ favorited, taste });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[PUT favorite]', err);
    return res.status(500).json({ error: 'Could not save that.' });
  }
});

/* ── Sharing ─────────────────────────────────────────────────────────────── */

const DEFAULT_SHARE_DAYS = 30;

router.post('/redesigns/:id/share', async (req, res) => {
  try {
    const owned = await query(`SELECT d.id ${OWNED}`, [req.params.id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ error: 'Redesign not found.' });

    const days = Math.min(Math.max(Number(req.body?.days) || DEFAULT_SHARE_DAYS, 1), 365);
    const neverExpires = req.body?.neverExpires === true;

    // Reuse a live link rather than minting a second one for the same board.
    const existing = await query(
      `SELECT token FROM shares
        WHERE redesign_id = $1 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC LIMIT 1`,
      [req.params.id],
    );
    if (existing.rows.length) {
      return res.json({ token: existing.rows[0].token, reused: true });
    }

    const token = randomBytes(16).toString('base64url');
    await query(
      `INSERT INTO shares (user_id, redesign_id, token, expires_at)
       VALUES ($1,$2,$3, CASE WHEN $4::boolean THEN NULL ELSE now() + ($5 || ' days')::interval END)`,
      [req.user.id, req.params.id, token, neverExpires, String(days)],
    );
    return res.status(201).json({ token, reused: false });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[POST share]', err);
    return res.status(500).json({ error: 'Could not create a share link.' });
  }
});

router.delete('/redesigns/:id/share', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE shares SET revoked_at = now()
        WHERE redesign_id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [req.params.id, req.user.id],
    );
    return res.json({ ok: true, revoked: rows.length });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Redesign not found.' });
    console.error('[DELETE share]', err);
    return res.status(500).json({ error: 'Could not revoke that link.' });
  }
});

export default router;
