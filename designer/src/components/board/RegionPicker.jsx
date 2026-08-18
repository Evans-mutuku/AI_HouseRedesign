import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '../Icon.jsx';
import Button from '../ui/Button.jsx';

/**
 * Drag a box over the part of the room you want changed.
 *
 * This drives a masked edit: everything outside the box comes back untouched,
 * pixel for pixel. That is the difference between "restyle my room" and "just
 * do something about that fireplace wall" - and it removes the biggest
 * complaint about whole-image edits, which is that they quietly alter things
 * you were happy with.
 *
 * The rectangle is emitted in normalised 0–1 coordinates so it survives any
 * display size and matches whatever resolution the server holds.
 */
export default function RegionPicker({ src, value, onChange, className = '' }) {
  const frameRef = useRef(null);
  const [drag, setDrag] = useState(null); // {startX, startY, x, y} in 0–1

  const pointToUnit = useCallback((clientX, clientY) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const rectOf = (d) =>
    d && {
      x: Math.min(d.startX, d.x),
      y: Math.min(d.startY, d.y),
      w: Math.abs(d.x - d.startX),
      h: Math.abs(d.y - d.startY),
    };

  useEffect(() => {
    if (!drag) return undefined;
    const move = (event) => {
      event.preventDefault();
      const point = pointToUnit(
        event.touches ? event.touches[0].clientX : event.clientX,
        event.touches ? event.touches[0].clientY : event.clientY,
      );
      if (point) setDrag((d) => (d ? { ...d, ...point } : d));
    };
    const stop = () => {
      setDrag((d) => {
        const rect = rectOf(d);
        // Ignore a stray click; a mask that small produces mush anyway.
        if (rect && rect.w > 0.03 && rect.h > 0.03) onChange?.(rect);
        return null;
      });
    };
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
  }, [drag, onChange, pointToUnit]);

  const start = (clientX, clientY) => {
    const point = pointToUnit(clientX, clientY);
    if (point) setDrag({ startX: point.x, startY: point.y, ...point });
  };

  const active = rectOf(drag) || value;

  return (
    <div className={className}>
      <div
        ref={frameRef}
        className="relative cursor-crosshair select-none overflow-hidden rounded-[14px] border border-line bg-sunken"
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <img
          src={src}
          alt="Your room - drag to select the area to change"
          className="block h-auto w-full"
          draggable={false}
        />

        {/* Dim everything outside the selection so the target is unmistakable. */}
        {active && (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-ink/45"
              style={{
                clipPath: `polygon(0% 0%, 0% 100%, ${active.x * 100}% 100%, ${active.x * 100}% ${active.y * 100}%, ${(active.x + active.w) * 100}% ${active.y * 100}%, ${(active.x + active.w) * 100}% ${(active.y + active.h) * 100}%, ${active.x * 100}% ${(active.y + active.h) * 100}%, ${active.x * 100}% 100%, 100% 100%, 100% 0%)`,
              }}
            />
            <div
              className="pointer-events-none absolute border-2 border-accent"
              style={{
                left: `${active.x * 100}%`,
                top: `${active.y * 100}%`,
                width: `${active.w * 100}%`,
                height: `${active.h * 100}%`,
              }}
            />
          </>
        )}

        {!active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border border-line bg-canvas/90 px-4 py-2 text-xs font-medium text-ink backdrop-blur-sm">
              Drag a box over the area to change
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted">
          {value
            ? 'Only this area will be edited - everything else stays exactly as it is.'
            : 'Optional. Leave it clear to restyle the whole room.'}
        </p>
        {value && (
          <Button variant="ghost" size="sm" icon={Icon.Close} onClick={() => onChange?.(null)}>
            Clear area
          </Button>
        )}
      </div>
    </div>
  );
}
