import { readableOn } from '../lib/color.js';

// The palette is a visual hero of the result: real, sizeable swatches from the
// returned hex values, labelled with name and role.

export function Palette({ palette, animate = false }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {palette.map((color, i) => (
        <div
          key={`${color.hex}-${i}`}
          className={`flex flex-col bg-canvas ${animate ? 'hd-swatch' : ''}`}
          style={animate ? { animationDelay: `${i * 70}ms` } : undefined}
        >
          <div
            className="flex h-28 items-end p-3 sm:h-40"
            style={{ backgroundColor: color.hex, color: readableOn(color.hex) }}
          >
            <span className="font-mono text-[11px] uppercase opacity-75">
              {color.hex}
            </span>
          </div>
          <div className="px-3.5 pb-4 pt-3">
            <p className="font-display text-base font-semibold leading-tight text-ink">
              {color.name}
            </p>
            {color.role && (
              <p className="mt-1 text-xs leading-snug text-muted">{color.role}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact horizontal strip — used where vertical space is tight. */
export function PaletteRow({ palette, className = '' }) {
  return (
    <div className={`flex overflow-hidden rounded-[10px] border border-line ${className}`}>
      {palette.map((color, i) => (
        <div
          key={`${color.hex}-${i}`}
          className="flex h-16 flex-1 items-end p-2 sm:h-20"
          style={{ backgroundColor: color.hex, color: readableOn(color.hex) }}
          title={`${color.name} · ${color.hex}`}
        >
          <span className="font-mono text-[10px] uppercase opacity-70">
            {color.hex}
          </span>
        </div>
      ))}
    </div>
  );
}
