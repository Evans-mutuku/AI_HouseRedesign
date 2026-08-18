import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthLayout from './AuthLayout.jsx';
import Button from '../components/ui/Button.jsx';
import { TextInput, PasswordInput } from '../components/ui/Field.jsx';
import { Banner } from '../components/ui/Surface.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../lib/authContext.js';
import { authErrorMessage } from '../lib/firebase.js';

export default function SignUp() {
  const { signUp, signInWithGoogle, firebaseReady } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Use at least 6 characters for your password.');
      return;
    }
    setBusy('email');
    try {
      await signUp(name, email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
      navigate('/app', { replace: true });
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) setError(message);
    } finally {
      setBusy('');
    }
  };

  return (
    <AuthLayout
      title="Create your studio account"
      subtitle="Free forever, with 500 MB of storage. No card, no trial clock."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {!firebaseReady && (
        <Banner tone="danger" title="Sign-up is not configured" className="mb-6">
          Add your Firebase web config to <code>designer/.env</code> and restart
          the dev server.
        </Banner>
      )}

      {error && (
        <Banner tone="danger" className="mb-5" onDismiss={() => setError('')}>
          {error}
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
          label="Name"
          autoComplete="name"
          icon={Icon.User}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          required
          minLength={6}
          hint="At least 6 characters."
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          type="submit"
          size="lg"
          full
          loading={busy === 'email'}
          disabled={!firebaseReady || Boolean(busy)}
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <span className="mt-0.5 shrink-0">
          <Icon.Shield size={14} />
        </span>
        Your photos and boards stay private to this account. Nothing you upload is
        visible to another user.
      </p>
    </AuthLayout>
  );
}
