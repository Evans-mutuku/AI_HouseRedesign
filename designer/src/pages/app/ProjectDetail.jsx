import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import DesignBoard from '../../components/DesignBoard.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Badge, Banner, EmptyState, Skeleton } from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import { deleteRedesign, fetchRedesign } from '../../lib/api.js';
import { formatBytes, formatDate } from '../../lib/format.js';
import { useAuth } from '../../lib/authContext.js';
import { useResource } from '../../lib/useResource.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { applyStorage, refreshAccount } = useAuth();

  const fetcher = useCallback(() => fetchRedesign(id), [id]);
  const { data, error, status } = useResource(fetcher, id);

  const [deleteError, setDeleteError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const justCreated = Boolean(location.state?.justCreated);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteRedesign(id);
      applyStorage(result?.storage);
      refreshAccount().catch(() => {});
      navigate('/app/projects', { replace: true });
    } catch (err) {
      setDeleteError(err.message);
      setConfirming(false);
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={status === 404 ? Icon.Search : Icon.Alert}
          title={status === 404 ? 'That project is not here' : 'Could not load this project'}
          description={
            status === 404
              ? 'It may have been deleted, or it belongs to a different account.'
              : error
          }
          action={
            <Button as={Link} to="/app/projects" variant="secondary">
              Back to projects
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
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
      <BackLink />

      {deleteError && (
        <Banner tone="danger" onDismiss={() => setDeleteError('')}>
          {deleteError}
        </Banner>
      )}

      {justCreated && (
        <Banner tone="positive" title="Your board is ready">
          Saved to your projects. It stays available on any device you sign in
          from.
        </Banner>
      )}

      {/* Project header */}
      <div className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{data.redesign.roomType || 'Redesign'}</Badge>
            {data.style && <Badge>{data.style}</Badge>}
            {data.budget && <Badge>{data.budget}</Badge>}
          </div>
          <h2 className="mt-4 font-display text-title font-semibold text-ink">
            {data.title}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tnum">
            <span className="inline-flex items-center gap-1.5">
              <Icon.Clock size={13} />
              {formatDate(data.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon.Storage size={13} />
              {formatBytes(data.bytes)}
            </span>
            {data.model && <span className="font-mono">{data.model}</span>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {data.after?.url && (
            <Button
              as="a"
              href={data.after.url}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              size="sm"
              icon={Icon.ExternalLink}
            >
              Open render
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            icon={Icon.Trash}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {data.userNote && (
        <Banner tone="info" title="Your note">
          {data.userNote}
        </Banner>
      )}

      <DesignBoard
        data={data.redesign}
        beforeUrl={data.before.url}
        afterUrl={data.after?.url}
        imageError={data.imageError}
      />

      <div className="flex flex-col items-start gap-4 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-title font-semibold text-ink">
          Try another room.
        </p>
        <Button as={Link} to="/app/new" icon={Icon.Plus}>
          Start another redesign
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => !deleting && setConfirming(false)}
        title={`Delete “${data.title}”?`}
        description={`This removes the board, the original photo, and the render — and frees ${formatBytes(data.bytes)} of storage. It cannot be undone.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              icon={Icon.Trash}
              loading={deleting}
              onClick={confirmDelete}
            >
              Delete project
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
      to="/app/projects"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
    >
      <Icon.ArrowLeft size={15} />
      All projects
    </Link>
  );
}
