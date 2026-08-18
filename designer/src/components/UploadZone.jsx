import { useCallback, useRef, useState } from 'react';

import Icon from './Icon.jsx';
import { formatBytes } from '../lib/format.js';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Drop target for the room photo. Validates type and size here so an obviously
 * bad file never becomes a round trip — the server enforces the same limits.
 */
export default function UploadZone({ onSelect, onError }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const fail = useCallback(
    (message) => {
      setError(message);
      onError?.(message);
    },
    [onError],
  );

  const handleFiles = useCallback(
    (files) => {
      setError('');
      const file = files?.[0];
      if (!file) return;
      if (!ACCEPT.includes(file.type)) {
        fail('That file type is not supported. Use JPG, PNG, or WebP.');
        return;
      }
      if (file.size > MAX_BYTES) {
        fail(
          `That image is ${formatBytes(file.size)} — the limit is 8 MB. Try a smaller file.`,
        );
        return;
      }
      onSelect(file);
    },
    [fail, onSelect],
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`group flex w-full flex-col items-center justify-center gap-4 rounded-[14px] border-2 border-dashed px-6 py-16 text-center transition-all duration-300 ease-out sm:py-20 ${
          dragging
            ? 'border-accent bg-accent-soft'
            : 'border-line-2 bg-surface hover:border-ink/35 hover:bg-sunken'
        }`}
      >
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300 ${
            dragging
              ? 'border-accent/30 bg-canvas text-accent'
              : 'border-line bg-canvas text-muted group-hover:-translate-y-0.5 group-hover:text-ink'
          }`}
        >
          <Icon.Upload size={21} />
        </span>

        <span className="font-display text-lg font-semibold text-ink">
          {dragging ? 'Drop it here' : 'Drop a photo of your room'}
        </span>
        <span className="max-w-sm text-sm leading-relaxed text-muted">
          Or click to browse. One image — JPG, PNG, or WebP, up to 8 MB. This
          becomes your <span className="text-ink">before</span>.
        </span>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </button>

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-danger" role="alert">
          <Icon.Alert size={15} />
          {error}
        </p>
      )}
    </div>
  );
}

export { MAX_BYTES, ACCEPT };
