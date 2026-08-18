// The job queue.
//
// Generation used to happen inside the POST that started it: a single HTTP
// request held open for the better part of a minute while three model calls ran.
// Closing the tab lost the work, a proxy timeout lost the work, and the client
// had no idea how far along it was.
//
// Now the request enqueues and returns immediately. A worker in the same
// process claims the row and reports progress back through it, so the browser
// can poll, reconnect, or be closed entirely without losing anything.
//
// Claiming uses `FOR UPDATE SKIP LOCKED`, which is the standard Postgres way to
// hand one row to exactly one worker. That is not needed for a single process,
// but it means running a second instance is a deployment decision rather than a
// rewrite.

import { query } from './db.js';

export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/** A job left running longer than this is assumed dead and is retried. */
const STALE_AFTER_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 2;

export async function enqueue({ userId, kind, roomId = null, input = {} }) {
  const { rows } = await query(
    `INSERT INTO jobs (user_id, kind, room_id, input_json, stage)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, kind, roomId, input, 'Queued'],
  );
  return rows[0];
}

/**
 * Claim the next runnable job. Returns null when there is nothing to do.
 * Also picks up jobs whose worker died mid-run, provided they have an attempt
 * left.
 */
export async function claimNext() {
  const { rows } = await query(
    `UPDATE jobs SET
       status     = 'running',
       attempts   = attempts + 1,
       locked_at  = now(),
       started_at = COALESCE(started_at, now()),
       stage      = 'Starting'
     WHERE id = (
       SELECT id FROM jobs
        WHERE (
          status = 'queued'
          OR (status = 'running' AND locked_at < now() - ($1::int * interval '1 millisecond'))
        )
        AND attempts < $2
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     RETURNING *`,
    [STALE_AFTER_MS, MAX_ATTEMPTS],
  );
  return rows[0] || null;
}

/** Push a progress update the client can poll for. */
export async function report(jobId, { stage, progress }) {
  await query(
    `UPDATE jobs SET
       stage     = COALESCE($2, stage),
       progress  = COALESCE($3, progress),
       locked_at = now()
     WHERE id = $1`,
    [jobId, stage ?? null, progress ?? null],
  );
}

export async function succeed(jobId, { redesignId, roomId }) {
  await query(
    `UPDATE jobs SET
       status = 'succeeded', progress = 100, stage = 'Done',
       redesign_id = $2, room_id = COALESCE($3, room_id),
       error = NULL, finished_at = now()
     WHERE id = $1`,
    [jobId, redesignId, roomId ?? null],
  );
}

export async function fail(jobId, message, { retryable = false } = {}) {
  // A retryable failure goes back on the queue if it has an attempt left;
  // claimNext() enforces the ceiling.
  await query(
    `UPDATE jobs SET
       status = CASE
         WHEN $3::boolean AND attempts < $4 THEN 'queued'
         ELSE 'failed'
       END,
       stage = CASE WHEN $3::boolean AND attempts < $4 THEN 'Retrying' ELSE 'Failed' END,
       error = $2,
       locked_at = NULL,
       finished_at = CASE WHEN $3::boolean AND attempts < $4 THEN NULL ELSE now() END
     WHERE id = $1`,
    [jobId, String(message || 'Unknown error').slice(0, 500), retryable, MAX_ATTEMPTS],
  );
}

export async function cancel(jobId, userId) {
  const { rows } = await query(
    `UPDATE jobs SET status = 'cancelled', stage = 'Cancelled', finished_at = now()
      WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')
      RETURNING id`,
    [jobId, userId],
  );
  return rows.length > 0;
}

export async function isCancelled(jobId) {
  const { rows } = await query('SELECT status FROM jobs WHERE id = $1', [jobId]);
  return rows[0]?.status === JOB_STATUS.CANCELLED;
}

/** One job, scoped to its owner. */
export async function getJob(jobId, userId) {
  const { rows } = await query(
    `SELECT j.*, r.id AS r_id
       FROM jobs j
       LEFT JOIN redesigns r ON r.id = j.redesign_id AND r.deleted_at IS NULL
      WHERE j.id = $1 AND j.user_id = $2`,
    [jobId, userId],
  );
  return rows[0] || null;
}

/** Anything still in flight for this user - used to restore the UI on reload. */
export async function activeJobs(userId) {
  const { rows } = await query(
    `SELECT * FROM jobs
      WHERE user_id = $1 AND status IN ('queued', 'running')
      ORDER BY created_at DESC LIMIT 10`,
    [userId],
  );
  return rows;
}

export const toJobResponse = (job) => ({
  id: job.id,
  kind: job.kind,
  status: job.status,
  stage: job.stage,
  progress: job.progress,
  roomId: job.room_id,
  redesignId: job.redesign_id,
  error: job.error,
  createdAt: job.created_at,
  finishedAt: job.finished_at,
});

export { MAX_ATTEMPTS };
