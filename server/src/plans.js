// Plans and the storage quota.
//
// Usage is one live SUM over `assets` — the table every stored byte is
// registered in — rather than a counter column, so the number on the dashboard
// can never drift away from what is really on disk. Deleting a project frees
// its space the moment the rows go.
//
// Trashed work still occupies storage, so it still counts; the dashboard breaks
// out how much is recoverable by emptying the trash.

import { query } from './db.js';

const MB = 1024 * 1024;

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    storageBytes: 500 * MB,
    price: 0,
    priceLabel: '$0',
    period: 'forever',
    blurb: 'Enough room for around a hundred redesigns.',
    features: [
      '500 MB of storage — around 500 redesigns once compressed',
      'Unlimited revisions on every room',
      'Rendered "after" image, floor plan, and phased budget',
      'Share links, progress tracking, and PDF export',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    storageBytes: 10 * 1024 * MB, // 10 GB
    price: 12,
    priceLabel: '$12',
    period: 'per month',
    blurb: 'For whole-home projects and client work.',
    features: [
      '10 GB of storage — 20× the free plan',
      'Everything in Free',
      'Whole-home projects with a shared palette',
      'Priority place in the render queue',
    ],
  },
};

export const DEFAULT_PLAN = 'free';

/**
 * Headroom reserved up front so a redesign can never start and then fail to be
 * stored. Everything is re-encoded to WebP (see assets.js), so an original and
 * a render — with their thumbnails — land at roughly 400–900 KB combined. 2 MB
 * is generous cover for a large, detailed render.
 */
export const RENDER_RESERVE_BYTES = 2 * MB;

export function planFor(user) {
  return PLANS[user?.plan] || PLANS[DEFAULT_PLAN];
}

export function isPlanId(value) {
  return Object.prototype.hasOwnProperty.call(PLANS, value);
}

/** Bytes currently stored for a user, across every kind of asset. */
export async function usedBytes(userId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(bytes), 0)::bigint AS used FROM assets WHERE user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.used || 0);
}

/**
 * How much of the usage belongs to soft-deleted work — i.e. what emptying the
 * trash would give back.
 */
export async function trashedBytes(userId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(a.bytes), 0)::bigint AS bytes
       FROM assets a
      WHERE a.user_id = $1
        AND (
          a.id IN (
            SELECT r.photo_asset_id FROM rooms r
             WHERE r.user_id = $1 AND r.deleted_at IS NOT NULL
          )
          OR a.parent_id IN (
            SELECT r.photo_asset_id FROM rooms r
             WHERE r.user_id = $1 AND r.deleted_at IS NOT NULL
          )
          OR a.id IN (
            SELECT d.render_asset_id FROM redesigns d
              JOIN rooms r ON r.id = d.room_id
             WHERE r.user_id = $1 AND (d.deleted_at IS NOT NULL OR r.deleted_at IS NOT NULL)
          )
          OR a.parent_id IN (
            SELECT d.render_asset_id FROM redesigns d
              JOIN rooms r ON r.id = d.room_id
             WHERE r.user_id = $1 AND (d.deleted_at IS NOT NULL OR r.deleted_at IS NOT NULL)
          )
        )`,
    [userId],
  );
  return Number(rows[0]?.bytes || 0);
}

/** The full storage picture for a user, shaped for the API/dashboard. */
export async function storageStatus(user) {
  const plan = planFor(user);
  const [used, trashed] = await Promise.all([
    usedBytes(user.id),
    trashedBytes(user.id),
  ]);
  const limit = plan.storageBytes;
  return {
    used,
    trashed,
    limit,
    remaining: Math.max(0, limit - used),
    percent: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
    plan: plan.id,
    planName: plan.name,
  };
}

export class QuotaError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'QuotaError';
    this.status = status;
  }
}

/**
 * Throw unless `incomingBytes` (plus render headroom) fits in the user's plan.
 * Called before any expensive model work so a doomed request fails fast.
 */
export async function assertHeadroom(user, incomingBytes) {
  const plan = planFor(user);
  const used = await usedBytes(user.id);
  const needed = incomingBytes + RENDER_RESERVE_BYTES;
  if (used + needed <= plan.storageBytes) return { used, plan };

  const err = new QuotaError(
    plan.id === 'free'
      ? 'This redesign would exceed your 500 MB Free storage. Empty your trash, delete a project, or upgrade to Pro for 10 GB.'
      : 'This redesign would exceed your plan storage. Delete a project to free up space.',
    413,
  );
  err.quota = {
    used,
    limit: plan.storageBytes,
    needed,
    plan: plan.id,
  };
  throw err;
}

export { MB };
