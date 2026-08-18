import Icon from '../Icon.jsx';
import { Badge } from '../ui/Surface.jsx';
import { formatRelative, formatMoney } from '../../lib/format.js';

/**
 * The room's revision history, newest first.
 *
 * A room is a conversation now, not a single output, so the history has to be
 * first-class: every version stays selectable, the instruction that produced it
 * is shown next to it, and nothing is overwritten. Going back to revision 2 and
 * branching from there is a click.
 */
export default function RevisionTimeline({
  revisions = [],
  selectedId,
  onSelect,
  className = '',
}) {
  if (!revisions.length) return null;

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-eyebrow font-semibold uppercase text-muted">
          Revisions
        </p>
        <span className="font-mono text-xs text-faint tnum">
          {String(revisions.length).padStart(2, '0')}
        </span>
      </div>

      <ol className="relative space-y-2">
        {/* The spine, drawn behind the entries. */}
        {revisions.length > 1 && (
          <span
            className="absolute left-[19px] top-4 bottom-4 w-px bg-line"
            aria-hidden="true"
          />
        )}

        {revisions.map((revision, i) => {
          const selected = revision.id === selectedId;
          const latest = i === 0;
          return (
            <li key={revision.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect?.(revision.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-start gap-3 rounded-[12px] border p-3 text-left transition-colors ${
                  selected
                    ? 'border-ink bg-canvas'
                    : 'border-transparent hover:border-line hover:bg-surface'
                }`}
              >
                <span
                  className={`relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tnum ${
                    selected
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-line bg-canvas text-muted'
                  }`}
                >
                  {revision.revisionNo}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {revision.instruction ? 'Revised' : 'First direction'}
                    </span>
                    {latest && <Badge tone="accent">Latest</Badge>}
                    {revision.favorited && (
                      <span className="text-accent" title="Favourited">
                        <Icon.Sparkle size={13} />
                      </span>
                    )}
                    {revision.fidelityOk === false && (
                      <span className="text-warn" title="The render dropped something">
                        <Icon.Alert size={13} />
                      </span>
                    )}
                  </span>

                  {revision.instruction && (
                    <span className="mt-0.5 block line-clamp-2 text-sm leading-relaxed text-muted">
                      “{revision.instruction}”
                    </span>
                  )}

                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint tnum">
                    <span>{formatRelative(revision.createdAt)}</span>
                    {revision.style && <span>{revision.style}</span>}
                    {revision.budgetTotalCents > 0 && (
                      <span>{formatMoney(revision.budgetTotalCents, revision.currency)}</span>
                    )}
                  </span>
                </span>

                {revision.render?.thumbUrl && (
                  <span className="h-12 w-16 shrink-0 overflow-hidden rounded-[8px] border border-line bg-sunken">
                    <img
                      src={revision.render.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
