// The image pipeline and the single source of truth for stored bytes.
//
// Nothing writes to storage except this module. Every file that lands on disk
// gets a row in `assets`, which means:
//
//   • the quota is one SUM over one table and cannot drift from reality
//   • a signed URL is minted against an owner we looked up, never a client value
//   • deleting a row deletes the file, and a thumbnail dies with its parent
//
// Uploads are re-encoded rather than stored as received. A phone photo is
// typically 4–8 MB of JPEG at 4000px; nothing in this product needs more than
// ~2000px, and WebP at q80 is visually indistinguishable at a fraction of the
// size. In practice this is a 5–10× reduction, which is the difference between
// ~60 and ~500 projects inside the free 500 MB.

import sharp from 'sharp';

import { query } from './db.js';
import { storage } from './storage.js';

/** Longest edge we keep for a full-size image. */
const MAX_EDGE = 2048;
/** Longest edge for the grid thumbnail. */
const THUMB_EDGE = 640;

const FULL_QUALITY = 80;
const THUMB_QUALITY = 72;

export const KIND = {
  ORIGINAL: 'original',
  RENDER: 'render',
  PROGRESS: 'progress',
  MASK: 'mask',
};

/**
 * Re-encode an uploaded or generated image to WebP, capped at MAX_EDGE.
 * `withoutEnlargement` means a small image is never upscaled into a bigger file.
 * Rotation is applied from EXIF and then stripped, so a portrait phone photo is
 * not silently sideways once the metadata is gone.
 */
async function encodeFull(buffer) {
  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: FULL_QUALITY });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, mime: 'image/webp' };
}

async function encodeThumb(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: THUMB_EDGE,
      height: THUMB_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height, mime: 'image/webp' };
}

/** Read dimensions without decoding the whole image. */
export async function probe(buffer) {
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null, format: meta.format };
  } catch {
    return { width: null, height: null, format: null };
  }
}

async function insertAsset(client, row) {
  const { rows } = await (client || { query }).query(
    `INSERT INTO assets (user_id, kind, variant, storage_key, mime, bytes, width, height, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      row.userId,
      row.kind,
      row.variant,
      row.storageKey,
      row.mime,
      row.bytes,
      row.width,
      row.height,
      row.parentId || null,
    ],
  );
  return rows[0];
}

/**
 * Compress `buffer`, write the full image and its thumbnail, and record both.
 * Returns { asset, thumb, bytes, savedBytes } where `bytes` is what the pair
 * actually costs the user's quota.
 *
 * Pass `client` to enlist in a caller's transaction. Files are written before
 * the rows; a rollback therefore leaves orphaned blobs, which `rollback()`
 * below is for.
 */
export async function storeImage({ userId, buffer, kind, client = null }) {
  const originalBytes = buffer.length;

  const full = await encodeFull(buffer);
  const thumb = await encodeThumb(full.buffer);

  const fullKey = await storage.save(full.buffer, full.mime);
  let thumbKey = null;
  try {
    thumbKey = await storage.save(thumb.buffer, thumb.mime);

    const asset = await insertAsset(client, {
      userId,
      kind,
      variant: 'full',
      storageKey: fullKey,
      mime: full.mime,
      bytes: full.buffer.length,
      width: full.width,
      height: full.height,
    });

    const thumbAsset = await insertAsset(client, {
      userId,
      kind,
      variant: 'thumb',
      storageKey: thumbKey,
      mime: thumb.mime,
      bytes: thumb.buffer.length,
      width: thumb.width,
      height: thumb.height,
      parentId: asset.id,
    });

    return {
      asset,
      thumb: thumbAsset,
      bytes: full.buffer.length + thumb.buffer.length,
      originalBytes,
      savedBytes: Math.max(0, originalBytes - full.buffer.length - thumb.buffer.length),
      buffer: full.buffer, // callers often need the re-encoded bytes downstream
      mime: full.mime,
    };
  } catch (err) {
    // Do not leave bytes on disk that no row points at.
    await storage.remove(fullKey);
    if (thumbKey) await storage.remove(thumbKey);
    throw err;
  }
}

/** Delete an asset (and, by cascade, its thumbnail) plus the files behind it. */
export async function removeAsset(assetId) {
  if (!assetId) return;
  const { rows } = await query(
    `DELETE FROM assets WHERE id = $1 OR parent_id = $1 RETURNING storage_key`,
    [assetId],
  );
  await Promise.all(rows.map((row) => storage.remove(row.storage_key)));
}

/** Remove files for keys written outside a committed transaction. */
export async function rollback(keys) {
  await Promise.all((keys || []).filter(Boolean).map((key) => storage.remove(key)));
}

/**
 * Load an asset with its thumbnail, scoped to an owner. Returns null rather
 * than another account's row.
 */
export async function getAssetPair(assetId, userId) {
  if (!assetId) return null;
  const { rows } = await query(
    `SELECT * FROM assets WHERE (id = $1 OR parent_id = $1) AND user_id = $2`,
    [assetId, userId],
  );
  if (!rows.length) return null;
  return {
    full: rows.find((r) => r.variant === 'full') || null,
    thumb: rows.find((r) => r.variant === 'thumb') || null,
  };
}

/** Read the bytes of a stored asset back (used to re-edit a render). */
export async function readAsset(assetId, userId) {
  const { rows } = await query(
    `SELECT storage_key, mime FROM assets WHERE id = $1 AND user_id = $2 AND variant = 'full'`,
    [assetId, userId],
  );
  if (!rows.length) return null;
  const buffer = await storage.read(rows[0].storage_key);
  return buffer ? { buffer, mime: rows[0].mime } : null;
}

export { MAX_EDGE, THUMB_EDGE };
