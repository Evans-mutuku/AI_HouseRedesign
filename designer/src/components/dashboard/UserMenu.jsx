import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Icon from '../Icon.jsx';
import { useAuth, displayNameOf, initialsOf } from '../../lib/authContext.js';

/** Avatar: the Google photo when there is one, a monogram otherwise. */
export function Avatar({ size = 32 }) {
  const { user, account } = useAuth();
  const photo = account?.user?.photoUrl || user?.photoURL;
  const style = { width: size, height: size };

  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        referrerPolicy="no-referrer"
        style={style}
        className="shrink-0 rounded-full border border-line object-cover"
      />
    );
  }
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-canvas"
    >
      {initialsOf(user, account)}
    </span>
  );
}

/** Account dropdown in the top bar. */
export default function UserMenu() {
  const { user, account, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  const email = account?.user?.email || user?.email || '';
  const plan = account?.user?.plan === 'pro' ? 'Pro' : 'Free';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-canvas py-1 pl-1 pr-2.5 transition-colors hover:border-line-2"
      >
        <Avatar size={28} />
        <span className="hidden max-w-[9rem] truncate text-sm text-ink sm:block">
          {displayNameOf(user, account)}
        </span>
        <span className="text-muted">
          <Icon.ChevronDown size={15} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="hd-fade absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-[12px] border border-line bg-canvas shadow-[0_16px_40px_-16px_rgba(20,19,15,0.28)]"
        >
          <div className="border-b border-line px-4 py-3.5">
            <p className="truncate text-sm font-medium text-ink">
              {displayNameOf(user, account)}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">{email}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
              <Icon.Pro size={13} />
              {plan} plan
            </p>
          </div>

          <div className="p-1.5">
            <Link
              to="/app/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <Icon.Settings size={16} />
              Account settings
            </Link>
            <Link
              to="/app/storage"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <Icon.Storage size={16} />
              Storage & plan
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <Icon.SignOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
