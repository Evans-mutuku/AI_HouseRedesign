import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import AuthLayout from './AuthLayout.jsx';
import Button from '../components/ui/Button.jsx';
import { TextInput, PasswordInput } from '../components/ui/Field.jsx';
import { Banner } from '../components/ui/Surface.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../lib/authContext.js';
import { authErrorMessage } from '../lib/firebase.js';

export default function SignIn() {
  const { signIn, signInWithGoogle, resetPassword, firebaseReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  // Send people back to whatever they were trying to reach.
  const destination = location.state?.from?.pathname || '/app';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy('email');
    try {
      await signIn(email, password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    setBusy('google');
    try {
      await signInWithGoogle();
      navigate(destination, { replace: true });
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) setError(message);
    } finally {
      setBusy('');
    }
  };

  const handleReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address first, then choose "Forgot password".');
      return;
    }
    try {
      await resetPassword(email);
      setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to reach your boards, renders, and storage."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {!firebaseReady && (
        <Banner tone="danger" title="Sign-in is not configured" className="mb-6">
          Add your Firebase web config to <code>designer/.env</code> and restart
          the dev server.
        </Banner>
      )}

      {error && (
        <Banner tone="danger" className="mb-5" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="positive" className="mb-5" onDismiss={() => setNotice('')}>
          {notice}
        </Banner>
      )}

      <Button
        variant="secondary"
        size="lg"
        full
        icon={Icon.Google}
        loading={busy === 'google'}
        disabled={!firebaseReady || Boolean(busy)}
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          icon={Icon.Mail}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            required
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 text-xs text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          size="lg"
          full
          loading={busy === 'email'}
          disabled={!firebaseReady || Boolean(busy)}
        >
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
