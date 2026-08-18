import { forwardRef } from 'react';
import { Spinner } from '../Icon.jsx';

// One button. Four intents, three sizes, and a loading state that keeps its
// width so nothing jumps when a request starts.

const VARIANTS = {
  primary:
    'bg-ink text-canvas hover:bg-ink-2 disabled:bg-faint disabled:text-canvas',
  secondary:
    'bg-canvas text-ink border border-line hover:border-line-2 hover:bg-surface disabled:text-faint',
  ghost:
    'text-muted hover:text-ink hover:bg-surface disabled:text-faint',
  danger:
    'bg-canvas text-danger border border-danger/25 hover:bg-danger-soft hover:border-danger/45 disabled:text-faint disabled:border-line',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-[8px]',
  md: 'h-11 px-5 text-sm gap-2 rounded-[10px]',
  lg: 'h-[52px] px-7 text-base gap-2.5 rounded-[10px]',
};

const Button = forwardRef(function Button(
  {
    as: Tag = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: IconLeft = null,
    iconRight: IconRight = null,
    full = false,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const isButton = Tag === 'button';
  return (
    <Tag
      ref={ref}
      type={isButton ? rest.type || 'button' : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={[
        'inline-flex shrink-0 items-center justify-center font-medium',
        'transition-colors duration-200 ease-out',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        full ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 15 : 17} />
      ) : (
        IconLeft && <IconLeft size={size === 'sm' ? 15 : 17} />
      )}
      {children}
      {!loading && IconRight && <IconRight size={size === 'sm' ? 15 : 17} />}
    </Tag>
  );
});

export default Button;
