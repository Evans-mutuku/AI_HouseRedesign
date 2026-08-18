// Pick readable text (ink or canvas) for a given swatch background via WCAG
// relative luminance. Values match --color-ink / --color-canvas in index.css.
export function readableOn(hex) {
  const h = String(hex || '').replace('#', '');
  const full =
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? '#14130f' : '#ffffff';
}
