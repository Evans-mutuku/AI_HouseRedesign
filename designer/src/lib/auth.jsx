// Auth state for the whole app.
//
// Holds two things: the Firebase user (identity) and the account record the API
// returns (plan, storage, project counts). Components read both through
// `useAuth()` from authContext.js; nothing else in the app talks to Firebase
// directly except the sign-in screens.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { AuthContext } from './authContext.js';
import { auth, firebaseReady, googleProvider } from './firebase.js';
import { setTokenProvider, getAccount } from './api.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // Firebase user
  const [account, setAccount] = useState(null);    // our API's /me payload
  const [accountFor, setAccountFor] = useState(null); // uid `account` describes
  // Firebase has not reported yet — unless it is not configured, in which case
  // there is nothing to wait for.
  const [resolving, setResolving] = useState(firebaseReady);
  const userRef = useRef(null);

  // Every API call asks for a current ID token through this hook. Firebase
  // caches and refreshes internally, so it is cheap on the hot path.
  useEffect(() => {
    setTokenProvider(async () => {
      const current = userRef.current;
      if (!current) return null;
      return current.getIdToken();
    });
  }, []);

  // onIdTokenChanged (not onAuthStateChanged) so a token refresh keeps the ref
  // pointing at a user object that can still mint tokens.
  useEffect(() => {
    if (!firebaseReady) return undefined;
    return onIdTokenChanged(auth, (next) => {
      userRef.current = next;
      setUser(next);
      setResolving(false);
      if (!next) {
        setAccount(null);
        setAccountFor(null);
      }
    });
  }, []);

  const refreshAccount = useCallback(async () => {
    const current = userRef.current;
    if (!current) return null;
    const data = await getAccount();
    setAccount(data);
    setAccountFor(current.uid);
    return data;
  }, []);

  // Load the account record whenever the signed-in identity changes.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getAccount()
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
        setAccountFor(user.uid);
      })
      .catch(() => {
        if (cancelled) return;
        // Mark it resolved even on failure, so the shell renders and the page
        // can show its own error rather than spinning forever.
        setAccount(null);
        setAccountFor(user.uid);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Merge a fresh storage object returned by a mutating call. */
  const applyStorage = useCallback((storage) => {
    if (!storage) return;
    setAccount((prev) => (prev ? { ...prev, storage } : prev));
  }, []);

  // Derived, so no effect has to push a loading flag around.
  const loading = resolving || Boolean(user && accountFor !== user.uid);

  const value = useMemo(
    () => ({
      user,
      account,
      loading,
      firebaseReady,
      storage: account?.storage || null,
      plan: account?.user?.plan || 'free',
      plans: account?.plans || [],
      refreshAccount,
      applyStorage,
      setAccount,

      signIn: (email, password) =>
        signInWithEmailAndPassword(auth, email.trim(), password),

      signUp: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        const displayName = name.trim();
        if (displayName) {
          await updateProfile(cred.user, { displayName });
          // Force a token refresh so the API sees the name on first contact.
          await cred.user.getIdToken(true);
          setUser({ ...cred.user });
        }
        return cred.user;
      },

      signInWithGoogle: () => signInWithPopup(auth, googleProvider),

      // Firebase is the source of truth for the profile; our `users` row caches
      // it and re-syncs on the next verified request.
      updateDisplayName: async (name) => {
        const current = userRef.current;
        if (!current) return;
        await updateProfile(current, { displayName: name.trim() });
        await current.getIdToken(true);
        setUser({ ...current });
        await refreshAccount().catch(() => {});
      },

      resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),

      signOut: async () => {
        await signOut(auth);
        setAccount(null);
        setAccountFor(null);
      },
    }),
    [user, account, loading, refreshAccount, applyStorage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
