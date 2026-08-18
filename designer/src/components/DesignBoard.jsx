import Reveal from './Reveal.jsx';
import Icon from './Icon.jsx';
import { Palette } from './Swatches.jsx';
import { Banner, Eyebrow } from './ui/Surface.jsx';
import BeforeAfter from './board/BeforeAfter.jsx';
import AnnotatedPhoto from './board/AnnotatedPhoto.jsx';
import FloorPlan from './board/FloorPlan.jsx';
import PhasedPlan from './board/PhasedPlan.jsx';
import PaintMatches from './board/PaintMatches.jsx';

// Use the concept's first sentence as the headline and the remainder as the
// lead — an editorial move that keeps the big type short.
function splitConcept(text) {
  const t = String(text || '').trim();
  const match = t.match(/^(.+?[.!?])\s+(.*)$/s);
  if (match && match[1].length <= 92) return { headline: match[1], lead: match[2] };
  if (t.length <= 92) return { headline: t, lead: '' };
  return { headline: '', lead: t };
}

function Section({ eyebrow, icon: SectionIcon, title, children, className = '' }) {
  return (
    <Reveal as="section" className={`border-t border-line py-10 sm:py-14 ${className}`}>
      <div className="mb-6 flex items-center gap-2.5">
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

/**
 * The board. Pure presentation — it takes an already-fetched revision and
 * renders whatever the model actually returned, skipping any section that came
 * back empty.
 *
 * Shared by the dashboard and the public share page; `readOnly` drops the
 * interactive checklist for visitors who have nothing to tick.
 */
export default function DesignBoard({
  board,
  beforeUrl,
  afterUrl,
  annotations = [],
  paints = null,
  checklist = [],
  onToggleChecklist,
  onPaintBrandChange,
  fidelity = null,
  imageError,
  readOnly = false,
}) {
  const { headline, lead } = splitConcept(board.designConcept);

  return (
    <article>
      {/* Masthead */}
      <header className="hd-rise pb-8">
        {headline && (
          <h2 className="max-w-4xl font-display text-display font-semibold text-ink">
            {headline}
          </h2>
        )}
        {lead && <p className="text-lead mt-5 max-w-2xl text-ink-2">{lead}</p>}
        {board.revisionNote && (
          <Banner tone="accent" className="mt-6" title="What changed in this revision">
            {board.revisionNote}
          </Banner>
        )}
      </header>

      {/* The comparison */}
      <Reveal as="section" className="border-t border-line py-10 sm:py-14">
        <BeforeAfter beforeUrl={beforeUrl} afterUrl={afterUrl} />
        {imageError && (
          <Banner tone="info" className="mt-4">
            {imageError} The written direction below still applies.
          </Banner>
        )}
        {fidelity && !fidelity.ok && fidelity.missing?.length > 0 && (
          <Banner
            tone="warn"
            className="mt-4"
            title="The render did not keep everything"
          >
            Our check found{' '}
            {fidelity.missing.map((m) => `the ${m.type} was ${m.problem}`).join(', ')}
            . The written plan is unaffected — ask for a revision to try the render
            again.
          </Banner>
        )}
      </Reveal>

      {/* Palette */}
      <Section eyebrow="The palette" icon={Icon.Palette} title="Pulled from the room">
        <Palette palette={board.palette} animate />
      </Section>

      {/* Paint matching */}
      {paints?.swatches?.length > 0 && (
        <Reveal as="section" className="border-t border-line py-10 sm:py-14">
          <PaintMatches data={paints} onBrandChange={onPaintBrandChange} />
        </Reveal>
      )}

      {/* The plan — costed and phased */}
      {board.plan?.length > 0 && (
        <Section eyebrow="The plan" icon={Icon.Layout}>
          <PhasedPlan
            board={board}
            checklist={checklist}
            onToggle={onToggleChecklist}
            readOnly={readOnly}
          />
        </Section>
      )}

      {/* Plan view */}
      {board.floorPlan && (
        <Reveal as="section" className="border-t border-line py-10 sm:py-14">
          <FloorPlan plan={board.floorPlan} />
          {board.layoutNotes && (
            <p className="mt-5 max-w-3xl text-lead text-ink-2">{board.layoutNotes}</p>
          )}
        </Reveal>
      )}

      {/* The read, pinned to the photo */}
      {annotations?.length > 0 && beforeUrl && (
        <Section eyebrow="The read" icon={Icon.Info} title="What the room is doing now">
          <AnnotatedPhoto src={beforeUrl} annotations={annotations} />
        </Section>
      )}

      {/* Materials + lighting */}
      {(board.materials?.length > 0 || board.lighting) && (
        <Reveal
          as="section"
          className="grid gap-10 border-t border-line py-10 sm:grid-cols-2 sm:py-14"
        >
          {board.materials?.length > 0 && (
            <div>
              <div className="mb-6 flex items-center gap-2.5">
                <span className="text-accent">
                  <Icon.Materials size={18} />
                </span>
                <Eyebrow>Materials</Eyebrow>
              </div>
              <dl className="space-y-5">
                {board.materials.map((material, i) => (
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
          {board.lighting && (
            <div>
              <div className="mb-6 flex items-center gap-2.5">
                <span className="text-accent">
                  <Icon.Lighting size={18} />
                </span>
                <Eyebrow>Lighting</Eyebrow>
              </div>
              <p className="text-lead text-ink-2">{board.lighting}</p>
            </div>
          )}
        </Reveal>
      )}

      {/* Decor */}
      {board.decor?.length > 0 && (
        <Section eyebrow="Decor" icon={Icon.Sparkle}>
          <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {board.decor.map((item, i) => (
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
    </article>
  );
}
