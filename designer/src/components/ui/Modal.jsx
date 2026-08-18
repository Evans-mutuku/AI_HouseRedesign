import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Close } from '../Icon.jsx';

/**
 * A small, focused dialog - used for destructive confirmations and the upgrade
 * flow. Closes on Escape and on backdrop click, restores focus on unmount, and
 * locks body scroll while open.
 */
export default function Modal({ open, onClose, title, description, children, footer }) {
  const panelRef = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreTo.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // Move focus into the dialog so the keyboard does not stay behind it.
    const timer = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || panelRef.current)?.focus?.();
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(timer);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="hd-fade absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="hd-rise relative w-full max-w-md rounded-[16px] border border-line bg-canvas p-6 shadow-[0_24px_60px_-24px_rgba(20,19,15,0.35)] focus:outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-[8px] p-1.5 text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <Close size={17} />
        </button>

        {title && (
          <h2 className="pr-8 font-display text-lg font-semibold text-ink">{title}</h2>
        )}
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        )}
        {children && <div className="mt-5">{children}</div>}
        {footer && (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
