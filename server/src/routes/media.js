// Image delivery.
//
// The only way to read an uploaded original or a rendered "after". The URL must
// carry a valid, unexpired signature minted by media.js for a specific file and
// account; anything else is refused. Because <img> cannot send an
// Authorization header, the signature — not the bearer token — is what proves
// the request is allowed.

import { Router } from 'express';
import { stat } from 'node:fs/promises';

import { storage } from '../storage.js';
import { verifySignedRequest } from '../media.js';

const router = Router();

router.get('/:file', async (req, res) => {
  let key;
  try {
    key = verifySignedRequest({
      file: req.params.file,
      u: req.query.u,
      e: req.query.e,
      s: req.query.s,
    });
  } catch (err) {
    return res
      .status(err.status || 403)
      .json({ error: err.message || 'Forbidden.' });
  }

  const absolute = storage.absolutePath(key);
  try {
    await stat(absolute);
  } catch {
    return res.status(404).json({ error: 'That image is no longer stored.' });
  }

  // Private: the URL is per-account and expiring, so shared caches must not
  // hold a copy. The browser may, for as long as the signature is good.
  res.set('Cache-Control', 'private, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(absolute, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Could not read that image.' });
    }
  });
});

export default router;
