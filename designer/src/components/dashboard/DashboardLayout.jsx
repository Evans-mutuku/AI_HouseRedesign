import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import Sidebar from './Sidebar.jsx';
import { NAV_ITEMS } from './navItems.js';
import UserMenu from './UserMenu.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../Icon.jsx';

/**
 * The app shell: a fixed rail on desktop, a drawer on mobile, and a top bar
 * that names the current page. Only the <main> region scrolls, so navigation
 * stays put no matter how long a board runs.
 */
export default function DashboardLayout() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock scroll while the drawer is open. (It closes itself on navigation -
  // every link inside it calls onNavigate.)
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const active = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to),
    );

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Rail - desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-line lg:block">
        <Sidebar />
      </aside>

      {/* Drawer - mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="hd-fade absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line shadow-[0_0_60px_rgba(20,19,15,0.2)]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 rounded-[8px] p-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <Icon.Close size={18} />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-[8px] p-2 text-ink transition-colors hover:bg-surface lg:hidden"
          >
            <Icon.Menu size={20} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {active?.label || 'Dashboard'}
          </h1>

          <Button
            as={Link}
            to="/app/new"
            size="sm"
            icon={Icon.Plus}
            className="hidden sm:inline-flex"
          >
            New redesign
          </Button>
          <Button
            as={Link}
            to="/app/new"
            size="sm"
            aria-label="New redesign"
            className="sm:hidden"
          >
            <Icon.Plus size={16} />
          </Button>

          <UserMenu />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
