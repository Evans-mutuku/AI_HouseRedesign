import { useEffect, useState } from 'react';

import Icon from '../Icon.jsx';
import { Badge } from '../ui/Surface.jsx';
import { Segmented } from '../ui/Field.jsx';
import { readableOn } from '../../lib/color.js';

/**
 * Each palette colour matched to real, stocked paint.
 *
 * The honesty of this feature matters more than its cleverness: the hex values
 * behind the catalogue are screen approximations, not colorimetric data, so
 * every match carries how close it actually is and the panel leads with the
 * server's disclaimer. A "near" match presented as exact would send someone to
 * a shop to buy the wrong tin.
 */

const CONFIDENCE = {
  exact: { label: 'Very close', tone: 'positive' },
  close: { label: 'Close', tone: 'positive' },
  near: { label: 'Near', tone: 'warn' },
  approximate: { label: 'Approximate', tone: 'neutral' },
};

export default function PaintMatches({ data, onBrandChange, className = '' }) {
  const [brand, setBrand] = useState('');

  useEffect(() => {
    onBrandChange?.(brand);
  }, [brand, onBrandChange]);

  if (!data?.swatches?.length) return null;

  return (
    <div className={className}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-accent">
            <Icon.Palette size={18} />
          </span>
          <p className="text-eyebrow font-semibold uppercase text-muted">Paint matches</p>
        </div>

        {data.brands?.length > 1 && (
          <Segmented
            label="Paint brand"
            value={brand}
            onChange={setBrand}
            options={[
              { value: '', label: 'All' },
              ...data.brands.map((b) => ({ value: b, label: b.split(' ')[0] })),
            ]}
          />
        )}
      </div>

      <div className="space-y-3">
        {data.swatches.map((swatch) => (
          <div
            key={swatch.hex}
            className="overflow-hidden rounded-[14px] border border-line bg-canvas"
          >
            <div className="flex flex-col sm:flex-row">
              <div
                className="flex min-h-[76px] items-end justify-between p-4 sm:w-52 sm:shrink-0"
                style={{ backgroundColor: swatch.hex, color: readableOn(swatch.hex) }}
              >
                <span>
                  <span className="block text-sm font-semibold">{swatch.name}</span>
                  {swatch.role && (
                    <span className="block text-xs opacity-75">{swatch.role}</span>
                  )}
                </span>
                <span className="font-mono text-[10px] uppercase opacity-70">
                  {swatch.hex}
                </span>
              </div>

              <ul className="flex-1 divide-y divide-line">
                {swatch.matches.map((match) => {
                  const conf = CONFIDENCE[match.confidence] || CONFIDENCE.approximate;
                  return (
                    <li
                      key={`${match.brand}-${match.code}-${match.name}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-full border border-line"
                        style={{ backgroundColor: match.hex }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {match.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {match.brand}
                          {match.code ? ` · ${match.code}` : ''}
                        </span>
                      </span>
                      <Badge tone={conf.tone}>{conf.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <span className="mt-0.5 shrink-0">
          <Icon.Info size={14} />
        </span>
        {data.disclaimer}
      </p>
    </div>
  );
}
