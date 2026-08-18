import { useState } from 'react';

import Reveal from './Reveal.jsx';
import Icon from './Icon.jsx';
import { Palette } from './Swatches.jsx';
import { Badge, Banner, Eyebrow } from './ui/Surface.jsx';

// Use the concept's first sentence as the headline and the remainder as the
// lead — an editorial move that keeps the big type short.
function splitConcept(text) {
  const t = String(text || '').trim();
  const match = t.match(/^(.+?[.!?])\s+(.*)$/s);
  if (match && match[1].length <= 92) return { headline: match[1], lead: match[2] };
  if (t.length <= 92) return { headline: t, lead: '' };
  return { headline: '', lead: t };
}

const ACTION_META = {
  keep: { label: 'Keep', Glyph: Icon.Check, tone: 'text-positive' },
  remove: { label: 'Remove', Glyph: Icon.Minus, tone: 'text-danger' },
  add: { label: 'Add', Glyph: Icon.Plus, tone: 'text-accent' },
};

function Section({ eyebrow, icon: SectionIcon, title, children, className = '' }) {
  return (
    <Reveal as="section" className={`border-t border-line py-10 sm:py-14 ${className}`}>
      <div className="mb-7 flex items-center gap-2.5">
        {SectionIcon && (
          <span className="text-accent">
            <SectionIcon size={18} />
          </span>
        )}
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      {title && (
        <h2 className="mb-7 max-w-3xl font-display text-title font-semibold text-ink">
          {title}
        </h2>
      )}
      {children}
    </Reveal>
  );
}

