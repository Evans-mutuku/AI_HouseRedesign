import { Link } from 'react-router-dom';

import Icon from '../Icon.jsx';
import { Badge } from '../ui/Surface.jsx';
import { formatBytes, formatRelative } from '../../lib/format.js';

/**
 * One project in a grid. The thumbnail is the render when there is one, the
 * original photo otherwise — both arrive as signed URLs scoped to this account.
 */
export default function ProjectCard({ project, onDelete }) {
  return (
    <div className="group relative overflow-hidden rounded-[14px] border border-line bg-canvas transition-colors hover:border-line-2">
      <Link to={`/app/projects/${project.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-faint">
              <Icon.Photo size={26} />
            </div>
          )}

          {project.hasRender && (
            <span className="absolute left-3 top-3">
              <Badge tone="neutral" icon={Icon.Sparkle} className="bg-canvas/90 backdrop-blur-sm">
                Rendered
              </Badge>
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate font-display text-base font-semibold text-ink">
              {project.title}
            </h3>
            <span className="shrink-0 pt-0.5 text-muted transition-transform duration-300 group-hover:translate-x-0.5">
              <Icon.ChevronRight size={16} />
            </span>
          </div>

          {project.style && (
            <p className="mt-1 truncate text-sm text-muted">
              {[project.style, project.budget].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3 text-xs text-faint tnum">
            <span className="inline-flex items-center gap-1.5">
              <Icon.Clock size={13} />
              {formatRelative(project.createdAt)}
            </span>
            <span>{formatBytes(project.bytes)}</span>
          </div>
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(project)}
          aria-label={`Delete ${project.title}`}
          className="absolute right-3 top-3 rounded-[8px] border border-line bg-canvas/90 p-1.5 text-muted opacity-0 backdrop-blur-sm transition-all duration-200 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Icon.Trash size={15} />
        </button>
      )}
    </div>
  );
}

/** Placeholder shown in the grid while projects load. */
export function ProjectCardSkeleton() {
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
