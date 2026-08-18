import { useId, useState } from 'react';

import Icon from '../Icon.jsx';
import { Badge } from '../ui/Surface.jsx';

/**
 * A plan view of the redesigned room, drawn from the normalised rectangles the
 * model returns.
 *
 * Inline SVG rather than a chart library: it is a dozen rectangles and some
 * labels, it has to print cleanly, and it has to inherit the page's colours.
 * The whole drawing lives in a 0–100 user-space box scaled by the room's real
 * proportions, so a long thin room draws long and thin.
 */

const WALL = 1.6;
const PAD = 6;

/** Openings are drawn in the accent colour; solid masonry in ink. */
const OPENING = new Set(['window', 'door', 'doorway', 'archway', 'skylight']);

export default function FloorPlan({ plan, className = '' }) {
  const titleId = useId();
  const [hovered, setHovered] = useState(null);

  if (!plan || (!plan.features?.length && !plan.furniture?.length)) return null;

  // Keep the drawing proportional to the real room.
  const ratio = plan.lengthM / plan.widthM || 1;
  const W = 100;
  const H = Math.min(180, Math.max(55, 100 * ratio));

  const toX = (v) => PAD + v * (W - PAD * 2);
  const toY = (v) => PAD + v * (H - PAD * 2);
  const toW = (v) => v * (W - PAD * 2);
  const toH = (v) => v * (H - PAD * 2);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-accent">
            <Icon.Layout size={18} />
          </span>
          <p className="text-eyebrow font-semibold uppercase text-muted">Plan view</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">
            {plan.widthM.toFixed(1)} × {plan.lengthM.toFixed(1)} m
          </Badge>
          {plan.confidence === 'estimated' && (
            <Badge tone="warn" icon={Icon.Info}>
              Estimated
            </Badge>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface p-4 sm:p-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={titleId}
          style={{ maxHeight: '70vh' }}
        >
          <title id={titleId}>
            Plan view of the redesigned room, {plan.widthM.toFixed(1)} by{' '}
            {plan.lengthM.toFixed(1)} metres, showing{' '}
            {plan.furniture?.length || 0} pieces of furniture.
          </title>

          {/* Floor */}
          <rect
            x={PAD}
            y={PAD}
            width={W - PAD * 2}
            height={H - PAD * 2}
            fill="var(--color-canvas)"
            stroke="var(--color-ink)"
            strokeWidth={WALL}
          />

          {/* Furniture */}
          {(plan.furniture || []).map((piece, i) => {
            const active = hovered === `f${i}`;
            return (
              <g
                key={`f${i}`}
                onMouseEnter={() => setHovered(`f${i}`)}
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x={toX(piece.x)}
                  y={toY(piece.y)}
                  width={toW(piece.w)}
                  height={toH(piece.h)}
                  rx={1}
                  fill={active ? 'var(--color-accent-soft)' : 'var(--color-sunken)'}
                  stroke={active ? 'var(--color-accent)' : 'var(--color-line-2)'}
                  strokeWidth={0.5}
                />
                <text
                  x={toX(piece.x) + toW(piece.w) / 2}
                  y={toY(piece.y) + toH(piece.h) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={2.4}
                  fill="var(--color-ink-2)"
                  style={{ pointerEvents: 'none' }}
                >
                  {piece.name.length > 16 ? `${piece.name.slice(0, 15)}…` : piece.name}
                </text>
              </g>
            );
          })}

          {/* Openings and masonry, drawn last so they sit on top of the walls */}
          {(plan.features || []).map((feature, i) => {
            const opening = OPENING.has(feature.type);
            return (
              <g key={`x${i}`}>
                <rect
                  x={toX(feature.x)}
                  y={toY(feature.y)}
                  width={Math.max(1, toW(feature.w))}
                  height={Math.max(1, toH(feature.h))}
                  fill={opening ? 'var(--color-accent)' : 'var(--color-ink-2)'}
                />
                <title>
                  {feature.label || feature.type}
                </title>
              </g>
            );
          })}

          {/* Where the photo was taken from */}
          {plan.cameraAt && (
            <g>
              <circle
                cx={toX(plan.cameraAt.x)}
                cy={toY(plan.cameraAt.y)}
                r={1.6}
                fill="var(--color-ink)"
              />
              <text
                x={toX(plan.cameraAt.x)}
                y={toY(plan.cameraAt.y) - 3}
                textAnchor="middle"
                fontSize={2.2}
                fill="var(--color-muted)"
              >
                camera
              </text>
            </g>
          )}
        </svg>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-[1px] bg-accent" />
            Windows and doors
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-[1px] border border-line-2 bg-sunken" />
            Furniture
          </span>
          {plan.confidence === 'estimated' && (
            <span>Dimensions estimated from the photo - measure before buying.</span>
          )}
        </div>
      </div>
    </div>
  );
}
