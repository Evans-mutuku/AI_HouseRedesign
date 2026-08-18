// Row → API response shaping, in one place.
//
// Every image URL in the product is minted here, and always against a userId
// the caller proved they are - never a value carried on the row. Keeping that
// in a single module means there is exactly one line to audit for "could this
// hand out someone else's picture".

import { signedUrl } from './media.js';

/** { url, thumbUrl, width, height } for an asset joined with its thumbnail. */
export function imageOf(row, userId, prefix = '') {
  const key = row?.[`${prefix}storage_key`];
  if (!key) return null;
  return {
    url: signedUrl(key, userId),
    thumbUrl: row[`${prefix}thumb_key`]
      ? signedUrl(row[`${prefix}thumb_key`], userId)
      : signedUrl(key, userId),
    width: row[`${prefix}width`] ?? null,
    height: row[`${prefix}height`] ?? null,
  };
}

/** The SELECT fragment that joins an asset and its thumbnail. */
export const assetJoin = (alias, column, prefix) => `
  LEFT JOIN assets ${alias}      ON ${alias}.id = ${column}
  LEFT JOIN assets ${alias}_t    ON ${alias}_t.parent_id = ${alias}.id AND ${alias}_t.variant = 'thumb'
`;

export const assetSelect = (alias, prefix) => `
  ${alias}.storage_key   AS ${prefix}storage_key,
  ${alias}.width         AS ${prefix}width,
  ${alias}.height        AS ${prefix}height,
  ${alias}_t.storage_key AS ${prefix}thumb_key
`;

/** A room in a list: enough for a card, no board JSON. */
export const roomCard = (row, userId) => ({
  id: row.id,
  name: row.name || row.room_type || 'Room',
  roomType: row.room_type,
  homeId: row.home_id,
  homeName: row.home_name || null,
  photo: imageOf(row, userId, 'photo_'),
  render: imageOf(row, userId, 'render_'),
  revisionCount: Number(row.revision_count || 0),
  latestRedesignId: row.latest_redesign_id || null,
  concept: row.concept || '',
  style: row.style || '',
  budgetCents: row.budget_cents == null ? null : Number(row.budget_cents),
  currency: row.currency || 'USD',
  bytes: Number(row.bytes || 0),
  createdAt: row.created_at,
  updatedAt: row.last_activity || row.created_at,
  deletedAt: row.deleted_at || null,
});

/** One revision, with its board. */
export const redesignFull = (row, userId) => ({
  id: row.id,
  roomId: row.room_id,
  title: row.title || row.result_json?.roomType || 'Redesign',
  revisionNo: row.revision_no,
  parentId: row.parent_id,
  instruction: row.instruction,
  style: row.style,
  budgetCents: row.budget_cents == null ? null : Number(row.budget_cents),
  currency: row.currency || 'USD',
  userNote: row.user_note,
  model: row.model,
  region: row.mask_json || null,
  fidelity: row.fidelity_json || null,
  favorited: Boolean(row.favorited),
  shareToken: row.share_token || null,
  render: imageOf(row, userId, 'render_'),
  createdAt: row.created_at,
  board: row.result_json,
});

/** A revision in the timeline: no board payload. */
export const redesignSummary = (row, userId) => ({
  id: row.id,
  revisionNo: row.revision_no,
  parentId: row.parent_id,
  instruction: row.instruction,
  style: row.style,
  title: row.title,
  favorited: Boolean(row.favorited),
  hasRender: Boolean(row.render_storage_key),
  fidelityOk: row.fidelity_json ? row.fidelity_json.ok !== false : null,
  render: imageOf(row, userId, 'render_'),
  budgetTotalCents: row.result_json?.budget?.totalCents ?? null,
  currency: row.currency || 'USD',
  createdAt: row.created_at,
});
