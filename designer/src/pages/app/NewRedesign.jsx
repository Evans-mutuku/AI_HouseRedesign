import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import UploadZone from '../../components/UploadZone.jsx';
import JobProgress from '../../components/dashboard/JobProgress.jsx';
import Button from '../../components/ui/Button.jsx';
import { ChipGroup, TextArea, TextInput } from '../../components/ui/Field.jsx';
import { Banner, Card, Eyebrow, SectionHeader } from '../../components/ui/Surface.jsx';
import Icon from '../../components/Icon.jsx';
import { createRoom, listHomes } from '../../lib/api.js';
import { useJob } from '../../lib/useJob.js';
import { formatBytes, parseMoneyToCents, CURRENCIES } from '../../lib/format.js';
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

// Matches RENDER_RESERVE_BYTES on the server so the warning here predicts the
// server's answer rather than contradicting it. Uploads are re-encoded on
// arrival, so what actually lands is a fraction of what is picked.
const RENDER_RESERVE = 2 * 1024 * 1024;

export default function NewRedesign() {
  const navigate = useNavigate();
  const { storage, plan, refreshAccount, applyStorage } = useAuth();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [form, setForm] = useState({
    name: '',
    style: 'Warm Minimal',
    budget: '',
    currency: 'USD',
    note: '',
    homeId: '',
  });
  const [homes, setHomes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    listHomes()
      .then(setHomes)
      .catch(() => {});
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const { job, running, cancel } = useJob(jobId, {
    onDone: (finished) => {
      refreshAccount().catch(() => {});
      if (finished.status === 'succeeded' && finished.roomId) {
        navigate(`/app/rooms/${finished.roomId}${finished.redesignId ? `?r=${finished.redesignId}` : ''}`, {
          state: { justCreated: true },
        });
      }
    },
  });

  const selectFile = (next) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setError('');
    if (!form.name) {
      // A sensible default the user can overwrite.
      setForm((f) => ({ ...f, name: '' }));
    }
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl('');
    setError('');
  };

  // Predict the quota answer before spending anything.
  const projected = file ? Math.min(file.size, 400 * 1024) + RENDER_RESERVE : 0;
  const wouldExceed = Boolean(file && storage && storage.used + projected > storage.limit);

  const submit = async () => {
    if (!file || wouldExceed) return;
    setError('');
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const budgetCents = parseMoneyToCents(form.budget);
      const result = await createRoom(
        {
          file,
          name: form.name,
          style: form.style,
          budget: budgetCents ? budgetCents / 100 : undefined,
          currency: form.currency,
          note: form.note,
          homeId: form.homeId || undefined,
        },
        controller.signal,
      );
      applyStorage(result.storage);
      setRoomId(result.roomId);
      setJobId(result.job.id);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Generating ─────────────────────────────────────────────────────────── */

  if (jobId) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-8">
        <SectionHeader
          eyebrow="In the studio"
          title="Reading your room"
          description="This takes about a minute. It runs on our servers, so you can leave this page — the board will be waiting in your rooms."
        />

        <JobProgress job={job} onCancel={cancel} />

        {job?.status === 'failed' && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setJobId(null);
                setError(job.error || '');
              }}
            >
              Try again
            </Button>
            <Button as={Link} to="/app/rooms" variant="secondary">
              Back to rooms
            </Button>
          </div>
        )}

        {running && roomId && (
          <Button as={Link} to={`/app/rooms/${roomId}`} variant="secondary" full>
            Watch it on the room page
          </Button>
        )}
      </div>
    );
  }

  /* ── Composing ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={file ? 'Step two' : 'Step one'}
        title={file ? 'Set the brief' : 'Start with your room'}
        description={
          file
            ? 'All optional — sensible defaults are already set. A real budget gets you a costed, phased plan.'
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
          You have {formatBytes(storage.remaining)} free. Empty your trash, delete a
          room{plan === 'pro' ? '' : ', or move to Pro for 10 GB'} to continue.
        </Banner>
      )}

      {!file ? (
        <UploadZone onSelect={selectFile} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
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
            <div className="mt-3 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={clearFile}>
                Choose a different photo
              </Button>
              <span className="text-xs text-muted">
                Compressed on upload — stored at a fraction of this
              </span>
            </div>
          </div>

          <div className="hd-rise lg:col-span-6" style={{ animationDelay: '90ms' }}>
            <Card className="space-y-6">
              <TextInput
                label="Room name"
                placeholder="e.g. Living room"
                hint="Optional — we'll name it from the photo if you leave this blank."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />

              <div>
                <p className="text-sm font-medium text-ink">Style</p>
                <p className="mb-3 mt-1 text-xs text-muted">
                  Clear it to let the studio choose.
                </p>
                <ChipGroup
                  options={STYLES}
                  value={form.style}
                  allowClear
                  onChange={(style) => setForm((f) => ({ ...f, style }))}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-ink">Budget</p>
                <p className="mb-3 mt-1 text-xs text-muted">
                  A real number gets you real prices, split into what you can do
                  this weekend, this month, and in full.
                </p>
                <div className="flex gap-2">
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    aria-label="Currency"
                    className="h-11 shrink-0 rounded-[10px] border border-line bg-canvas px-3 text-sm text-ink focus:border-ink focus:outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <TextInput
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 2400"
                    aria-label="Budget amount"
                    className="flex-1"
                    value={form.budget}
                    onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  />
                </div>
              </div>

              {homes.length > 0 && (
                <div>
                  <label
                    htmlFor="home-select"
                    className="mb-1.5 block text-sm font-medium text-ink"
                  >
                    Part of a home
                  </label>
                  <select
                    id="home-select"
                    value={form.homeId}
                    onChange={(e) => setForm((f) => ({ ...f, homeId: e.target.value }))}
                    className="h-11 w-full rounded-[10px] border border-line bg-canvas px-3 text-sm text-ink focus:border-ink focus:outline-none"
                  >
                    <option value="">Not part of a home</option>
                    {homes.map((home) => (
                      <option key={home.id} value={home.id}>
                        {home.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted">
                    Rooms in a home share a palette so the house reads as one scheme.
                  </p>
                </div>
              )}

              <TextArea
                label="A note"
                rows={3}
                maxLength={600}
                placeholder="e.g. keep the sofa, more plants, calmer mornings"
                hint={`Optional. ${600 - form.note.length} characters left.`}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Card>

            <Button
              size="lg"
              full
              className="mt-5"
              icon={Icon.Sparkle}
              loading={submitting}
              disabled={wouldExceed || submitting}
              onClick={submit}
            >
              Generate the direction
            </Button>

            <p className="mt-3 text-center text-xs text-muted">
              About a minute, and it runs in the background. Private to your account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
