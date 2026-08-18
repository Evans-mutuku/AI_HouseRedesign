// Small formatters shared by the dashboard. Kept here so "1.2 GB" and
// "12 Aug 2026" read identically everywhere they appear.

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human file size. 0 → "0 MB" so a fresh meter still reads as a size. */
export function formatBytes(bytes, { zeroUnit = 'MB' } = {}) {
  const n = Number(bytes) || 0;
  if (n <= 0) return `0 ${zeroUnit}`;
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = value < 10 && unit > 1 ? 1 : 0;
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** "just now" / "3 hours ago" / a date once it stops being recent. */
export function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export const pluralize = (n, one, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
