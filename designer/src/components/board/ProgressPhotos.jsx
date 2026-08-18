import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '../Icon.jsx';
import Button from '../ui/Button.jsx';
import { Banner, EmptyState } from '../ui/Surface.jsx';
import { formatRelative } from '../../lib/format.js';
import { addProgress, deleteProgress, listProgress } from '../../lib/api.js';
import { useAuth } from '../../lib/authContext.js';

/**
 * Photos of the room as the work actually happens.
 *
 * This is what turns a one-visit tool into something people come back to: the
 * board says what the room should become, and this says how far along it is.
 * Uploads go through the same compression path as everything else, so a
 * fortnightly progress shot costs a fraction of a megabyte.
 */
export default function ProgressPhotos({ roomId }) {
  const { applyStorage } = useAuth();
  const inputRef = useRef(null);

  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    listProgress(roomId)
      .then(setEntries)
      .catch((err) => {
        setEntries([]);
        setError(err.message);
      });
  }, [roomId]);

  useEffect(load, [load]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const entry = await addProgress(roomId, { file });
      setEntries((prev) => [entry, ...(prev || [])]);
      applyStorage(entry?.storage);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (entryId) => {
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    try {
      const result = await deleteProgress(roomId, entryId);
      applyStorage(result?.storage);
    } catch (err) {
      setError(err.message);
      setEntries(previous);
    }
  };

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-accent">
            <Icon.Photo size={18} />
          </span>
          <div>
            <p className="text-eyebrow font-semibold uppercase text-muted">Progress</p>
            <p className="mt-1 text-sm text-muted">
              Track the room as the work actually happens.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={Icon.Upload}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Add a photo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <Banner tone="danger" className="mb-4" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}

      {entries === null ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="hd-pulse aspect-[4/3] rounded-[12px] bg-sunken" />
          ))}
        </div>
      ) : entries.length ? (
        <ul className="grid gap-4 sm:grid-cols-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group relative overflow-hidden rounded-[12px] border border-line bg-canvas"
            >
              <div className="aspect-[4/3] overflow-hidden bg-sunken">
                <img
                  src={entry.photo?.thumbUrl || entry.photo?.url}
                  alt={entry.caption || 'Progress photo'}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="px-3 py-2.5">
                <p className="text-xs text-muted tnum">{formatRelative(entry.createdAt)}</p>
                {entry.caption && (
                  <p className="mt-0.5 truncate text-sm text-ink">{entry.caption}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label="Delete this progress photo"
                className="absolute right-2 top-2 rounded-[8px] border border-line bg-canvas/90 p-1.5 text-muted opacity-0 backdrop-blur-sm transition-all hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Icon.Trash size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Icon.Photo}
          title="No progress photos yet"
          description="Add one each time something changes and you will have a record of the whole project."
          action={
            <Button variant="secondary" icon={Icon.Upload} onClick={() => inputRef.current?.click()}>
              Add the first
            </Button>
          }
        />
      )}
    </section>
  );
}
