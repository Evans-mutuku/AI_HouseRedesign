import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { TextInput, Segmented } from '../../components/ui/Field.jsx';
import { Banner, EmptyState, SectionHeader } from '../../components/ui/Surface.jsx';
import RoomCard, { RoomCardSkeleton } from '../../components/dashboard/RoomCard.jsx';
import Icon from '../../components/Icon.jsx';
import { deleteRoom, listRooms, listHomes } from '../../lib/api.js';
import { useResource } from '../../lib/useResource.js';
import { formatBytes, pluralize } from '../../lib/format.js';
import { useAuth } from '../../lib/authContext.js';

export default function Rooms() {
  const { applyStorage, refreshAccount } = useAuth();

  const { data: rooms, error, clearError, setData: setRooms, reload } = useResource(listRooms);
  const { data: homes } = useResource(listHomes);

  const [query, setQuery] = useState('');
  const [homeFilter, setHomeFilter] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (!rooms) return null;
    const q = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (homeFilter && room.homeId !== homeFilter) return false;
      if (!q) return true;
      return [room.name, room.roomType, room.style, room.concept, room.homeName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q));
    });
  }, [rooms, query, homeFilter]);

  const totalBytes = rooms?.reduce((sum, r) => sum + (r.bytes || 0), 0) || 0;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await deleteRoom(pendingDelete.id);
      setRooms((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      applyStorage(result?.storage);
      refreshAccount().catch(() => {});
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.message);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Rooms"
        description={
          rooms?.length
            ? `${pluralize(rooms.length, 'room')} · ${formatBytes(totalBytes)} stored`
            : 'Every room you have redesigned lives here, with its full revision history.'
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Icon.Refresh} onClick={reload}>
              Refresh
            </Button>
            <Button as={Link} to="/app/new" size="sm" icon={Icon.Plus}>
              New
            </Button>
          </>
        }
      />

      {error && (
        <Banner tone="danger" onDismiss={clearError}>
          {error}
        </Banner>
      )}
      {deleteError && (
        <Banner tone="danger" onDismiss={() => setDeleteError('')}>
          {deleteError}
        </Banner>
      )}

      {rooms?.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <TextInput
            icon={Icon.Search}
            type="search"
            placeholder="Search by room, style, or concept"
            aria-label="Search rooms"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-sm"
          />
          {homes?.length > 0 && (
            <Segmented
              label="Filter by home"
              value={homeFilter}
              onChange={setHomeFilter}
              options={[
                { value: '', label: 'All' },
                ...homes.map((h) => ({ value: h.id, label: h.name })),
              ]}
            />
          )}
        </div>
      )}

      {rooms === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RoomCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((room) => (
            <RoomCard key={room.id} room={room} onDelete={setPendingDelete} />
          ))}
        </div>
      ) : rooms.length ? (
        <EmptyState
          icon={Icon.Search}
          title="No matches"
          description={
            query ? `Nothing here matches “${query}”.` : 'No rooms in that home yet.'
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setHomeFilter('');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Icon.Photo}
          title="No rooms yet"
          description="Upload a photo of a room and the studio will return a palette, a costed plan, a floor plan, and a render of the same space."
          action={
            <Button as={Link} to="/app/new" icon={Icon.Plus}>
              Start your first redesign
            </Button>
          }
        />
      )}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => !deleting && setPendingDelete(null)}
        title={`Move “${pendingDelete?.name || ''}” to trash?`}
        description={`Every revision, the photo, and the renders go with it - ${formatBytes(pendingDelete?.bytes || 0)}. You can restore it for 30 days.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" icon={Icon.Trash} loading={deleting} onClick={confirmDelete}>
              Move to trash
            </Button>
          </>
        }
      />
    </div>
  );
}
