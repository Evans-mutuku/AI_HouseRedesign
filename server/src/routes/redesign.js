// Redesign routes.
//
// Every route in this file is mounted behind `requireAuth`, and every query is
// scoped by `req.user.id`. There is no route that accepts a user identifier
// from the client, and no lookup by id alone — reading or deleting a redesign
// requires the row to join back to the calling account, so a valid id belonging
// to someone else returns 404 exactly like an id that does not exist.

import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

import { query, withTransaction } from '../db.js';
import { storage } from '../storage.js';
import { signedUrl } from '../media.js';
import { imageSize } from '../imageSize.js';
import { requireAuth } from '../auth.js';
import { assertHeadroom, QuotaError, storageStatus } from '../plans.js';
import { generateRedesign, ClaudeError } from '../claude.js';
import { generateAfterImage, imagesEnabled } from '../images.js';
import { validateRedesign, ValidationError } from '../validate.js';

const router = Router();

const MAX_BYTES = 8 * 1024 * 1024; // ~8MB per upload
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

class MulterTypeError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new MulterTypeError('Unsupported file type. Use JPG, PNG, or WebP.'));
  },
});

// Rate limit the expensive endpoint per account rather than per IP, so one
// office network does not share a bucket. `requireAuth` is registered before
// every route below, so `req.user` is always populated by the time this runs.
const redesignLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.REDESIGN_RATE_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Too many redesigns. Please wait a minute and try again.' },
});

// Shape a stored row into the API response, with image URLs signed for the
// caller. `userId` is always the authenticated user — never a value off the row.
const toResponse = (room, redesign, userId) => ({
  id: redesign.id,
  title: redesign.title || redesign.result_json?.roomType || 'Redesign',
  before: { url: signedUrl(room.image_path, userId) },
  after: redesign.after_image_path
    ? { url: signedUrl(redesign.after_image_path, userId) }
    : null,
  style: redesign.style,
  budget: redesign.budget,
  userNote: redesign.user_note,
  model: redesign.model,
  createdAt: redesign.created_at,
  bytes: Number(room.bytes || 0) + Number(redesign.after_bytes || 0),
  redesign: redesign.result_json,
});

router.use(requireAuth);

/**
 * POST /api/redesign
 * multipart: `image` (file) + intent fields (style, budget, note).
 */
router.post(
  '/redesign',
  redesignLimiter,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof MulterTypeError) {
          return res.status(415).json({ error: err.message });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(413)
            .json({ error: 'Image is too large. Max size is 8MB.' });
        }
        return res.status(400).json({ error: 'Upload failed. Try again.' });
      }
      next();
    });
  },
  async (req, res) => {
    let persisted = false;
    let imagePath = null;
    let afterPath = null;
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No image was uploaded.' });
      }
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return res
          .status(415)
          .json({ error: 'Unsupported file type. Use JPG, PNG, or WebP.' });
      }

      // Quota first: fail before spending a model call we could not store.
      await assertHeadroom(req.user, file.size);

      const style = String(req.body.style || '').trim().slice(0, 80);
      const budget = String(req.body.budget || '').trim().slice(0, 40);
      const note = String(req.body.note || '').trim().slice(0, 600);

      // 1) Ask Claude — no point persisting a room if the model fails.
      const { parsed, model } = await generateRedesign({
        base64: file.buffer.toString('base64'),
        mediaType: file.mimetype,
        intents: { style, budget, note },
      });

      // 2) Validate the structured spec before we store anything.
      const result = validateRedesign(parsed);

      // 3) Store the original.
      const { width, height } = imageSize(file.buffer);
      imagePath = await storage.save(
        file.buffer,
        file.mimetype,
        file.originalname,
      );

      // 4) Render the "after" by editing the original photo. Best-effort: a
      //    failure here must not lose the (expensive) board — we degrade to a
      //    board-only result and tell the client why.
      let afterBytes = 0;
      let imageError = null;
      if (!imagesEnabled()) {
        imageError = 'Image rendering is not configured (OPENAI_API_KEY unset).';
      } else if (!result.imagePrompt) {
        imageError = 'The model did not return an image prompt.';
      } else {
        try {
          const after = await generateAfterImage({
            imageBuffer: file.buffer,
            mime: file.mimetype,
            prompt: result.imagePrompt,
          });
          afterPath = await storage.save(after.buffer, after.mime);
          afterBytes = after.buffer.length;
        } catch (err) {
          console.error('[after-image]', err.message);
          imageError = 'The after image could not be rendered this time.';
        }
      }

      // 5) Write the room and its redesign in one transaction. A room without
      //    a redesign would be invisible to the projects list yet still count
      //    against the quota, so the two rows must land together or not at all.
      const { room, redesign } = await withTransaction(async (client) => {
        const roomRes = await client.query(
          `INSERT INTO rooms (user_id, image_path, mime, width, height, bytes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [req.user.id, imagePath, file.mimetype, width, height, file.size],
        );
        const insertedRoom = roomRes.rows[0];
        const redesignRes = await client.query(
          `INSERT INTO redesigns
             (room_id, style, budget, user_note, model, result_json,
              after_image_path, after_bytes, title)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            insertedRoom.id,
            style,
            budget,
            note,
            model,
            result,
            afterPath,
            afterBytes,
            result.roomType || 'Redesign',
          ],
        );
        return { room: insertedRoom, redesign: redesignRes.rows[0] };
      });
      persisted = true;

      return res.status(201).json({
        ...toResponse(room, redesign, req.user.id),
        imageError,
        storage: await storageStatus(req.user),
      });
    } catch (err) {
      // Nothing was committed, so drop whatever reached disk — otherwise a
      // failed request would silently eat the account's quota with files no
      // row points at.
      if (!persisted) {
        await storage.remove(imagePath);
        await storage.remove(afterPath);
      }
      if (err instanceof QuotaError) {
        return res
          .status(err.status)
          .json({ error: err.message, quota: err.quota });
      }
      if (err instanceof ClaudeError) {
        return res.status(err.status).json({ error: err.message });
      }
      if (err instanceof ValidationError) {
        return res.status(502).json({
          error:
            'The design model returned an incomplete board. Please try again.',
        });
      }
      console.error('[POST /redesign]', err);
      return res
        .status(500)
        .json({ error: 'Something went wrong creating your redesign.' });
    }
  },
);

