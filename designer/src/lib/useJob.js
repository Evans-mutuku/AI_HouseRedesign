import { useCallback, useEffect, useRef, useState } from 'react';

import { getJob, cancelJob } from './api.js';

/**
 * Follow a background job to completion.
 *
 * Generation runs on the server now, so the browser's only role is to watch.
 * That means a refresh, a closed tab, or a dropped connection costs nothing -
 * pass the job id back in and polling resumes where it left off.
 *
 * Polling backs off as the job ages: fast while someone is watching the first
 * few seconds, slower once it is clearly a minute-long job.
 */
const FAST_MS = 1200;
const SLOW_MS = 3000;
const BACKOFF_AFTER_MS = 15_000;

export function useJob(jobId, { onDone } = {}) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const startedAt = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  // Keep the callback current without making it a polling dependency.
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!jobId) return undefined;

    let cancelled = false;
    let timer = null;
    doneRef.current = false;
    startedAt.current = Date.now(); // set here, not during render

    const poll = async () => {
      try {
        const next = await getJob(jobId);
        if (cancelled) return;
        setJob(next);
        setError('');

        if (['succeeded', 'failed', 'cancelled'].includes(next.status)) {
          if (!doneRef.current) {
            doneRef.current = true;
            onDoneRef.current?.(next);
          }
          return; // stop polling
        }
      } catch (err) {
        if (cancelled) return;
        // A transient failure should not kill the watch; keep polling and let
        // the next tick recover.
        setError(err.message);
      }
      const age = Date.now() - startedAt.current;
      timer = setTimeout(poll, age > BACKOFF_AFTER_MS ? SLOW_MS : FAST_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    try {
      await cancelJob(jobId);
      setJob((prev) => (prev ? { ...prev, status: 'cancelled', stage: 'Cancelled' } : prev));
    } catch (err) {
      setError(err.message);
    }
  }, [jobId]);

  return {
    job,
    error,
    cancel,
    running: Boolean(job && ['queued', 'running'].includes(job.status)),
    succeeded: job?.status === 'succeeded',
    failed: job?.status === 'failed',
  };
}
