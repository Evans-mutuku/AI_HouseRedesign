// Firebase client setup.
//
// These values are the *public* web config — Firebase is designed for them to
// ship in the bundle, and they grant nothing on their own. Access is decided by
// the ID token the SDK mints after a real sign-in, which our API verifies
// server-side. Nothing secret belongs in this file.
//
// Values come from designer/.env (VITE_FIREBASE_*) so a different project can
// be pointed at without touching code.

import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

const app = firebaseReady ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;

// Keep the session across reloads and tabs — a dashboard that logs you out on
// refresh is not a dashboard.
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    /* storage blocked (private mode); Firebase falls back on its own */
  });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Turn a Firebase error code into something worth showing a person. */
export function authErrorMessage(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for your password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email. Sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow popups and retry.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in your Firebase project. Add it under Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is disabled in your Firebase project. Enable it under Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network problem — check your connection and try again.';
    default:
      return err?.message?.replace(/^Firebase:\s*/, '') || 'Something went wrong.';
  }
}
