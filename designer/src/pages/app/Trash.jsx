import { useState } from 'react';

import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  SectionHeader,
} from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import { emptyTrash, getTrash, restoreFromTrash } from '../../lib/api.js';
import { useResource } from '../../lib/useResource.js';
import { formatBytes, formatRelative } from '../../lib/format.js';
import { useAuth } from '../../lib/authContext.js';

/**
 * Deleted work, recoverable for 30 days.
 *
 * Trashed items still occupy the quota - that is honest rather than convenient,
 * and it is why the page leads with how much space emptying would return.
 */
export default function Trash() {
  const { applyStorage, refreshAccount } = useAuth();
  const { data, error, clearError, reload } = useResource(getTrash);

  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const restore = async (body, key) => {
    setBusy(key);
    try {
      await restoreFromTrash(body);
      reload();
      refreshAccount().catch(() => {});
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy('');
    }
  };

  const purge = async (body, key) => {
    setBusy(key);
    try {
      const result = await emptyTrash(body);
      applyStorage(result?.storage);
      refreshAccount().catch(() => {});
      setConfirmEmpty(false);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy('');
    }
  };

  const rooms = data?.rooms || [];
  const revisions = data?.revisions || [];
  const isEmpty = !rooms.length && !revisions.length;
  const reclaimable = data?.storage?.trashed || 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Trash"
        description={`Deleted work is kept for ${data?.retentionDays ?? 30} days, then removed for good. It still counts against your storage until then.`}
        actions={
          !isEmpty ? (
            <Button
              variant="danger"
              size="sm"
              icon={Icon.Trash}
              onClick={() => setConfirmEmpty(true)}
            >
              Empty trash
            </Button>
          ) : null
        }
      />

      {error && (
        <Banner tone="danger" onDismiss={clearError}>
          {error}
        </Banner>
      )}
      {actionError && (
        <Banner tone="danger" onDismiss={() => setActionError('')}>
          {actionError}
        </Banner>
      )}

      {!isEmpty && reclaimable > 0 && (
        <Banner tone="info" title={`${formatBytes(reclaimable)} recoverable`}>
          That is how much storage emptying the trash would give back.
        </Banner>
      )}

      {data === null ? (
        <div className="hd-pulse h-32 rounded-[14px] bg-sunken" />
      ) : isEmpty ? (
        <EmptyState
          icon={Icon.Trash}
          title="Nothing in the trash"
          description="Rooms and revisions you delete will wait here for 30 days before being removed permanently."
        />
      ) : (
        <div className="space-y-6">
          {rooms.length > 0 && (
            <section>
              <p className="mb-3 text-eyebrow font-semibold uppercase text-muted">Rooms</p>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {rooms.map((room) => (
                    <li
                      key={room.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{room.name}</p>
                        <p className="mt-0.5 text-xs text-muted tnum">
                          Deleted {formatRelative(room.deletedAt)} · {formatBytes(room.bytes)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Icon.Refresh}
                          loading={busy === `r-${room.id}`}
                          onClick={() => restore({ roomId: room.id }, `r-${room.id}`)}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={busy === `p-${room.id}`}
                          onClick={() => purge({ roomId: room.id }, `p-${room.id}`)}
                        >
                          Delete forever
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {revisions.length > 0 && (
            <section>
              <p className="mb-3 text-eyebrow font-semibold uppercase text-muted">Revisions</p>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {revisions.map((rev) => (
                    <li
                      key={rev.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                          {rev.roomName}
                          <Badge>Revision {rev.revisionNo}</Badge>
                        </p>
                        <p className="mt-0.5 text-xs text-muted tnum">
                          Deleted {formatRelative(rev.deletedAt)} · {formatBytes(rev.bytes)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Icon.Refresh}
                          loading={busy === `rr-${rev.id}`}
                          onClick={() => restore({ redesignId: rev.id }, `rr-${rev.id}`)}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={busy === `pr-${rev.id}`}
                          onClick={() => purge({ redesignId: rev.id }, `pr-${rev.id}`)}
                        >
                          Delete forever
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}

      <Modal
        open={confirmEmpty}
        onClose={() => !busy && setConfirmEmpty(false)}
        title="Empty the trash?"
        description={`This permanently deletes everything above and frees ${formatBytes(reclaimable)}. It cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmEmpty(false)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Icon.Trash}
              loading={busy === 'all'}
              onClick={() => purge({}, 'all')}
            >
              Empty trash
            </Button>
          </>
        }
      />
    </div>
  );
}
