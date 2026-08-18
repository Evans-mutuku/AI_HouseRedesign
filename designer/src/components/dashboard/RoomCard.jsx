import { Link } from 'react-router-dom';

import Icon from '../Icon.jsx';
import { Badge } from '../ui/Surface.jsx';
import { formatBytes, formatRelative } from '../../lib/format.js';

/**
 * One room in the grid.
 *
 * The thumbnail is the latest render when there is one, the original photo
 * otherwise — and it is genuinely a thumbnail now: a ~640px WebP generated on
 * upload rather than the full-size image scaled down in the browser, which is
 * the difference between a grid that loads instantly and one that pulls several
 * megabytes to show six small pictures.
 */
export default function RoomCard({ room, onDelete }) {
  const image = room.render?.thumbUrl || room.photo?.thumbUrl || room.photo?.url;

  return (
    <div className="group relative overflow-hidden rounded-[14px] border border-line bg-canvas transition-colors hover:border-line-2">
      <Link to={`/app/rooms/${room.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-faint">
              <Icon.Photo size={26} />
            </div>
          )}

          <span className="absolute left-3 top-3 flex gap-1.5">
            {room.render && (
              <Badge tone="neutral" icon={Icon.Sparkle} className="bg-canvas/90 backdrop-blur-sm">
                Rendered
              </Badge>
            )}
            {room.revisionCount > 1 && (
              <Badge tone="neutral" className="bg-canvas/90 backdrop-blur-sm">
                {room.revisionCount} versions
              </Badge>
            )}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate font-display text-base font-semibold text-ink">
              {room.name}
            </h3>
            <span className="shrink-0 pt-0.5 text-muted transition-transform duration-300 group-hover:translate-x-0.5">
              <Icon.ChevronRight size={16} />
            </span>
          </div>

          {(room.style || room.homeName) && (
            <p className="mt-1 truncate text-sm text-muted">
              {[room.homeName, room.style].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3 text-xs text-faint tnum">
            <span className="inline-flex items-center gap-1.5">
              <Icon.Clock size={13} />
              {formatRelative(room.updatedAt)}
            </span>
            <span>{formatBytes(room.bytes)}</span>
          </div>
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(room)}
          aria-label={`Delete ${room.name}`}
          className="absolute right-3 top-3 rounded-[8px] border border-line bg-canvas/90 p-1.5 text-muted opacity-0 backdrop-blur-sm transition-all duration-200 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Icon.Trash size={15} />
        </button>
      )}
    </div>
  );
}

/** Placeholder shown in the grid while rooms load. */
export function RoomCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-canvas">
      <div className="hd-pulse aspect-[4/3] bg-sunken" />
      <div className="space-y-2.5 p-4">
        <div className="hd-pulse h-4 w-2/3 rounded bg-sunken" />
        <div className="hd-pulse h-3 w-1/2 rounded bg-sunken" />
      </div>
    </div>
  );
}
