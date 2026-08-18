import { useState } from 'react';

import Icon from '../Icon.jsx';

/**
 * The "before" photo with the designer's read pinned onto it.
 *
 * Prose about "the cool overhead light" makes you hunt for the lamp; a marker
 * on the lamp does not. Pins are positioned from normalised coordinates, so
 * they stay correct at every width.
 *
 * Each pin is a real button: tab to it, read the note, move on. On touch, the
 * note opens on tap rather than hover.
 */
export default function AnnotatedPhoto({ src, annotations = [], className = '' }) {
  const [open, setOpen] = useState(null);

  if (!src) return null;
  const pins = annotations.filter((a) => a.title);

  return (
    <div className={className}>
      <figure className="relative overflow-hidden rounded-[14px] border border-line bg-sunken">
        <img src={src} alt="The room before redesign" className="block h-auto w-full" />

        {pins.map((pin, i) => {
          const isOpen = open === i;
          const issue = pin.severity !== 'asset';
          // Flip the callout toward the middle so it never runs off an edge.
          const flipX = pin.x > 0.62;
          const flipY = pin.y > 0.7;

          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                onMouseEnter={() => setOpen(i)}
                onMouseLeave={() => setOpen((cur) => (cur === i ? null : cur))}
                aria-expanded={isOpen}
                aria-label={`${issue ? 'Issue' : 'Working well'}: ${pin.title}`}
                className={`-translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold shadow-[0_2px_8px_rgba(20,19,15,0.3)] transition-transform hover:scale-110 ${
                  issue
                    ? 'border-canvas bg-accent text-canvas'
                    : 'border-canvas bg-positive text-canvas'
                }`}
              >
                {i + 1}
              </button>

              {isOpen && (
                <div
                  className="hd-fade absolute z-10 w-56 rounded-[10px] border border-line bg-canvas p-3 shadow-[0_8px_24px_rgba(20,19,15,0.18)]"
                  style={{
                    left: flipX ? 'auto' : '14px',
                    right: flipX ? '14px' : 'auto',
                    top: flipY ? 'auto' : '14px',
                    bottom: flipY ? '14px' : 'auto',
                  }}
                >
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <span className={issue ? 'text-accent' : 'text-positive'}>
                      {issue ? <Icon.Alert size={13} /> : <Icon.CheckCircle size={13} />}
                    </span>
                    {pin.title}
                  </p>
                  {pin.note && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{pin.note}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </figure>

      {pins.length > 0 && (
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {pins.map((pin, i) => {
            const issue = pin.severity !== 'asset';
            return (
              <li key={i} className="flex gap-2.5 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-canvas ${
                    issue ? 'bg-accent' : 'bg-positive'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">
                  <span className="font-medium text-ink">{pin.title}</span>
                  {pin.note && <span className="text-muted"> - {pin.note}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
