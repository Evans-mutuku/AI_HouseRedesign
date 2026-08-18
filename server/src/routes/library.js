// Jobs, homes, and the trash.

import { Router } from 'express';

import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { removeAsset } from '../assets.js';
import { storageStatus } from '../plans.js';
import * as jobs from '../jobs.js';

const router = Router();

router.use(requireAuth);

/* ── Jobs ────────────────────────────────────────────────────────────────── */

/** Everything still in flight - lets the UI restore itself after a reload. */
router.get('/jobs', async (req, res) => {
  try {
    const rows = await jobs.activeJobs(req.user.id);
    return res.json(rows.map(jobs.toJobResponse));
  } catch (err) {
    console.error('[GET /jobs]', err);
    return res.status(500).json({ error: 'Could not load your jobs.' });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await jobs.getJob(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    return res.json(jobs.toJobResponse(job));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Job not found.' });
    console.error('[GET /jobs/:id]', err);
    return res.status(500).json({ error: 'Could not load that job.' });
  }
});

router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const cancelled = await jobs.cancel(req.params.id, req.user.id);
    if (!cancelled) {
      return res.status(409).json({ error: 'That job has already finished.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Job not found.' });
    console.error('[POST /jobs/:id/cancel]', err);
    return res.status(500).json({ error: 'Could not cancel that job.' });
  }
});

/* ── Homes ───────────────────────────────────────────────────────────────── */

const homeShape = (row) => ({
  id: row.id,
  name: row.name,
  notes: row.notes,
  palette: row.palette_json || null,
  roomCount: Number(row.room_count || 0),
  createdAt: row.created_at,
});

router.get('/homes', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT h.*, (
         SELECT COUNT(*)::int FROM rooms r
          WHERE r.home_id = h.id AND r.deleted_at IS NULL
       ) AS room_count
       FROM homes h
      WHERE h.user_id = $1 AND h.deleted_at IS NULL
      ORDER BY h.created_at DESC`,
      [req.user.id],
    );
    return res.json(rows.map(homeShape));
  } catch (err) {
    console.error('[GET /homes]', err);
    return res.status(500).json({ error: 'Could not load your homes.' });
  }
});

router.post('/homes', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'Give the home a name.' });
    const { rows } = await query(
      `INSERT INTO homes (user_id, name, notes) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, name, String(req.body?.notes || '').trim().slice(0, 500) || null],
    );
    return res.status(201).json(homeShape({ ...rows[0], room_count: 0 }));
  } catch (err) {
    console.error('[POST /homes]', err);
    return res.status(500).json({ error: 'Could not create that home.' });
  }
});

router.patch('/homes/:id', async (req, res) => {
  try {
    const name =
      req.body?.name === undefined ? null : String(req.body.name).trim().slice(0, 80) || null;
    const notes =
      req.body?.notes === undefined ? null : String(req.body.notes).trim().slice(0, 500);

    // The shared palette can be adopted from any board in the home.
    let palette;
    if (req.body?.adoptFromRedesignId) {
      const source = await query(
        `SELECT d.result_json->'palette' AS palette
           FROM redesigns d
           JOIN rooms r ON r.id = d.room_id
          WHERE d.id = $1 AND r.user_id = $2 AND r.home_id = $3 AND d.deleted_at IS NULL`,
        [req.body.adoptFromRedesignId, req.user.id, req.params.id],
      );
      if (!source.rows.length) {
        return res.status(404).json({ error: 'That revision is not in this home.' });
      }
      palette = source.rows[0].palette;
    } else if (req.body?.palette !== undefined) {
      palette = req.body.palette;
    }

    const { rows } = await query(
      `UPDATE homes SET
         name         = COALESCE($3, name),
         notes        = COALESCE($4, notes),
         palette_json = CASE WHEN $5::boolean THEN $6::jsonb ELSE palette_json END
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [
        req.params.id,
        req.user.id,
        name,
        notes,
        palette !== undefined,
        palette === undefined ? null : JSON.stringify(palette),
      ],
    );
    if (!rows.length) return res.status(404).json({ error: 'Home not found.' });
    return res.json(homeShape({ ...rows[0], room_count: 0 }));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Home not found.' });
    console.error('[PATCH /homes/:id]', err);
    return res.status(500).json({ error: 'Could not update that home.' });
  }
});

router.delete('/homes/:id', async (req, res) => {
  try {
    // Rooms survive; they simply stop belonging to a home.
    const { rows } = await query(
      `UPDATE homes SET deleted_at = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Home not found.' });
    await query('UPDATE rooms SET home_id = NULL WHERE home_id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Home not found.' });
    console.error('[DELETE /homes/:id]', err);
    return res.status(500).json({ error: 'Could not delete that home.' });
  }
});

/* ── Trash ───────────────────────────────────────────────────────────────── */

/** How long deleted work is kept before the purge job can clear it. */
export const TRASH_DAYS = 30;

