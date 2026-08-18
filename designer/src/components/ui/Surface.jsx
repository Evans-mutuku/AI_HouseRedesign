import { Alert, CheckCircle, Info, Close } from '../Icon.jsx';

// Surfaces and small display pieces: cards, section headers, eyebrows, badges,
// meters, banners, empty states. Separated by hairlines, never by shadow.

export function Card({ as: Tag = 'div', padded = true, className = '', children, ...rest }) {
  return (
    <Tag
      className={[
        'rounded-[14px] border border-line bg-canvas',
        padded ? 'p-5 sm:p-6' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Small-caps kicker. The only place we use letterspaced uppercase. */
export function Eyebrow({ tone = 'muted', className = '', children }) {
  const tones = { muted: 'text-muted', accent: 'text-accent', ink: 'text-ink' };
  return (
    <p
      className={`text-eyebrow font-semibold uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </p>
  );
}

/** Page/section heading with an optional description and trailing actions. */
export function SectionHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && <Eyebrow tone="accent" className="mb-2.5">{eyebrow}</Eyebrow>}
        <h2 className="font-display text-title font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-sunken text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent-deep border-accent/20',
  positive: 'bg-positive/8 text-positive border-positive/20',
  warn: 'bg-warn/8 text-warn border-warn/25',
  danger: 'bg-danger-soft text-danger border-danger/20',
};

export function Badge({ tone = 'neutral', icon: BadgeIcon = null, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {BadgeIcon && <BadgeIcon size={13} />}
      {children}
    </span>
  );
}

/**
 * The storage meter. Turns amber past 80% and red past 95% so a user learns
 * they are near the cap before an upload is refused.
 */
export function Meter({ percent, className = '' }) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const tone =
    value >= 95 ? 'bg-danger' : value >= 80 ? 'bg-warn' : 'bg-ink';
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-sunken ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Storage used"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone}`}
        style={{ width: `${value < 1 && value > 0 ? 1 : value}%` }}
      />
    </div>
  );
}

const BANNER_TONES = {
  info: { wrap: 'border-line bg-surface text-ink-2', icon: 'text-muted', Glyph: Info },
  accent: {
    wrap: 'border-accent/20 bg-accent-soft text-accent-deep',
    icon: 'text-accent',
    Glyph: Info,
  },
  positive: {
    wrap: 'border-positive/20 bg-positive/8 text-positive',
    icon: 'text-positive',
    Glyph: CheckCircle,
  },
  warn: { wrap: 'border-warn/25 bg-warn/8 text-warn', icon: 'text-warn', Glyph: Alert },
  danger: {
    wrap: 'border-danger/20 bg-danger-soft text-danger',
    icon: 'text-danger',
    Glyph: Alert,
  },
};

export function Banner({ tone = 'info', title, children, onDismiss, action, className = '' }) {
  const { wrap, icon, Glyph } = BANNER_TONES[tone] || BANNER_TONES.info;
  return (
    <div
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-[12px] border px-4 py-3.5 ${wrap} ${className}`}
    >
      <span className={`mt-0.5 shrink-0 ${icon}`}>
        <Glyph size={17} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 shrink-0 rounded-[7px] p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <Close size={15} />
        </button>
      )}
    </div>
  );
}

/** What a list looks like before it has anything in it. */
export function EmptyState({ icon: EmptyIcon, title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center rounded-[14px] border border-dashed border-line-2 bg-surface px-6 py-14 text-center ${className}`}
    >
      {EmptyIcon && (
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas text-muted">
          <EmptyIcon size={21} />
        </span>
      )}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Grey block used while real content loads. */
export function Skeleton({ className = '' }) {
  return <div className={`hd-pulse rounded-[8px] bg-sunken ${className}`} />;
}

/** Label/value pair, used in settings and project metadata. */
export function DataRow({ label, value, action, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-line py-4 last:border-0 ${className}`}
    >
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-ink">{value || '—'}</p>
      </div>
      {action}
    </div>
  );
}
