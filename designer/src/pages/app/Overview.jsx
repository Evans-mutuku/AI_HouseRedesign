import { Link } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  Eyebrow,
  Meter,
  SectionHeader,
} from '../../components/ui/Surface.jsx';
import RoomCard, { RoomCardSkeleton } from '../../components/dashboard/RoomCard.jsx';
import JobProgress from '../../components/dashboard/JobProgress.jsx';
import Icon from '../../components/Icon.jsx';
import { listJobs, listRooms } from '../../lib/api.js';
import { useResource } from '../../lib/useResource.js';
import { formatBytes, pluralize } from '../../lib/format.js';
import { useAuth, displayNameOf } from '../../lib/authContext.js';

const RECENT_COUNT = 3;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ icon: StatIcon, label, value, sub }) {
  return (
    <Card className="flex items-start gap-4">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-accent">
        <StatIcon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-ink tnum">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

export default function Overview() {
  const { user, account, storage, plan } = useAuth();
  const { data: rooms, error, clearError } = useResource(listRooms);
  // Anything still generating, so a reload or a second device picks it back up.
  const { data: jobs } = useResource(listJobs);

  const stats = account?.projects;
  const nearlyFull = storage ? storage.percent >= 80 : false;
  const recent = rooms?.slice(0, RECENT_COUNT) || [];
  const running = (jobs || []).filter((j) => ['queued', 'running'].includes(j.status));

  return (
    <div className="space-y-10">
      {/* Greeting + primary action */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow tone="accent">{greeting()}</Eyebrow>
          <h2 className="mt-2.5 font-display text-display font-semibold text-ink">
            {displayNameOf(user, account)}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {stats?.total
              ? `${pluralize(stats.total, 'revision')} across ${pluralize(rooms?.length ?? 0, 'room')}.`
              : 'Upload a room photo and the studio will read it.'}
          </p>
        </div>
        <Button as={Link} to="/app/new" size="lg" icon={Icon.Plus}>
          New redesign
        </Button>
      </div>

      {error && (
        <Banner tone="danger" onDismiss={clearError}>
          {error}
        </Banner>
      )}

      {/* Anything currently generating */}
      {running.length > 0 && (
        <div className="space-y-3">
          {running.map((job) => (
            <Link
              key={job.id}
              to={job.roomId ? `/app/rooms/${job.roomId}` : '/app/rooms'}
              className="block"
            >
              <JobProgress job={job} compact />
            </Link>
          ))}
        </div>
      )}

      {nearlyFull && (
        <Banner
          tone={storage.percent >= 95 ? 'danger' : 'warn'}
          title={
            storage.percent >= 95 ? 'You are out of storage' : 'Your storage is nearly full'
          }
          action={
            <Button as={Link} to="/app/storage" size="sm" variant="secondary">
              {plan === 'pro' ? 'Manage' : 'Upgrade'}
            </Button>
          }
        >
          {formatBytes(storage.used)} of {formatBytes(storage.limit)} used.
          {storage.trashed > 0
            ? ` Emptying your trash would free ${formatBytes(storage.trashed)}.`
            : plan === 'pro'
              ? ' Delete a room to free space.'
              : ' Delete a room, or move to Pro for 10 GB.'}
        </Banner>
      )}

      {/* At a glance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          icon={Icon.Projects}
          label="Rooms"
          value={rooms?.length ?? '—'}
          sub={stats?.total ? `${pluralize(stats.total, 'revision')} in total` : 'Nothing yet'}
        />
        <Stat
          icon={Icon.Storage}
          label="Storage used"
          value={storage ? formatBytes(storage.used) : '—'}
          sub={storage ? `of ${formatBytes(storage.limit)}` : ''}
        />
        <Stat
          icon={Icon.Pro}
          label="Plan"
          value={plan === 'pro' ? 'Pro' : 'Free'}
          sub={plan === 'pro' ? '10 GB included' : '500 MB included'}
        />
      </div>

      {/* Storage meter */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Storage</p>
            <p className="mt-1 text-sm text-muted tnum">
              {storage
                ? `${formatBytes(storage.used)} of ${formatBytes(storage.limit)} used · ${formatBytes(storage.remaining)} free`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={plan === 'pro' ? 'accent' : 'neutral'} icon={Icon.Pro}>
              {plan === 'pro' ? 'Pro' : 'Free'}
            </Badge>
            <Button as={Link} to="/app/storage" variant="secondary" size="sm">
              {plan === 'pro' ? 'Manage plan' : 'Upgrade'}
            </Button>
          </div>
        </div>
        <Meter percent={storage?.percent ?? 0} className="mt-5" />
      </Card>

      {/* Recent work */}
      <section>
        <SectionHeader
          title="Recent rooms"
          description="Each room keeps its whole revision history."
          actions={
            rooms?.length > RECENT_COUNT ? (
              <Button
                as={Link}
                to="/app/rooms"
                variant="ghost"
                size="sm"
                iconRight={Icon.ArrowRight}
              >
                View all
              </Button>
            ) : null
          }
        />

        <div className="mt-6">
          {rooms === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <RoomCardSkeleton key={i} />
              ))}
            </div>
          ) : recent.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Icon.Photo}
              title="No rooms yet"
              description="Upload a photo and the studio will return a palette, a costed and phased plan, a floor plan, and a render of the same space."
              action={
                <Button as={Link} to="/app/new" icon={Icon.Plus}>
                  Start your first redesign
                </Button>
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
