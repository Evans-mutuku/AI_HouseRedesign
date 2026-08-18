import { Link } from 'react-router-dom';

import Wordmark from '../components/Wordmark.jsx';
import Icon from '../components/Icon.jsx';
import { readableOn } from '../lib/color.js';
import { SAMPLE } from '../lib/sample.js';

const POINTS = [
  'A palette pulled from your own room',
  'A keep, remove, and add plan with reasoning',
  'A render of your photo, redesigned',
];

/**
 * The frame shared by sign in and sign up. Form on the left; on wide screens, a
 * quiet panel on the right showing what the product actually returns, so the
 * page is never a bare form on white.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Form side */}
      <div className="flex flex-1 flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Wordmark />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <Icon.ArrowLeft size={15} />
            Back to site
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="hd-rise w-full max-w-sm">
            <h1 className="font-display text-display font-semibold text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-3 text-sm leading-relaxed text-muted">{subtitle}</p>
            )}
            <div className="mt-8">{children}</div>
          </div>
        </main>

        {footer && (
          <footer className="text-center text-sm text-muted">{footer}</footer>
        )}
      </div>

      {/* Product side */}
      <aside className="hidden w-[46%] max-w-2xl flex-col justify-center border-l border-line bg-surface px-12 lg:flex">
        <p className="text-eyebrow font-semibold uppercase text-accent">
          What lands in your dashboard
        </p>
        <p className="mt-5 max-w-md font-display text-title font-semibold leading-snug text-ink">
          {SAMPLE.concept}
        </p>

        <div className="mt-8 flex max-w-md overflow-hidden rounded-[12px] border border-line">
          {SAMPLE.palette.map((color) => (
            <div
              key={color.hex}
              className="flex h-24 flex-1 items-end p-2.5"
              style={{ backgroundColor: color.hex, color: readableOn(color.hex) }}
            >
              <span className="font-mono text-[10px] uppercase opacity-70">
                {color.hex}
              </span>
            </div>
          ))}
        </div>

        <ul className="mt-8 space-y-3.5">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm text-ink-2">
              <span className="mt-0.5 shrink-0 text-accent">
                <Icon.Check size={16} />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <p className="mt-10 flex items-center gap-2 text-xs text-muted">
          <Icon.Shield size={14} />
          Every redesign is private to the account that made it.
        </p>
      </aside>
    </div>
  );
}
