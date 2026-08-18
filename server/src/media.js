// Signed, expiring URLs for user images.
//
// Uploads used to be served by a blanket express.static mount, which meant
// anyone who learned (or guessed) a filename could fetch another account's
// room photo. Instead nothing under /uploads is public: the API hands back
// short-lived signed URLs, minted for one user and one file, and
// GET /api/media/:file verifies the signature before streaming the bytes.
//
// This keeps <img src> working — the browser cannot attach an Authorization
// header to an image request — without leaving the files open to the world.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PUBLIC_PREFIX } from './storage.js';

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// A stable secret keeps previously issued URLs valid across restarts. Without
// one we still sign (never serve unsigned), but links die with the process.
const SECRET =
  process.env.MEDIA_SIGNING_SECRET ||
  (() => {
    console.warn(
      '[media] MEDIA_SIGNING_SECRET is not set — using an ephemeral key. Image links will break on restart.',
    );
    return randomBytes(32).toString('hex');
  })();

// Storage keys look like "/uploads/<uuid>.<ext>"; only that shape is signable,
// which also rules out traversal ("../") reaching the filesystem route.
const FILE_RE = /^[A-Za-z0-9._-]{1,128}$/;

const fileNameOf = (key) => String(key || '').replace(`${PUBLIC_PREFIX}/`, '');

function sign(file, userId, expires) {
  return createHmac('sha256', SECRET)
    .update(`${file}\n${userId}\n${expires}`)
    .digest('hex');
}

/**
 * Mint a signed URL for `key`, readable only until it expires. Returns null for
 * a missing/misshapen key so callers can pass it straight through.
 */
export function signedUrl(key, userId, ttlMs = DEFAULT_TTL_MS) {
  const file = fileNameOf(key);
  if (!file || !FILE_RE.test(file) || !userId) return null;
  const expires = Date.now() + ttlMs;
  const sig = sign(file, userId, expires);
  return `/api/media/${file}?u=${userId}&e=${expires}&s=${sig}`;
}

/**
 * Validate a signed request. Returns the storage key on success, or throws an
 * Error with `.status` set.
 */
export function verifySignedRequest({ file, u, e, s }) {
  const fail = (message, status = 403) => {
    const err = new Error(message);
    err.status = status;
    return err;
  };

  if (!file || !FILE_RE.test(file)) throw fail('Not found.', 404);
  if (!u || !e || !s) throw fail('This image link is not signed.');

  const expires = Number(e);
  if (!Number.isFinite(expires)) throw fail('This image link is malformed.');
  if (Date.now() > expires) throw fail('This image link has expired.');

  const expected = Buffer.from(sign(file, u, expires), 'utf8');
  const given = Buffer.from(String(s), 'utf8');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw fail('This image link is not valid.');
  }
  return `${PUBLIC_PREFIX}/${file}`;
}

export { DEFAULT_TTL_MS };
