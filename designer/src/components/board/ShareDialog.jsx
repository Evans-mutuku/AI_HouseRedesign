import { useState } from 'react';

import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Banner } from '../ui/Surface.jsx';
import { Segmented } from '../ui/Field.jsx';
import Icon from '../Icon.jsx';
import { createShare, revokeShare } from '../../lib/api.js';

/**
 * Create or revoke a public link to one revision.
 *
 * The copy is explicit about what a link exposes, because "share" means very
 * different things to different people. A shared board carries the design - the
 * palette, the plan, the render - and deliberately not the budget, the
 * checklist, or anything else about the account that made it.
 */

const DURATIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiry' },
];

export default function ShareDialog({ open, onClose, redesignId, existingToken, onChange }) {
  const [token, setToken] = useState(existingToken || null);
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const url = token ? `${window.location.origin}/share/${token}` : '';

  const create = async () => {
    setBusy('create');
    setError('');
    try {
      const result = await createShare(redesignId, {
        days: days === 'never' ? undefined : Number(days),
        neverExpires: days === 'never',
      });
      setToken(result.token);
      onChange?.(result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const revoke = async () => {
    setBusy('revoke');
    setError('');
    try {
      await revokeShare(redesignId);
      setToken(null);
      onChange?.(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy - select the link and copy it manually.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this board"
      description="Anyone with the link can view the design. They cannot see your budget, your checklist, your other rooms, or anything about your account."
      footer={
        token ? (
          <>
            <Button
              variant="danger"
              icon={Icon.Close}
              loading={busy === 'revoke'}
              onClick={revoke}
            >
              Revoke link
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={Icon.ExternalLink} loading={busy === 'create'} onClick={create}>
              Create link
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {error && <Banner tone="danger">{error}</Banner>}

        {token ? (
          <>
            <div className="flex items-center gap-2 rounded-[10px] border border-line bg-surface p-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-ink focus:outline-none"
                aria-label="Share link"
              />
              <Button
                size="sm"
                variant={copied ? 'secondary' : 'primary'}
                icon={copied ? Icon.Check : undefined}
                onClick={copy}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Banner tone="info">
              The link stops working the moment you revoke it, and its images
              expire on their own a couple of hours after each visit.
            </Banner>
          </>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Link expires after</p>
            <Segmented label="Expiry" options={DURATIONS} value={days} onChange={setDays} />
          </div>
        )}
      </div>
    </Modal>
  );
}
