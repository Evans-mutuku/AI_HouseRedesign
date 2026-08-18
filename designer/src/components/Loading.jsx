import { useEffect, useState } from 'react';

import { Eyebrow } from './ui/Surface.jsx';

// Calm and intentional — a sweeping hairline and a status line in the studio's
// voice. It should read like a designer thinking, not a spinner.
const STATUSES = [
  'Reading the room',
  'Reading the light',
  'Noting the materials',
  'Pulling a palette from the space',
  'Composing the direction',
  'Rendering the room redesigned',
  'Setting the board',
];

export default function Loading({ compact = false }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((n) => Math.min(n + 1, STATUSES.length - 1));
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`hd-fade flex flex-col items-center justify-center text-center ${
        compact ? 'py-16' : 'min-h-[55vh] py-10'
      }`}
    >
      <Eyebrow tone="accent" className="mb-8">
        In the studio
      </Eyebrow>

      <div className="relative h-px w-64 max-w-[70vw] overflow-hidden bg-line">
        <span
          className="absolute top-0 h-px bg-accent"
          style={{ animation: 'hd-sweep 1.7s var(--ease-out) infinite' }}
        />
      </div>

      <p
        key={index}
        className="hd-fade mt-7 font-display text-title font-semibold text-ink"
        aria-live="polite"
      >
        {STATUSES[index]}…
      </p>
      <p className="mt-3 max-w-sm text-sm text-muted">
        This usually takes under a minute. Leaving the page cancels the redesign.
      </p>
    </div>
  );
}
