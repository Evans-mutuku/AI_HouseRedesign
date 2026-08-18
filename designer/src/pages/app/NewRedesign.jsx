import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import UploadZone from '../../components/UploadZone.jsx';
import Loading from '../../components/Loading.jsx';
import Button from '../../components/ui/Button.jsx';
import { ChipGroup, Segmented, TextArea } from '../../components/ui/Field.jsx';
import { Banner, Card, Eyebrow, SectionHeader } from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import { createRedesign } from '../../lib/api.js';
import { formatBytes } from '../../lib/format.js';
import { useAuth } from '../../lib/authContext.js';

const STYLES = [
  'Warm Minimal',
  'Japandi',
  'Mid-century',
  'Scandinavian',
  'Industrial',
  'Boho',
  'Coastal',
  'Classic',
];
const BUDGETS = ['Lean', 'Balanced', 'Premium'];

// Matches RENDER_RESERVE_BYTES on the server, so the warning here predicts the
// server's answer instead of contradicting it.
const RENDER_RESERVE = 3 * 1024 * 1024;

export default function NewRedesign() {
  const navigate = useNavigate();
  const { storage, plan, refreshAccount } = useAuth();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [intents, setIntents] = useState({
    style: 'Warm Minimal',
    budget: 'Balanced',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  // Revoke the object URL when it is replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Cancel an in-flight redesign if the user navigates away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const selectFile = (next) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setError('');
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl('');
    setError('');
  };

  // Predict the quota outcome so we can say so before spending a model call.
  const projected = file ? file.size + RENDER_RESERVE : 0;
  const wouldExceed = Boolean(
    file && storage && storage.used + projected > storage.limit,
  );

  const submit = async () => {
    if (!file || wouldExceed) return;
    setError('');
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await createRedesign({ file, ...intents }, controller.signal);
      await refreshAccount().catch(() => {});
      navigate(`/app/projects/${data.id}`, { state: { justCreated: true } });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div>
        <Loading />
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              abortRef.current?.abort();
              setSubmitting(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={file ? 'Step two' : 'Step one'}
        title={file ? 'Set the direction' : 'Start with your room'}
        description={
          file
            ? 'Everything below is optional — sensible defaults are already set.'
            : 'One photo of the room as it stands. No staging, no cleanup.'
        }
      />

      {error && (
        <Banner tone="danger" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}

      {wouldExceed && (
        <Banner
          tone="warn"
          title="Not enough storage for this redesign"
          action={
            <Button as={Link} to="/app/storage" size="sm" variant="secondary">
              {plan === 'pro' ? 'Manage' : 'Upgrade'}
            </Button>
          }
        >
          This photo plus its render needs about {formatBytes(projected)}, and you
          have {formatBytes(storage.remaining)} free. Delete a project
          {plan === 'pro' ? '' : ' or move to Pro for 10 GB'} to continue.
        </Banner>
      )}

      {!file ? (
        <UploadZone onSelect={selectFile} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* The before */}
          <div className="hd-rise lg:col-span-6">
            <Eyebrow className="mb-3">Your before</Eyebrow>
            <figure className="overflow-hidden rounded-[14px] border border-line bg-sunken">
              <img
                src={previewUrl}
                alt="The room you uploaded, before redesign"
                className="h-auto w-full object-cover"
              />
              <figcaption className="flex items-center justify-between border-t border-line bg-canvas px-4 py-3 text-xs text-muted">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 tnum">{formatBytes(file.size)}</span>
              </figcaption>
            </figure>
            <Button variant="ghost" size="sm" className="mt-3" onClick={clearFile}>
              Choose a different photo
            </Button>
          </div>

          {/* The intent */}
          <div
            className="hd-rise lg:col-span-6"
            style={{ animationDelay: '90ms' }}
          >
            <Card className="space-y-7">
              <div>
                <p className="text-sm font-medium text-ink">Style</p>
                <p className="mb-3 mt-1 text-xs text-muted">
                  Clear it to let the studio choose.
                </p>
                <ChipGroup
                  options={STYLES}
                  value={intents.style}
                  allowClear
                  onChange={(style) => setIntents((v) => ({ ...v, style }))}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-ink">Budget</p>
                <p className="mb-3 mt-1 text-xs text-muted">
                  Sets the price tier on the shopping list.
                </p>
                <Segmented
                  label="Budget"
                  options={BUDGETS}
                  value={intents.budget}
                  onChange={(budget) => setIntents((v) => ({ ...v, budget }))}
                />
              </div>

              <TextArea
                label="A note"
                rows={3}
                maxLength={600}
                placeholder="e.g. keep the sofa, more plants, calmer mornings"
                hint={`Optional. ${600 - intents.note.length} characters left.`}
                value={intents.note}
                onChange={(e) =>
                  setIntents((v) => ({ ...v, note: e.target.value }))
                }
              />
            </Card>

            <Button
              size="lg"
              full
              className="mt-5"
              icon={Icon.Sparkle}
              disabled={wouldExceed}
              onClick={submit}
            >
              Generate the direction
            </Button>

            <p className="mt-3 text-center text-xs text-muted">
              About a minute. Your photo and board stay private to your account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
