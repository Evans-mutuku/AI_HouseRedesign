import { useMemo, useState } from 'react';

import Icon from '../Icon.jsx';
import { Badge, Meter } from '../ui/Surface.jsx';
import { formatMoney } from '../../lib/format.js';

/**
 * The plan, grouped into what you can do this weekend, this month, and in full.
 *
 * This is the part of the board people actually act on, so it is built as a
 * worklist rather than an article: every buyable line has a checkbox, ticking
 * one records what it really cost, and the totals at the top move as you go.
 *
 * Costs are held in cents throughout — no float ever touches the money path.
 */

const PHASE_ICON = { weekend: Icon.Clock, month: Icon.Projects, full: Icon.Sparkle };
const ACTION_META = {
  keep: { label: 'Keep', tone: 'text-positive', Glyph: Icon.Check },
  remove: { label: 'Remove', tone: 'text-danger', Glyph: Icon.Minus },
  add: { label: 'Add', tone: 'text-accent', Glyph: Icon.Plus },
  move: { label: 'Move', tone: 'text-muted', Glyph: Icon.ArrowRight },
};
const EFFORT_LABEL = {
  easy: 'An hour, alone',
  moderate: 'A weekend',
  trade: 'Needs a trade',
};

export default function PhasedPlan({
  board,
  checklist = [],
  onToggle,
  readOnly = false,
  className = '',
}) {
  const [openPhase, setOpenPhase] = useState(board.phases?.[0]?.id || 'weekend');

  const doneKeys = useMemo(
    () => new Set(checklist.filter((c) => c.done).map((c) => c.key)),
    [checklist],
  );
  const actualByKey = useMemo(
    () => new Map(checklist.map((c) => [c.key, c.actualCostCents])),
    [checklist],
  );

  const currency = board.budget?.currency || 'USD';

  // Buyable lines only — a "keep" costs nothing and cannot be ticked off.
  const buyable = useMemo(() => {
    const planKeys = new Set(
      board.plan.filter((p) => p.action === 'add').map((p) => p.key),
    );
    return [
      ...board.plan.filter((p) => p.action === 'add'),
      ...(board.shoppingList || []).filter((s) => !planKeys.has(s.key)),
    ];
  }, [board]);

  const spentCents = buyable
    .filter((line) => doneKeys.has(line.key))
    .reduce(
      (sum, line) => sum + (actualByKey.get(line.key) ?? line.costCents ?? 0),
      0,
    );

  const budget = board.budget || {};
  const ceiling = budget.budgetCents;
  const planned = budget.totalCents || 0;
  const doneCount = buyable.filter((line) => doneKeys.has(line.key)).length;

  const grouped = (board.phases || []).map((phase) => ({
    ...phase,
    items: board.plan.filter((p) => p.phase === phase.id),
    extras: (board.shoppingList || []).filter(
      (s) =>
        s.phase === phase.id &&
        !board.plan.some((p) => p.key === s.key && p.action === 'add'),
    ),
  }));

  return (
    <div className={className}>
      {/* Money at the top: what it costs, what is left, what you have spent. */}
      <div className="rounded-[14px] border border-line bg-canvas p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow font-semibold uppercase text-muted">
              {ceiling ? 'Planned against your budget' : 'Estimated cost'}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold text-ink tnum">
              {formatMoney(planned, currency)}
              {ceiling ? (
                <span className="ml-2 font-sans text-base font-normal text-muted">
                  of {formatMoney(ceiling, currency)}
                </span>
              ) : null}
            </p>
          </div>

          {ceiling ? (
            budget.withinBudget ? (
              <Badge tone="positive" icon={Icon.CheckCircle}>
                {formatMoney(ceiling - planned, currency)} under
              </Badge>
            ) : (
              <Badge tone="warn" icon={Icon.Alert}>
                {formatMoney(budget.overBy, currency)} over
              </Badge>
            )
          ) : null}
        </div>

        {ceiling ? (
          <Meter percent={(planned / ceiling) * 100} className="mt-5" />
        ) : null}

        <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          {[
            ['weekend', 'This weekend', budget.weekendCents],
            ['month', 'This month', budget.monthCents],
            ['full', 'The full direction', budget.fullCents],
          ].map(([id, label, cents]) => (
            <div key={id}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-0.5 font-display text-lg font-semibold text-ink tnum">
                {formatMoney(cents || 0, currency)}
              </p>
            </div>
          ))}
        </div>

        {!readOnly && buyable.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
            <span className="text-muted">
              {doneCount} of {buyable.length} bought
            </span>
            <span className="font-medium text-ink tnum">
              {formatMoney(spentCents, currency)} spent so far
            </span>
          </div>
        )}

        {budget.note && (
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted">
            {budget.note}
          </p>
        )}
      </div>

      {/* The phases */}
      <div className="mt-5 space-y-3">
        {grouped.map((phase) => {
          const PhaseIcon = PHASE_ICON[phase.id] || Icon.Projects;
          const isOpen = openPhase === phase.id;
          const lines = [...phase.items, ...phase.extras.map((e) => ({ ...e, action: 'add' }))];
          const phaseDone = lines.filter((l) => doneKeys.has(l.key)).length;
          const phaseBuyable = lines.filter((l) => l.action === 'add').length;

          return (
            <section
              key={phase.id}
              className="overflow-hidden rounded-[14px] border border-line bg-canvas"
            >
              <button
                type="button"
                onClick={() => setOpenPhase(isOpen ? null : phase.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-accent">
                  <PhaseIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold text-ink">
                    {phase.title}
                  </span>
                  {phase.summary && (
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                      {phase.summary}
                    </span>
                  )}
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block text-sm font-medium text-ink tnum">
                    {formatMoney(
                      lines.reduce((s, l) => s + (l.costCents || 0), 0),
                      currency,
                    )}
                  </span>
                  {phaseBuyable > 0 && !readOnly && (
                    <span className="block text-xs text-muted tnum">
                      {phaseDone}/{phaseBuyable} done
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <Icon.ChevronDown size={17} />
                </span>
              </button>

              {isOpen && (
                <ul className="hd-fade divide-y divide-line border-t border-line">
                  {lines.map((line) => {
                    const meta = ACTION_META[line.action] || ACTION_META.add;
                    const buyableLine = line.action === 'add';
                    const done = doneKeys.has(line.key);
                    return (
                      <li
                        key={line.key}
                        className={`flex gap-3 px-5 py-4 ${done ? 'bg-surface' : ''}`}
                      >
                        {buyableLine && !readOnly ? (
                          <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={(e) => onToggle?.(line, e.target.checked)}
                              className="h-4 w-4 cursor-pointer accent-[var(--color-ink)]"
                              aria-label={`Mark ${line.item} as bought`}
                            />
                          </label>
                        ) : (
                          <span className={`mt-0.5 shrink-0 ${meta.tone}`}>
                            <meta.Glyph size={15} />
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p
                              className={`font-medium ${done ? 'text-muted line-through' : 'text-ink'}`}
                            >
                              {line.item}
                            </p>
                            {line.costCents > 0 && (
                              <span className="shrink-0 text-sm text-muted tnum">
                                {formatMoney(
                                  actualByKey.get(line.key) ?? line.costCents,
                                  currency,
                                )}
                                {actualByKey.get(line.key) != null && (
                                  <span className="ml-1 text-xs">actual</span>
                                )}
                              </span>
                            )}
                          </div>

                          {(line.rationale || line.note) && (
                            <p className="mt-1 text-sm leading-relaxed text-muted">
                              {line.rationale || line.note}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {!buyableLine && (
                              <span className={`text-eyebrow font-semibold uppercase ${meta.tone}`}>
                                {meta.label}
                              </span>
                            )}
                            {line.effort && (
                              <span className="text-xs text-faint">
                                {EFFORT_LABEL[line.effort] || line.effort}
                              </span>
                            )}
                            {line.searchQuery && (
                              <a
                                href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(line.searchQuery)}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
                              >
                                Find this
                                <Icon.ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
