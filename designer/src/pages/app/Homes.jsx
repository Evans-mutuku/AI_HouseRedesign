import { useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { TextArea, TextInput } from '../../components/ui/Field.jsx';
import {
  Banner,
  Card,
  EmptyState,
  SectionHeader,
} from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import { createHome, deleteHome, listHomes, listRooms, updateHome } from '../../lib/api.js';
import { useResource } from '../../lib/useResource.js';
import { pluralize } from '../../lib/format.js';
import { readableOn } from '../../lib/color.js';

/**
 * Whole-home projects.
 *
 * A home is a group of rooms plus one agreed palette. That palette is handed to
 * every room's design prompt, which is what stops a house turning into six
 * unrelated rooms that each look fine on their own.
 */
export default function Homes() {
  const { data: homes, error, clearError, reload } = useResource(listHomes);
  const { data: rooms } = useResource(listRooms);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [adoptFor, setAdoptFor] = useState(null);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createHome({ name: name.trim(), notes: notes.trim() });
      setName('');
      setNotes('');
      setCreating(false);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteHome(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const adoptPalette = async (homeId, redesignId) => {
    setBusy(true);
    try {
      await updateHome(homeId, { adoptFromRedesignId: redesignId });
      setAdoptFor(null);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const roomsIn = (homeId) => (rooms || []).filter((r) => r.homeId === homeId);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Homes"
        description="Group rooms into one project so they share a palette and the house reads as a single scheme."
        actions={
          <Button size="sm" icon={Icon.Plus} onClick={() => setCreating(true)}>
            New home
          </Button>
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

      {homes === null ? (
        <div className="hd-pulse h-40 rounded-[14px] bg-sunken" />
      ) : homes.length ? (
        <div className="space-y-5">
          {homes.map((home) => {
            const members = roomsIn(home.id);
            return (
              <Card key={home.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-ink">{home.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {pluralize(members.length, 'room')}
                      {home.notes ? ` · ${home.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Icon.Palette}
                      onClick={() => setAdoptFor(home)}
                      disabled={!members.length}
                    >
                      {home.palette?.length ? 'Change palette' : 'Set palette'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Icon.Trash}
                      onClick={() => setPendingDelete(home)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {home.palette?.length > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-eyebrow font-semibold uppercase text-muted">
                      Shared palette
                    </p>
                    <div className="flex overflow-hidden rounded-[10px] border border-line">
                      {home.palette.map((c, i) => (
                        <div
                          key={`${c.hex}-${i}`}
                          className="flex h-14 flex-1 items-end p-2"
                          style={{ backgroundColor: c.hex, color: readableOn(c.hex) }}
                          title={`${c.name} · ${c.hex}`}
                        >
                          <span className="font-mono text-[10px] uppercase opacity-70">
                            {c.hex}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Every new room in this home is designed around these colours.
                    </p>
                  </div>
                ) : (
                  <Banner tone="info" className="mt-5">
                    No shared palette yet. Pick a board you like and adopt its
                    palette - later rooms will be designed around it.
                  </Banner>
                )}

                {members.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                    {members.map((room) => (
                      <li key={room.id}>
                        <Link
                          to={`/app/rooms/${room.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-line-2 hover:bg-surface"
                        >
                          {room.render?.thumbUrl && (
                            <img
                              src={room.render.thumbUrl}
                              alt=""
                              className="h-5 w-5 rounded-full object-cover"
                            />
                          )}
                          {room.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Icon.Overview}
          title="No homes yet"
          description="Create one, add your rooms to it, and adopt a palette so the whole house reads as one scheme."
          action={
            <Button icon={Icon.Plus} onClick={() => setCreating(true)}>
              Create a home
            </Button>
          }
        />
      )}

      {/* Create */}
      <Modal
        open={creating}
        onClose={() => !busy && setCreating(false)}
        title="New home"
        description="A home groups rooms and gives them a shared palette."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!name.trim()} onClick={create}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Name"
            autoFocus
            placeholder="e.g. Riverside flat"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextArea
            label="Notes"
            rows={2}
            placeholder="Anything that applies to the whole house"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* Adopt a palette */}
      <Modal
        open={Boolean(adoptFor)}
        onClose={() => !busy && setAdoptFor(null)}
        title="Choose the shared palette"
        description="Pick the room whose palette should carry through the rest of the house."
      >
        <ul className="space-y-2">
          {roomsIn(adoptFor?.id).map((room) => (
            <li key={room.id}>
              <button
                type="button"
                disabled={!room.latestRedesignId || busy}
                onClick={() => adoptPalette(adoptFor.id, room.latestRedesignId)}
                className="flex w-full items-center gap-3 rounded-[10px] border border-line p-3 text-left transition-colors hover:border-line-2 hover:bg-surface disabled:opacity-50"
              >
                {room.render?.thumbUrl && (
                  <img
                    src={room.render.thumbUrl}
                    alt=""
                    className="h-10 w-14 shrink-0 rounded-[6px] object-cover"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{room.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {room.style || 'Latest revision'}
                  </span>
                </span>
                <Icon.ChevronRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Delete */}
      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => !busy && setPendingDelete(null)}
        title={`Delete “${pendingDelete?.name || ''}”?`}
        description="The rooms inside it are kept - they simply stop belonging to a home."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" icon={Icon.Trash} loading={busy} onClick={remove}>
              Delete home
            </Button>
          </>
        }
      />
    </div>
  );
}