/**
 * GET /api/redesign/:id — one redesign, only if this account owns it.
 */
router.get('/redesign/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.*, rm.image_path, rm.bytes
         FROM redesigns r
         JOIN rooms rm ON rm.id = r.room_id
        WHERE r.id = $1 AND rm.user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Redesign not found.' });
    }
    const row = rows[0];
    return res.json(
      toResponse(
        { image_path: row.image_path, bytes: row.bytes },
        row,
        req.user.id,
      ),
    );
  } catch (err) {
    if (err.code === '22P02') {
      // invalid uuid input syntax — treat as "not yours / not here"
      return res.status(404).json({ error: 'Redesign not found.' });
    }
    console.error('[GET /redesign/:id]', err);
    return res.status(500).json({ error: 'Could not load that redesign.' });
  }
});

/**
 * DELETE /api/redesign/:id — remove a project and reclaim its storage.
 */
router.delete('/redesign/:id', async (req, res) => {
  try {
    const row = await withTransaction(async (client) => {
      // Ownership is part of the WHERE clause, and FOR UPDATE holds the row so
      // a double-click cannot delete the same files twice.
      const { rows } = await client.query(
        `SELECT r.id, r.after_image_path, rm.id AS room_id, rm.image_path
           FROM redesigns r
           JOIN rooms rm ON rm.id = r.room_id
          WHERE r.id = $1 AND rm.user_id = $2
          FOR UPDATE OF r`,
        [req.params.id, req.user.id],
      );
      if (!rows.length) return null;

      // Deleting the room cascades to the redesign.
      await client.query('DELETE FROM rooms WHERE id = $1 AND user_id = $2', [
        rows[0].room_id,
        req.user.id,
      ]);
      return rows[0];
    });

    if (!row) {
      return res.status(404).json({ error: 'Redesign not found.' });
    }

    // Files last: if this fails we have an orphaned blob, not a dangling row.
    await storage.remove(row.image_path);
    await storage.remove(row.after_image_path);

    return res.json({ ok: true, storage: await storageStatus(req.user) });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: 'Redesign not found.' });
    }
    console.error('[DELETE /redesign/:id]', err);
    return res.status(500).json({ error: 'Could not delete that redesign.' });
  }
});

/**
 * GET /api/redesigns — this account's projects, newest first.
 */
router.get('/redesigns', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 100);
    const { rows } = await query(
      `SELECT r.id, r.style, r.budget, r.title, r.created_at,
              r.after_image_path, r.after_bytes,
              r.result_json->>'roomType'      AS room_type,
              r.result_json->>'designConcept' AS concept,
              rm.image_path, rm.bytes
         FROM redesigns r
         JOIN rooms rm ON rm.id = r.room_id
        WHERE rm.user_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2`,
      [req.user.id, limit],
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title || r.room_type || 'Redesign',
        concept: r.concept || '',
        thumbnail: signedUrl(r.after_image_path || r.image_path, req.user.id),
        beforeThumbnail: signedUrl(r.image_path, req.user.id),
        hasRender: Boolean(r.after_image_path),
        style: r.style,
        budget: r.budget,
        bytes: Number(r.bytes || 0) + Number(r.after_bytes || 0),
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    console.error('[GET /redesigns]', err);
    return res.status(500).json({ error: 'Could not load your redesigns.' });
  }
});

export default router;
