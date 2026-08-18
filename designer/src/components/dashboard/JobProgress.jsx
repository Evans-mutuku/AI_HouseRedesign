import Icon from '../Icon.jsx';
import Button from '../ui/Button.jsx';

/**
 * A running generation, shown wherever it is happening.
 *
 * Because the work is on the server now, this is a window onto it rather than
 * the thing holding it up - the copy says so, because "you can close this tab"
 * is genuinely useful information when a job takes a minute.
 */
export default function JobProgress({ job, onCancel, compact = false }) {
  if (!job) return null;

  const pct = Math.max(4, Math.min(100, job.progress || 0));
  const failed = job.status === 'failed';
  const done = job.status === 'succeeded';

  return (
    <div
      className={`rounded-[14px] border bg-canvas ${
        failed ? 'border-danger/25' : 'border-line'
      } ${compact ? 'p-4' : 'p-5'}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className={failed ? 'text-danger' : 'text-accent'}>
          {failed ? (
            <Icon.Alert size={18} />
          ) : done ? (
            <Icon.CheckCircle size={18} />
          ) : (
            <Icon.Spinner size={18} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            {failed ? 'That redesign failed' : done ? 'Done' : job.stage || 'Working'}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {failed
              ? job.error || 'Something went wrong.'
              : done
                ? 'Your board is ready.'
                : 'Running on our servers - you can close this tab and come back.'}
          </p>
        </div>

        {!failed && !done && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {!failed && !done && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
