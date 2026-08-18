// The taste profile.
//
// Derived, never entered. Starring a board is the only signal a user gives; the
// profile is recomputed from those stars and folded into the next design
// prompt, so the product quietly gets more like the person using it.
//
// It is stored on `users.taste_json` as a cache, but it is always recomputable
// from `favorites` — nothing is lost if the column is cleared.

import { query } from './db.js';

/** Below this, the sample is too small to be worth steering on. */
const MIN_SIGNAL = 2;
const MAX_STYLES = 3;
const MAX_COLORS = 6;

/** Recompute from the user's starred boards and cache it. */
export async function recomputeTaste(userId) {
  const { rows } = await query(
    `SELECT d.style, d.result_json
       FROM favorites f
       JOIN redesigns d ON d.id = f.redesign_id AND d.deleted_at IS NULL
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT 40`,
    [userId],
  );

  if (rows.length < MIN_SIGNAL) {
    const empty = { styles: [], palette: [], sampleSize: rows.length };
    await query('UPDATE users SET taste_json = $2 WHERE id = $1', [userId, empty]);
    return empty;
  }

  // Styles, most-starred first.
  const styleCounts = new Map();
  for (const row of rows) {
    const style = (row.style || '').trim();
    if (style) styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
  }
  const styles = [...styleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_STYLES)
    .map(([style]) => style);

  // Colours that keep reappearing across the boards they liked.
  const colorCounts = new Map();
  for (const row of rows) {
    for (const swatch of row.result_json?.palette || []) {
      const hex = String(swatch?.hex || '').toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(hex)) continue;
      const existing = colorCounts.get(hex) || { hex, name: swatch.name, count: 0 };
      existing.count += 1;
      colorCounts.set(hex, existing);
    }
  }
  const palette = [...colorCounts.values()]
    .filter((c) => c.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_COLORS);

  const taste = { styles, palette, sampleSize: rows.length };
  await query('UPDATE users SET taste_json = $2 WHERE id = $1', [userId, taste]);
  return taste;
}

/** Read the cached profile. Returns null when there is not enough signal. */
export async function tasteFor(userId) {
  const { rows } = await query('SELECT taste_json FROM users WHERE id = $1', [userId]);
  const taste = rows[0]?.taste_json || null;
  if (!taste || !taste.styles?.length) return null;
  return taste;
}

export { MIN_SIGNAL };