router.get('/trash', async (req, res) => {
  try {
    const rooms = await query(
      `SELECT r.id, r.name, r.room_type, r.deleted_at,
              COALESCE(b.total, 0) AS bytes
         FROM rooms r
         LEFT JOIN LATERAL (
           SELECT SUM(a.bytes)::bigint AS total FROM assets a
            WHERE a.id = r.photo_asset_id OR a.parent_id = r.photo_asset_id
               OR a.id IN (SELECT render_asset_id FROM redesigns WHERE room_id = r.id)
               OR a.parent_id IN (SELECT render_asset_id FROM redesigns WHERE room_id = r.id)
         ) b ON true
        WHERE r.user_id = $1 AND r.deleted_at IS NOT NULL
        ORDER BY r.deleted_at DESC`,
      [req.user.id],
    );

    const revisions = await query(
      `SELECT d.id, d.title, d.revision_no, d.deleted_at, d.room_id, r.name AS room_name,
              COALESCE(b.total, 0) AS bytes
         FROM redesigns d
         JOIN rooms r ON r.id = d.room_id
         LEFT JOIN LATERAL (
           SELECT SUM(a.bytes)::bigint AS total FROM assets a
            WHERE a.id = d.render_asset_id OR a.parent_id = d.render_asset_id
         ) b ON true
        WHERE r.user_id = $1 AND d.deleted_at IS NOT NULL AND r.deleted_at IS NULL
        ORDER BY d.deleted_at DESC`,
      [req.user.id],
    );

    return res.json({
      retentionDays: TRASH_DAYS,
      rooms: rooms.rows.map((r) => ({
        id: r.id,
        name: r.name || r.room_type || 'Room',
        bytes: Number(r.bytes || 0),
        deletedAt: r.deleted_at,
      })),
      revisions: revisions.rows.map((d) => ({
        id: d.id,
        roomId: d.room_id,
        roomName: d.room_name,
        title: d.title,
        revisionNo: d.revision_no,
        bytes: Number(d.bytes || 0),
        deletedAt: d.deleted_at,
      })),
      storage: await storageStatus(req.user),
    });
  } catch (err) {
    console.error('[GET /trash]', err);
    return res.status(500).json({ error: 'Could not load your trash.' });
  }
});

router.post('/trash/restore', async (req, res) => {
  try {
    const roomId = String(req.body?.roomId || '').trim();
    const redesignId = String(req.body?.redesignId || '').trim();

    if (roomId) {
      const { rows } = await query(
        `UPDATE rooms SET deleted_at = NULL
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING id`,
        [roomId, req.user.id],
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found in your trash.' });
      return res.json({ ok: true, restored: 'room' });
    }

    if (redesignId) {
      const { rows } = await query(
        `UPDATE redesigns d SET deleted_at = NULL
           FROM rooms r
          WHERE d.room_id = r.id AND d.id = $1 AND r.user_id = $2 AND d.deleted_at IS NOT NULL
          RETURNING d.id`,
        [redesignId, req.user.id],
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found in your trash.' });
      return res.json({ ok: true, restored: 'revision' });
    }

    return res.status(400).json({ error: 'Nothing specified to restore.' });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Not found in your trash.' });
    console.error('[POST /trash/restore]', err);
    return res.status(500).json({ error: 'Could not restore that.' });
  }
});

/** Permanently delete. This is the only place bytes actually leave the system. */
router.post('/trash/empty', async (req, res) => {
  try {
    const roomId = String(req.body?.roomId || '').trim();
    const redesignId = String(req.body?.redesignId || '').trim();

    let assetIds = [];

    if (roomId) {
      const owned = await query(
        `SELECT r.photo_asset_id,
                ARRAY(SELECT render_asset_id FROM redesigns WHERE room_id = r.id
                       AND render_asset_id IS NOT NULL) AS renders
           FROM rooms r
          WHERE r.id = $1 AND r.user_id = $2 AND r.deleted_at IS NOT NULL`,
        [roomId, req.user.id],
      );
      if (!owned.rows.length) return res.status(404).json({ error: 'Not found in your trash.' });
      assetIds = [owned.rows[0].photo_asset_id, ...(owned.rows[0].renders || [])];
      await query('DELETE FROM rooms WHERE id = $1 AND user_id = $2', [roomId, req.user.id]);
    } else if (redesignId) {
      const owned = await query(
        `SELECT d.render_asset_id FROM redesigns d JOIN rooms r ON r.id = d.room_id
          WHERE d.id = $1 AND r.user_id = $2 AND d.deleted_at IS NOT NULL`,
        [redesignId, req.user.id],
      );
      if (!owned.rows.length) return res.status(404).json({ error: 'Not found in your trash.' });
      assetIds = [owned.rows[0].render_asset_id];
      await query('DELETE FROM redesigns WHERE id = $1', [redesignId]);
    } else {
      // Empty everything currently in the trash.
      const rooms = await query(
        `SELECT photo_asset_id,
                ARRAY(SELECT render_asset_id FROM redesigns WHERE room_id = rooms.id
                       AND render_asset_id IS NOT NULL) AS renders
           FROM rooms WHERE user_id = $1 AND deleted_at IS NOT NULL`,
        [req.user.id],
      );
      const revisions = await query(
        `SELECT d.render_asset_id FROM redesigns d JOIN rooms r ON r.id = d.room_id
          WHERE r.user_id = $1 AND d.deleted_at IS NOT NULL`,
        [req.user.id],
      );
      assetIds = [
        ...rooms.rows.flatMap((r) => [r.photo_asset_id, ...(r.renders || [])]),
        ...revisions.rows.map((d) => d.render_asset_id),
      ];
      await query(
        `DELETE FROM redesigns WHERE id IN (
           SELECT d.id FROM redesigns d JOIN rooms r ON r.id = d.room_id
            WHERE r.user_id = $1 AND d.deleted_at IS NOT NULL)`,
        [req.user.id],
      );
      await query('DELETE FROM rooms WHERE user_id = $1 AND deleted_at IS NOT NULL', [
        req.user.id,
      ]);
    }

    await Promise.all([...new Set(assetIds.filter(Boolean))].map((id) => removeAsset(id)));
    return res.json({ ok: true, storage: await storageStatus(req.user) });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Not found in your trash.' });
    console.error('[POST /trash/empty]', err);
    return res.status(500).json({ error: 'Could not empty your trash.' });
  }
});

export default router;
