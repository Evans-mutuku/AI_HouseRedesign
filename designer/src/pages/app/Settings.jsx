import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import { TextInput } from '../../components/ui/Field.jsx';
import {
  Badge,
  Banner,
  Card,
  DataRow,
  SectionHeader,
} from '../../components/ui/Surface.jsx';
import { Avatar } from '../../components/dashboard/UserMenu.jsx';
import Icon from '../../components/Icon.jsx';
import { formatBytes, formatDate } from '../../lib/format.js';
import { useAuth, displayNameOf } from '../../lib/authContext.js';
import { authErrorMessage } from '../../lib/firebase.js';

export default function Settings() {
  const {
    user,
    account,
    storage,
    plan,
    updateDisplayName,
    resetPassword,
    signOut,
  } = useAuth();
  const navigate = useNavigate();

  // The field shows what the user typed if they have typed, and the saved name
  // otherwise - so a profile refresh never clobbers an edit in progress, and no
  // effect has to mirror one piece of state into another.
  const [draftName, setDraftName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const email = account?.user?.email || user?.email || '';
  const currentName = account?.user?.displayName || user?.displayName || '';
  const name = draftName ?? currentName;
  const dirty = name.trim() !== currentName.trim();

  // Google accounts have no password for us to reset.
  const hasPassword = Boolean(
    user?.providerData?.some((p) => p.providerId === 'password'),
  );

  const saveName = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await updateDisplayName(name);
      setDraftName(null);
      setNotice('Your name has been updated.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    setError('');
    setNotice('');
    setBusy('reset');
    try {
      await resetPassword(email);
      setNotice(`A password reset link is on its way to ${email}.`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const handleSignOut = async () => {
    setBusy('signout');
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Settings"
        description="Your identity, your plan, and how your work is kept."
      />

      {error && (
        <Banner tone="danger" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="positive" onDismiss={() => setNotice('')}>
          {notice}
        </Banner>
      )}

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-4 border-b border-line pb-6">
          <Avatar size={52} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold text-ink">
              {displayNameOf(user, account)}
            </p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>

        <form onSubmit={saveName} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput
            label="Display name"
            className="flex-1"
            placeholder="Your name"
            value={name}
            onChange={(e) => setDraftName(e.target.value)}
          />
          <Button type="submit" loading={saving} disabled={!dirty || saving}>
            Save
          </Button>
        </form>
      </Card>

      {/* Account */}
      <section>
        <SectionHeader title="Account" />
        <Card className="mt-6" padded={false}>
          <div className="px-5 sm:px-6">
            <DataRow label="Email" value={email} />
            <DataRow
              label="Sign-in method"
              value={hasPassword ? 'Email and password' : 'Google'}
              action={
                hasPassword ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === 'reset'}
                    onClick={sendReset}
                  >
                    Send reset link
                  </Button>
                ) : null
              }
            />
            <DataRow label="Member since" value={formatDate(account?.user?.createdAt)} />
            <DataRow
              label="Plan"
              value={plan === 'pro' ? 'Pro - 10 GB' : 'Free - 500 MB'}
              action={
                <Button as={Link} to="/app/storage" variant="secondary" size="sm">
                  {plan === 'pro' ? 'Manage' : 'Upgrade'}
                </Button>
              }
            />
            <DataRow
              label="Storage used"
              value={
                storage
                  ? `${formatBytes(storage.used)} of ${formatBytes(storage.limit)}`
                  : '-'
              }
              action={
                <Badge tone={storage?.percent >= 80 ? 'warn' : 'neutral'}>
                  {Math.round(storage?.percent ?? 0)}%
                </Badge>
              }
            />
            <DataRow
              label="Projects"
              value={`${account?.projects?.total ?? 0} redesigns · ${account?.projects?.rendered ?? 0} rendered`}
            />
          </div>
        </Card>
      </section>

      {/* Privacy */}
      <section>
        <SectionHeader title="Privacy" />
        <Card className="mt-6">
          <div className="flex gap-4">
            <span className="mt-0.5 shrink-0 text-accent">
              <Icon.Shield size={20} />
            </span>
            <div className="space-y-2.5 text-sm leading-relaxed text-muted">
              <p>
                Every room photo, board, and render belongs to this account alone.
                The API resolves who you are from your sign-in token, never from
                anything the browser sends, so no other user can request your
                work.
              </p>
              <p>
                Images are served through short-lived signed links rather than
                public URLs - a link that leaks stops working, and cannot be
                pointed at anyone else's files.
              </p>
              <p>
                Deleting a project erases the board row, the original photo, and
                the render from storage, and returns the space to your quota.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Session */}
      <section>
        <SectionHeader title="Session" />
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Sign out of this browser</p>
            <p className="mt-1 text-sm text-muted">
              Your projects stay exactly where they are.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={Icon.SignOut}
            loading={busy === 'signout'}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </Card>
      </section>
    </div>
  );
}