function FurnitureGroup({ action, items }) {
  if (!items.length) return null;
  const { label, Glyph, tone } = ACTION_META[action];
  return (
    <div>
      <div className="mb-5 flex items-center gap-2 border-b border-line pb-3">
        <span className={tone}>
          <Glyph size={15} />
        </span>
        <span className="text-eyebrow font-semibold uppercase text-ink">{label}</span>
        <span className="ml-auto font-mono text-xs text-faint tnum">
          {String(items.length).padStart(2, '0')}
        </span>
      </div>
      <ul className="space-y-5">
        {items.map((item, i) => (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-base font-semibold leading-snug text-ink">
                {item.item}
              </p>
              {item.approxBudget && (
                <span className="shrink-0 font-mono text-xs text-muted tnum">
                  {item.approxBudget}
                </span>
              )}
            </div>
            {item.rationale && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {item.rationale}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Before/after with a toggle, so the two images occupy the same frame. */
function BeforeAfter({ beforeUrl, afterUrl }) {
  const [view, setView] = useState('after');
  const showing = view === 'after' ? afterUrl : beforeUrl;

  return (
    <figure className="overflow-hidden rounded-[14px] border border-line bg-sunken">
      <div className="relative">
        <img
          key={view}
          src={showing}
          alt={
            view === 'after'
              ? 'The room reimagined in the new design direction'
              : 'The room before redesign'
          }
          className="hd-fade h-auto w-full object-cover"
        />
        <div className="absolute left-3 top-3 inline-flex rounded-full border border-line bg-canvas/90 p-1 backdrop-blur-sm">
          {['before', 'after'].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === option ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <figcaption className="flex items-center justify-between border-t border-line bg-canvas px-4 py-3">
        <span className="text-eyebrow font-semibold uppercase text-muted">
          {view === 'after' ? 'After — a render of the redesign' : 'Before — your photo'}
        </span>
        {view === 'after' && (
          <Badge tone="neutral" icon={Icon.Sparkle}>
            AI render
          </Badge>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * The board itself. Pure presentation — it receives an already-fetched
 * redesign and its signed image URLs, and renders whatever sections the model
 * actually returned.
 */
export default function DesignBoard({ data, beforeUrl, afterUrl, imageError }) {
  const r = data;
  const { headline, lead } = splitConcept(r.designConcept);
  const groups = {
    keep: r.furniture.filter((f) => f.action === 'keep'),
    remove: r.furniture.filter((f) => f.action === 'remove'),
    add: r.furniture.filter((f) => f.action === 'add'),
  };

  return (
    <article>
      {/* Masthead */}
      <header className="hd-rise pb-10">
        {headline && (
          <h2 className="max-w-4xl font-display text-display font-semibold text-ink">
            {headline}
          </h2>
        )}
        {lead && <p className="text-lead mt-5 max-w-2xl text-ink-2">{lead}</p>}
      </header>

      {/* The images */}
      <Reveal as="section" className="border-t border-line py-10 sm:py-14">
        {afterUrl ? (
          <BeforeAfter beforeUrl={beforeUrl} afterUrl={afterUrl} />
        ) : (
          <>
            <Eyebrow className="mb-4">Before</Eyebrow>
            <figure className="overflow-hidden rounded-[14px] border border-line bg-sunken">
              <img
                src={beforeUrl}
                alt="The room before redesign"
                className="h-auto w-full object-cover"
              />
            </figure>
            {imageError && (
              <Banner tone="info" className="mt-4">
                {imageError} The written direction below still applies.
              </Banner>
            )}
          </>
        )}
      </Reveal>

      {/* Palette */}
      <Section eyebrow="The palette" icon={Icon.Palette} title="Pulled from the room">
        <Palette palette={r.palette} animate />
      </Section>

      {/* The read */}
      {r.currentAssessment && (
        <Section eyebrow="The read" icon={Icon.Info}>
          <p className="text-lead max-w-2xl text-ink-2">{r.currentAssessment}</p>
        </Section>
      )}

      {/* The plan */}
      {r.furniture.length > 0 && (
        <Section eyebrow="The plan" icon={Icon.Layout}>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            <FurnitureGroup action="keep" items={groups.keep} />
            <FurnitureGroup action="remove" items={groups.remove} />
            <FurnitureGroup action="add" items={groups.add} />
          </div>
        </Section>
      )}

      {/* Materials + lighting */}
      {(r.materials.length > 0 || r.lighting) && (
        <Reveal as="section" className="grid gap-10 border-t border-line py-10 sm:grid-cols-2 sm:py-14">
          {r.materials.length > 0 && (
            <div>
              <div className="mb-6 flex items-center gap-2.5">
                <span className="text-accent">
                  <Icon.Materials size={18} />
                </span>
                <Eyebrow>Materials</Eyebrow>
              </div>
              <dl className="space-y-5">
                {r.materials.map((material, i) => (
                  <div key={i}>
                    <dt className="font-display text-base font-semibold text-ink">
                      {material.name}
                    </dt>
                    {material.where && (
                      <dd className="mt-1 text-sm leading-relaxed text-muted">
                        {material.where}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          )}
          {r.lighting && (
            <div>
              <div className="mb-6 flex items-center gap-2.5">
                <span className="text-accent">
                  <Icon.Lighting size={18} />
                </span>
                <Eyebrow>Lighting</Eyebrow>
              </div>
              <p className="text-lead text-ink-2">{r.lighting}</p>
            </div>
          )}
        </Reveal>
      )}

      {/* Layout */}
      {r.layoutNotes && (
        <Section eyebrow="Layout" icon={Icon.Layout}>
          <p className="max-w-3xl font-display text-title font-semibold leading-snug text-ink">
            {r.layoutNotes}
          </p>
        </Section>
      )}

      {/* Decor */}
      {r.decor.length > 0 && (
        <Section eyebrow="Decor" icon={Icon.Sparkle}>
          <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {r.decor.map((item, i) => (
              <li key={i} className="flex gap-3 border-b border-line pb-4">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span className="text-sm leading-relaxed">
                  <span className="text-ink">{item.item}</span>
                  {item.note && <span className="text-muted"> — {item.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Shopping list */}
      {r.shoppingList.length > 0 && (
        <Section eyebrow="Shopping list" icon={Icon.Shopping}>
          <ul className="divide-y divide-line border-y border-line">
            {r.shoppingList.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-6 py-4">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-ink">
                    {item.item}
                  </p>
                  {item.note && (
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {item.note}
                    </p>
                  )}
                </div>
                {item.priceTier && (
                  <span className="shrink-0 text-eyebrow font-semibold uppercase text-muted">
                    {item.priceTier}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
