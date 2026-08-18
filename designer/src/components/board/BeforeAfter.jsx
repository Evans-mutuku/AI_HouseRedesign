import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '../Icon.jsx';
import { Badge } from '../ui/Surface.jsx';

/**
 * Draggable before/after comparison.
 *
 * A toggle makes you remember the other image; a slider lets you see the change
 * happen. The handle is keyboard-operable (arrows, Home/End) because a
 * mouse-only comparison is no comparison at all for some people.
 *
 * The two images are stacked, and the "after" is revealed by clipping rather
 * than resizing, so nothing reflows or distorts as the handle moves.
 */
export default function BeforeAfter({ beforeUrl, afterUrl, className = '' }) {
  const [position, setPosition] = useState(55);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef(null);

  const setFromClientX = useCallback((clientX) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  // Listen on the window while dragging so the pointer can leave the frame
  // without the handle sticking.
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => {
      event.preventDefault();
      setFromClientX(event.touches ? event.touches[0].clientX : event.clientX);
    };
    const stop = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', stop);
    };
  }, [dragging, setFromClientX]);

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - step));
    else if (event.key === 'ArrowRight') setPosition((p) => Math.min(100, p + step));
    else if (event.key === 'Home') setPosition(0);
    else if (event.key === 'End') setPosition(100);
    else return;
    event.preventDefault();
  };

  if (!afterUrl) {
    return (
      <figure className={`overflow-hidden rounded-[14px] border border-line bg-sunken ${className}`}>
        <img src={beforeUrl} alt="The room before redesign" className="h-auto w-full" />
        <figcaption className="border-t border-line bg-canvas px-4 py-3 text-eyebrow font-semibold uppercase text-muted">
          Before — your photo
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={`overflow-hidden rounded-[14px] border border-line bg-sunken ${className}`}>
      <div
        ref={frameRef}
        className="relative select-none overflow-hidden"
        onMouseDown={(event) => {
          setDragging(true);
          setFromClientX(event.clientX);
        }}
        onTouchStart={(event) => {
          setDragging(true);
          setFromClientX(event.touches[0].clientX);
        }}
      >
        {/* After sits underneath and defines the frame's height. */}
        <img
          src={afterUrl}
          alt="The room reimagined in the new design direction"
          className="block h-auto w-full"
          draggable={false}
        />

        {/* Before is clipped over the top. */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={beforeUrl}
            alt="The room before redesign"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <span className="pointer-events-none absolute left-3 top-3">
          <Badge tone="neutral" className="bg-canvas/90 backdrop-blur-sm">Before</Badge>
        </span>
        <span className="pointer-events-none absolute right-3 top-3">
          <Badge tone="accent" icon={Icon.Sparkle} className="bg-canvas/90 backdrop-blur-sm">
            After
          </Badge>
        </span>

        {/* The handle */}
        <div
          className="absolute inset-y-0 w-px bg-canvas shadow-[0_0_0_1px_rgba(20,19,15,0.15)]"
          style={{ left: `${position}%` }}
        >
          <button
            type="button"
            role="slider"
            aria-label="Compare before and after"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${Math.round(position)}% before`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onMouseDown={(event) => {
              event.stopPropagation();
              setDragging(true);
            }}
            onTouchStart={(event) => {
              event.stopPropagation();
              setDragging(true);
            }}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 cursor-ew-resize items-center justify-center rounded-full border border-line bg-canvas text-ink shadow-[0_2px_10px_rgba(20,19,15,0.2)] transition-transform ${
              dragging ? 'scale-110' : 'hover:scale-105'
            }`}
          >
            <span className="flex items-center -space-x-1">
              <Icon.ArrowLeft size={13} />
              <Icon.ArrowRight size={13} />
            </span>
          </button>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas px-4 py-3">
        <span className="text-eyebrow font-semibold uppercase text-muted">
          Drag to compare
        </span>
        <span className="text-xs text-muted">
          Your photo, edited — same room, same camera
        </span>
      </figcaption>
    </figure>
  );
}
