import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import DesignBoard from '../../components/DesignBoard.jsx';
import RevisionTimeline from '../../components/board/RevisionTimeline.jsx';
import ReviseDialog from '../../components/board/ReviseDialog.jsx';
import ShareDialog from '../../components/board/ShareDialog.jsx';
import JobProgress from '../../components/dashboard/JobProgress.jsx';
import ProgressPhotos from '../../components/board/ProgressPhotos.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Badge, Banner, EmptyState, Skeleton } from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import {
  deleteRoom,
  getPaints,
  getRedesign,
  getRoom,
  reviseRoom,
  setChecklistItem,
  setFavorite,
  updateRoom,
} from '../../lib/api.js';
import { useJob } from '../../lib/useJob.js';
import { formatBytes, formatDate } from '../../lib/format.js';
import { useAuth } from '../../lib/authContext.js';

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { applyStorage, refreshAccount } = useAuth();

  const [room, setRoom] = useState(null);
  const [revision, setRevision] = useState(null);
  const [paints, setPaints] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState(0);
  const [actionError, setActionError] = useState('');

  const [jobId, setJobId] = useState(null);
  const [revising, setRevising] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const selectedId = params.get('r') || null;

  /* ── Loading ───────────────────────────────────────────────────────────── */

  const loadRoom = useCallback(async () => {
    try {
      const data = await getRoom(id);
      setRoom(data);
      setLoadError('');
      // Follow a job that was already running when the page opened, so a reload
      // mid-generation picks straight back up.
      if (data.activeJob) setJobId(data.activeJob.id);
      return data;
    } catch (err) {
      setStatus(err.status || 0);
      setLoadError(err.message);
      return null;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setRoom(null);
    setRevision(null);
    loadRoom().then((data) => {
      if (cancelled || !data) return;
      // Default to the newest revision unless the URL names one.
      const target = selectedId || data.revisions?.[0]?.id;
      if (target) setParams({ r: target }, { replace: true });
    });
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on the room only — revision selection is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load whichever revision is selected.
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setRevision(null);
    setPaints(null);
    getRedesign(selectedId)
      .then((data) => {
        if (!cancelled) setRevision(data);
      })
      .catch((err) => {
        if (!cancelled) setActionError(err.message);
      });
    getPaints(selectedId)
      .then((data) => {
        if (!cancelled) setPaints(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  /* ── The running job ───────────────────────────────────────────────────── */

  const onJobDone = useCallback(
    async (job) => {
      setRevising(false);
      if (job.status === 'succeeded') {
        const data = await loadRoom();
        if (job.redesignId) setParams({ r: job.redesignId });
        else if (data?.revisions?.[0]) setParams({ r: data.revisions[0].id });
        refreshAccount().catch(() => {});
      }
      setJobId(null);
    },
    [loadRoom, setParams, refreshAccount],
  );

  const { job, running, cancel } = useJob(jobId, { onDone: onJobDone });

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const submitRevision = async (body) => {
    setRevising(true);
    setActionError('');
    try {
      const result = await reviseRoom(id, body);
      setJobId(result.job.id);
      setReviseOpen(false);
    } catch (err) {
      setActionError(err.message);
      setRevising(false);
    }
  };

  const toggleChecklist = useCallback(
    async (line, done) => {
      if (!revision) return;
      // Optimistic: a checkbox that waits for a round trip feels broken.
      setRevision((prev) => {
        if (!prev) return prev;
        const rest = prev.checklist.filter((c) => c.key !== line.key);
        return { ...prev, checklist: [...rest, { key: line.key, done, actualCostCents: null }] };
      });
      try {
        await setChecklistItem(revision.id, line.key, { done });
      } catch (err) {
        setActionError(err.message);
        setRevision((prev) => {
          if (!prev) return prev;
          const rest = prev.checklist.filter((c) => c.key !== line.key);
          return { ...prev, checklist: [...rest, { key: line.key, done: !done }] };
        });
      }
    },
    [revision],
  );

  const toggleFavorite = async () => {
    if (!revision) return;
    const next = !revision.favorited;
    setRevision((prev) => (prev ? { ...prev, favorited: next } : prev));
    try {
      await setFavorite(revision.id, next);
      loadRoom();
    } catch (err) {
      setActionError(err.message);
      setRevision((prev) => (prev ? { ...prev, favorited: !next } : prev));
    }
  };

  const rename = async (name) => {
    setRenaming(false);
    if (!name?.trim() || name === room.name) return;
    try {
      await updateRoom(id, { name: name.trim() });
      setRoom((prev) => (prev ? { ...prev, name: name.trim() } : prev));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteRoom(id);
      applyStorage(result?.storage);
      refreshAccount().catch(() => {});
      navigate('/app/rooms', { replace: true });
    } catch (err) {
      setActionError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const reloadPaints = useCallback(
    (brand) => {
      if (!selectedId) return;
      getPaints(selectedId, brand)
        .then(setPaints)
        .catch(() => {});
    },
    [selectedId],
  );

  /* ── Render ────────────────────────────────────────────────────────────── */

  const annotations = useMemo(
    () => room?.architecture?.annotations || [],
    [room],
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={status === 404 ? Icon.Search : Icon.Alert}
          title={status === 404 ? 'That room is not here' : 'Could not load this room'}
          description={
            status === 404
              ? 'It may have been deleted, or it belongs to a different account.'
              : loadError
          }
          action={
            <Button as={Link} to="/app/rooms" variant="secondary">
              Back to rooms
            </Button>
          }
        />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="aspect-[16/10] w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <BackLink />
      </div>

      {actionError && (
        <Banner tone="danger" onDismiss={() => setActionError('')}>
          {actionError}
        </Banner>
      )}

      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{room.roomType || 'Room'}</Badge>
            {room.homeName && <Badge icon={Icon.Overview}>{room.homeName}</Badge>}
            {revision?.style && <Badge>{revision.style}</Badge>}
          </div>

          {renaming ? (
            <input
              autoFocus
              defaultValue={room.name}
              onBlur={(e) => rename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') rename(e.target.value);
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="mt-4 w-full max-w-md rounded-[10px] border border-ink bg-canvas px-3 py-1.5 font-display text-title font-semibold text-ink focus:outline-none"
              aria-label="Room name"
            />
          ) : (
            <h2 className="group mt-4 flex items-center gap-2 font-display text-title font-semibold text-ink">
              {room.name}
              <button
                type="button"
                onClick={() => setRenaming(true)}
                aria-label="Rename room"
                className="no-print text-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Icon.Settings size={15} />
              </button>
            </h2>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tnum">
            <span className="inline-flex items-center gap-1.5">
              <Icon.Clock size={13} />
              {formatDate(room.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon.Storage size={13} />
              {formatBytes(room.bytes)}
            </span>
            <span>
              {room.revisionCount} revision{room.revisionCount === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={revision?.favorited ? Icon.Sparkle : Icon.Sparkle}
            onClick={toggleFavorite}
            disabled={!revision}
            className={revision?.favorited ? 'text-accent' : ''}
          >
            {revision?.favorited ? 'Favourited' : 'Favourite'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Icon.ExternalLink}
            onClick={() => setShareOpen(true)}
            disabled={!revision}
          >
            Share
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Icon.Download}
            onClick={() => window.print()}
            disabled={!revision}
          >
            PDF
          </Button>
          <Button size="sm" icon={Icon.Sparkle} onClick={() => setReviseOpen(true)} disabled={running}>
            Ask for a change
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={Icon.Trash}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* A running job */}
      {running && job && (
        <div className="no-print">
          <JobProgress job={job} onCancel={cancel} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Timeline */}
        {room.revisions?.length > 1 && (
          <aside className="no-print lg:col-span-4 lg:order-2">
            <div className="lg:sticky lg:top-4">
              <RevisionTimeline
                revisions={room.revisions}
                selectedId={selectedId}
                onSelect={(rid) => setParams({ r: rid })}
              />
            </div>
          </aside>
        )}

        {/* Board */}
        <div className={room.revisions?.length > 1 ? 'lg:col-span-8 lg:order-1' : 'lg:col-span-12'}>
          {revision ? (
            <>
              {revision.instruction && (
                <Banner tone="info" className="mb-6" title="You asked for">
                  {revision.instruction}
                </Banner>
              )}
              <DesignBoard
                board={revision.board}
                beforeUrl={revision.before?.url}
                afterUrl={revision.render?.url}
                annotations={annotations}
                paints={paints}
                checklist={revision.checklist}
                onToggleChecklist={toggleChecklist}
                onPaintBrandChange={reloadPaints}
                fidelity={revision.fidelity}
              />
            </>
          ) : room.revisions?.length ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="aspect-[16/10] w-full" />
            </div>
          ) : running ? null : (
            <EmptyState
              icon={Icon.Photo}
              title="No board yet"
              description="This room has no completed revision. Ask for a change to generate one."
              action={
                <Button icon={Icon.Sparkle} onClick={() => setReviseOpen(true)}>
                  Generate a direction
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Progress photos */}
      <div className="no-print border-t border-line pt-10">
        <ProgressPhotos roomId={id} />
      </div>

      <ReviseDialog
        open={reviseOpen}
        onClose={() => setReviseOpen(false)}
        onSubmit={submitRevision}
        beforeUrl={revision?.before?.url || room.photo?.url}
        currentBudgetCents={revision?.budgetCents}
        currency={revision?.currency || 'USD'}
        submitting={revising}
      />

      {revision && (
        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          redesignId={revision.id}
          existingToken={revision.shareToken}
          onChange={(token) =>
            setRevision((prev) => (prev ? { ...prev, shareToken: token } : prev))
          }
        />
      )}

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title={`Move “${room.name}” to trash?`}
        description={`Every revision, the photo, and the renders go with it — ${formatBytes(room.bytes)}. You can restore it from the trash for 30 days.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" icon={Icon.Trash} loading={deleting} onClick={doDelete}>
              Move to trash
            </Button>
          </>
        }
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/app/rooms"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
    >
      <Icon.ArrowLeft size={15} />
      All rooms
    </Link>
  );
}
