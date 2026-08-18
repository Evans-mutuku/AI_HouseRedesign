import { useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import {
  Badge,
  Banner,
  Card,
  DataRow,
  Eyebrow,
  Meter,
  SectionHeader,
} from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import { listRedesigns, setPlan as setPlanRequest } from '../../lib/api.js';
import { formatBytes, pluralize } from '../../lib/format.js';
import { useResource } from '../../lib/useResource.js';
import { useAuth } from '../../lib/authContext.js';

/** The plans, in the order they should be shown. */
const ORDER = ['free', 'pro'];

export default function StoragePlan() {
  const { storage, plan, plans, setAccount, refreshAccount } = useAuth();

  const { data: projects } = useResource(listRedesigns);

  const [pendingPlan, setPendingPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const catalog = ORDER.map((id) => plans.find((p) => p.id === id)).filter(Boolean);

  // The heaviest few projects — the fastest way to reclaim space.
  const heaviest = [...(projects || [])]
    .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
    .slice(0, 5);

  const changePlan = async () => {
    if (!pendingPlan) return;
    setBusy(true);
    setError('');
    try {
      const result = await setPlanRequest(pendingPlan.id);
      setAccount((prev) =>
        prev ? { ...prev, user: result.user, storage: result.storage } : prev,
      );
      refreshAccount().catch(() => {});
      setNotice(
        pendingPlan.id === 'pro'
          ? 'You are on Pro. Your storage limit is now 10 GB.'
          : 'You are back on the Free plan. Your work is untouched.',
      );
      setPendingPlan(null);
    } catch (err) {
      setError(err.message);
      setPendingPlan(null);
    } finally {
      setBusy(false);
    }
  };

  const percent = storage?.percent ?? 0;
  const tone = percent >= 95 ? 'danger' : percent >= 80 ? 'warn' : null;

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Storage & plan"
        description="Every original photo and every render counts against your quota. Deleting a project frees its space immediately."
      />

      {error && (
        <Banner tone="danger" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="positive" onDismiss={() => setNotice('')}>
          {notice}
        </Banner>
      )}

      {/* The meter */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Used</Eyebrow>
            <p className="mt-2 font-display text-display font-semibold text-ink tnum">
              {storage ? formatBytes(storage.used) : '—'}
              <span className="ml-2 font-sans text-base font-normal text-muted">
                of {storage ? formatBytes(storage.limit) : '—'}
              </span>
            </p>
          </div>
          <Badge tone={plan === 'pro' ? 'accent' : 'neutral'} icon={Icon.Pro}>
            {plan === 'pro' ? 'Pro plan' : 'Free plan'}
          </Badge>
        </div>

        <Meter percent={percent} className="mt-6" />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted tnum">
          <span>{Math.round(percent)}% used</span>
          <span>{storage ? `${formatBytes(storage.remaining)} free` : ''}</span>
        </div>

        {tone && (
          <Banner
            tone={tone}
            className="mt-6"
            title={percent >= 95 ? 'You are out of storage' : 'Nearly full'}
          >
            New redesigns are blocked once a photo and its render will not fit.
            Delete a project below{plan === 'pro' ? '.' : ', or upgrade to Pro.'}
          </Banner>
        )}
      </Card>

      {/* Plans */}
      <section>
        <SectionHeader
          title="Plans"
          description="Every plan includes the full studio — boards, renders, and history. Only the storage differs."
        />

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {catalog.map((option) => {
            const current = option.id === plan;
            return (
              <div
                key={option.id}
                className={`flex flex-col rounded-[16px] border bg-canvas p-6 ${
                  current ? 'border-ink' : 'border-line'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {option.name}
                  </h3>
                  {current && (
                    <Badge tone="positive" icon={Icon.Check}>
                      Current
                    </Badge>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold tracking-tight text-ink tnum">
                    {option.priceLabel}
                  </span>
                  <span className="text-sm text-muted">{option.period}</span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted">{option.blurb}</p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-ink-2">
                      <span className="mt-0.5 shrink-0 text-accent">
                        <Icon.Check size={15} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={current ? 'secondary' : option.id === 'pro' ? 'primary' : 'secondary'}
                  className="mt-7"
                  full
                  disabled={current}
                  onClick={() => setPendingPlan(option)}
                >
                  {current
                    ? 'Your current plan'
                    : option.id === 'pro'
                      ? 'Upgrade to Pro'
                      : 'Switch to Free'}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <span className="mt-0.5 shrink-0">
            <Icon.Info size={14} />
          </span>
          No payment processor is connected in this build — switching plans
          changes your quota immediately so the flow can be used end to end.
        </p>
      </section>

      {/* What is taking up the space */}
      <section>
        <SectionHeader
          title="Largest projects"
          description="The quickest way to free space. Deleting removes the board, the photo, and the render."
          actions={
            <Button as={Link} to="/app/projects" variant="ghost" size="sm" iconRight={Icon.ArrowRight}>
              All projects
            </Button>
          }
        />

        <Card className="mt-6" padded={false}>
          <div className="px-5 sm:px-6">
            {!projects ? (
              <p className="py-8 text-sm text-muted">Loading…</p>
            ) : heaviest.length ? (
              heaviest.map((project) => (
                <DataRow
                  key={project.id}
                  label={
                    [project.style, project.budget].filter(Boolean).join(' · ') ||
                    'Redesign'
                  }
                  value={project.title}
                  action={
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted tnum">
                        {formatBytes(project.bytes)}
                      </span>
                      <Button
                        as={Link}
                        to={`/app/projects/${project.id}`}
                        variant="ghost"
                        size="sm"
                      >
                        Open
                      </Button>
                    </div>
                  }
                />
              ))
            ) : (
              <p className="py-8 text-sm text-muted">
                Nothing stored yet — your quota is untouched.
              </p>
            )}
          </div>
        </Card>

        {projects?.length > 0 && (
          <p className="mt-3 text-xs text-muted tnum">
            {pluralize(projects.length, 'project')} in total.
          </p>
        )}
      </section>

      <Modal
        open={Boolean(pendingPlan)}
        onClose={() => !busy && setPendingPlan(null)}
        title={
          pendingPlan?.id === 'pro' ? 'Upgrade to Pro' : 'Switch back to Free'
        }
        description={
          pendingPlan?.id === 'pro'
            ? 'Your storage limit goes from 500 MB to 10 GB, effective immediately.'
            : 'Your limit returns to 500 MB. Nothing is deleted — but if you are over the cap, new redesigns stay blocked until you free space.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingPlan(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={pendingPlan?.id === 'pro' ? 'primary' : 'danger'}
              loading={busy}
              onClick={changePlan}
            >
              {pendingPlan?.id === 'pro' ? 'Confirm upgrade' : 'Switch to Free'}
            </Button>
          </>
        }
      >
        {pendingPlan?.id === 'free' && storage && storage.used > 500 * 1024 * 1024 && (
          <Banner tone="warn">
            You are currently using {formatBytes(storage.used)}, which is over the
            Free limit.
          </Banner>
        )}
      </Modal>
    </div>
  );
}
