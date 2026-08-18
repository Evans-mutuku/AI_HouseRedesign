import { NavLink } from 'react-router-dom';

import Wordmark from '../Wordmark.jsx';
import Icon from '../Icon.jsx';
import { NAV_ITEMS } from './navItems.js';
import { Meter } from '../ui/Surface.jsx';
import { formatBytes } from '../../lib/format.js';
import { useAuth } from '../../lib/authContext.js';

function NavItem({ item, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors duration-150',
          isActive
            ? 'bg-canvas font-medium text-ink shadow-[0_1px_2px_rgba(20,19,15,0.06)]'
            : 'text-muted hover:bg-canvas/70 hover:text-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-accent' : ''}>
            <item.icon size={18} />
          </span>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

/**
 * The persistent left rail: brand, primary navigation, and a live storage meter
 * that doubles as the route into the plan page.
 */
export default function Sidebar({ onNavigate }) {
  const { storage, plan } = useAuth();

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Wordmark to="/app" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 thin-scroll" aria-label="Dashboard">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="shrink-0 p-3">
        <NavLink
          to="/app/storage"
          onClick={onNavigate}
          className="block rounded-[12px] border border-line bg-canvas p-4 transition-colors hover:border-line-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">Storage</span>
            <span className="text-eyebrow font-semibold uppercase text-muted">
              {plan === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>

          <Meter percent={storage?.percent ?? 0} className="mt-3" />

          <p className="mt-2.5 text-xs text-muted tnum">
            {storage
              ? `${formatBytes(storage.used)} of ${formatBytes(storage.limit)}`
              : 'Loading…'}
          </p>

          {plan !== 'pro' && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              Upgrade for 10 GB
              <Icon.ArrowRight size={13} />
            </p>
          )}
        </NavLink>
      </div>
    </div>
  );
}
