// The auth context and the helpers that read from it.
//
// Kept apart from auth.jsx (which holds the provider component) so that files
// exporting React components export nothing else — the condition Fast Refresh
// needs to hot-swap a component without dropping app state.

import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The best human label we have for the signed-in person. */
export function displayNameOf(user, account) {
  return (
    account?.user?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'there'
  );
}

/** Two-letter monogram for the avatar, when there is no photo. */
export function initialsOf(user, account) {
  const name = account?.user?.displayName || user?.displayName || '';
  if (name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  const email = account?.user?.email || user?.email || '';
  return (email.slice(0, 2) || '··').toUpperCase();
}
