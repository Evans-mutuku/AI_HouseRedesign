import { Link } from 'react-router-dom';
import { Logomark } from './Icon.jsx';

/** The brand lockup. One component so the mark never drifts between surfaces. */
export default function Wordmark({ to = '/', size = 'md', className = '' }) {
  const text = size === 'sm' ? 'text-base' : 'text-lg';
  const mark = size === 'sm' ? 19 : 21;
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2.5 text-ink transition-opacity hover:opacity-70 ${className}`}
      aria-label="STUDIO — home"
    >
      <span className="text-accent">
        <Logomark size={mark} />
      </span>
      <span className={`font-display font-semibold tracking-tight ${text}`}>
        STUDIO
      </span>
    </Link>
  );
}
