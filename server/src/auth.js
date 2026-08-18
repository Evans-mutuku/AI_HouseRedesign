// Firebase authentication.
//
// The browser signs in with the Firebase Web SDK and sends the resulting ID
// token as `Authorization: Bearer <token>`. Here we verify that token
// cryptographically against Google's published signing keys and map it to a row
// in `users`. Every data route hangs off `req.user.id` that this produces —
// there is no client-supplied identifier anywhere in the system, so a caller
// cannot ask for another account's rooms, redesigns, or images.
//
// Verification is done directly against the Firebase JWKS rather than through
// firebase-admin: it needs only the public project id (no service-account key
// to distribute or leak) and performs the same checks firebase-admin's
// verifyIdToken does — RS256 signature against Google's rotating keys, plus
// issuer, audience, and expiry. The one thing it does not do is consult the
// revocation list, so a token stays valid for its (max 1 hour) lifetime even if
// the session is revoked server-side.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { query } from './db.js';

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';

if (!PROJECT_ID) {
  console.warn(
    '[auth] FIREBASE_PROJECT_ID is not set — every authenticated request will 503.',
  );
}

// Cached across requests; jose refetches on key rotation / unknown `kid`.
const jwks = createRemoteJWKSet(new URL(JWKS_URL), {
  cacheMaxAge: 10 * 60 * 1000,
  cooldownDuration: 30 * 1000,
});

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export function authConfigured() {
  return Boolean(PROJECT_ID);
}

/** Verify a Firebase ID token. Returns its claims, or throws AuthError. */
export async function verifyIdToken(token) {
  if (!PROJECT_ID) {
    throw new AuthError('Authentication is not configured on the server.', 503);
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      clockTolerance: 10, // seconds
    }));
  } catch (err) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      throw new AuthError('Your session expired. Please sign in again.');
    }
    throw new AuthError('Invalid or expired sign-in token.');
  }

  // `sub` is the Firebase uid. Firebase also sets auth_time; both must exist on
  // a real ID token (as opposed to a custom token or an access token).
  const uid = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!uid || !payload.auth_time) {
    throw new AuthError('That token is not a Firebase ID token.');
  }
  return payload;
}

/**
 * Find-or-create the `users` row for a verified token, keeping the cached
 * profile fields in step with Firebase. Returns the full row.
 */
export async function resolveUser(claims) {
  const uid = claims.sub;
  const email = typeof claims.email === 'string' ? claims.email.slice(0, 320) : null;
  const name = typeof claims.name === 'string' ? claims.name.slice(0, 120) : null;
  const photo = typeof claims.picture === 'string' ? claims.picture.slice(0, 1000) : null;

  const { rows } = await query(
    `INSERT INTO users (firebase_uid, email, display_name, photo_url, last_seen_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (firebase_uid) WHERE firebase_uid IS NOT NULL
     DO UPDATE SET
       email        = COALESCE(EXCLUDED.email, users.email),
       display_name = COALESCE(EXCLUDED.display_name, users.display_name),
       photo_url    = COALESCE(EXCLUDED.photo_url, users.photo_url),
       last_seen_at = now()
     RETURNING *`,
    [uid, email, name, photo],
  );
  return rows[0];
}

function bearer(req) {
  const header = req.get('authorization') || '';
  const [scheme, ...rest] = header.split(' ');
  if (!/^bearer$/i.test(scheme)) return '';
  return rest.join(' ').trim();
}

/**
 * Express middleware. Populates `req.user` (the DB row) and `req.claims`, or
 * ends the request with a JSON 401/503. Mount it on everything that touches
 * user data.
 */
export async function requireAuth(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) {
      throw new AuthError('Sign in to continue.');
    }
    const claims = await verifyIdToken(token);
    req.claims = claims;
    req.user = await resolveUser(claims);
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[auth]', err);
    return res.status(500).json({ error: 'Could not verify your session.' });
  }
}
