// Public, read-only boards.
//
// The only unauthenticated route that reads user data, so it is deliberately
// narrow:
//
//   • the token is the whole credential — unguessable, revocable, expiring
//   • it resolves to exactly one revision, never a room or an account
//   • the response is stripped: no owner identity, no checklist, no budget the
//     user set, no sibling revisions, no ids that would work elsewhere
//   • images are signed against the OWNER's id for a short window, so a shared
//     link cannot be turned into a durable hotlink to their storage

import { Router } from 'express';

import { query } from '../db.js';
import { signedUrl } from '../media.js';
import { assetJoin, assetSelect } from '../serialize.js';
import { matchPalette } from '../paints.js';

const router = Router();

/** Shorter than the signed-URL default: a share should go stale, not persist. */
const SHARE_IMAGE_TTL_MS = 2 * 60 * 60 * 1000;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

router.get('/share/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!TOKEN_RE.test(token)) {
      return res.status(404).json({ error: 'This link is not valid.' });
    }

    const { rows } = await query(
      `SELECT d.id, d.title, d.revision_no, d.style, d.created_at, d.result_json,
              r.name AS room_name, r.user_id AS owner_id,
              u.display_name AS owner_name,
              s.expires_at, s.revoked_at,
              ${assetSelect('ra', 'render_')},
              ${assetSelect('pa', 'photo_')}
         FROM shares s
         JOIN redesigns d ON d.id = s.redesign_id
         JOIN rooms r     ON r.id = d.room_id
         JOIN users u     ON u.id = r.user_id
         ${assetJoin('ra', 'd.render_asset_id')}
         ${assetJoin('pa', 'r.photo_asset_id')}
        WHERE s.token = $1
          AND s.revoked_at IS NULL
          AND (s.expires_at IS NULL OR s.expires_at > now())
          AND d.deleted_at IS NULL
          AND r.deleted_at IS NULL`,
      [token],
    );

    if (!rows.length) {
      // One message for revoked, expired, deleted, and never-existed, so the
      // link cannot be used to probe what is there.
      return res.status(404).json({ error: 'This link has expired or been revoked.' });
    }

    const row = rows[0];

    // Best-effort: a failed counter must never cost someone the page.
    query('UPDATE shares SET view_count = view_count + 1 WHERE token = $1', [token]).catch(
      () => {},
    );

    const board = row.result_json || {};
    const image = (prefix) =>
      row[`${prefix}storage_key`]
        ? {
            url: signedUrl(row[`${prefix}storage_key`], row.owner_id, SHARE_IMAGE_TTL_MS),
            thumbUrl: row[`${prefix}thumb_key`]
              ? signedUrl(row[`${prefix}thumb_key`], row.owner_id, SHARE_IMAGE_TTL_MS)
              : null,
          }
        : null;

    return res.json({
      title: row.title || row.room_name || 'Redesign',
      roomName: row.room_name,
      sharedBy: row.owner_name || null,
      style: row.style,
      revisionNo: row.revision_no,
      createdAt: row.created_at,
      before: image('photo_'),
      render: image('render_'),
      paints: matchPalette(board.palette || []),
      // The board minus anything private. The plan and palette are the point of
      // sharing; what the owner budgeted and what they have already bought are
      // not.
      board: {
        roomType: board.roomType,
        designConcept: board.designConcept,
        palette: board.palette || [],
        lighting: board.lighting,
        materials: board.materials || [],
        plan: (board.plan || []).map(({ key, action, item, rationale, phase, effort }) => ({
          key,
          action,
          item,
          rationale,
          phase,
          effort,
        })),
        phases: board.phases || [],
        layoutNotes: board.layoutNotes,
        decor: board.decor || [],
        floorPlan: board.floorPlan || null,
      },
    });
  } catch (err) {
    console.error('[GET /share/:token]', err);
    return res.status(500).json({ error: 'Could not load this board.' });
  }
});

export default router;
