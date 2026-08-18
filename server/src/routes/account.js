// Account routes - profile, storage usage, and plan changes.
//
// Like the redesign routes, everything here reads `req.user`, which is derived
// only from a verified Firebase ID token. The client cannot name a different
// account, so there is no route by which one user reaches another's numbers.

import { Router } from 'express';

import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { PLANS, isPlanId, planFor, storageStatus } from '../plans.js';

const router = Router();

router.use(requireAuth);

const profileOf = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name,
  photoUrl: user.photo_url,
  plan: planFor(user).id,
  planSince: user.plan_since,
  createdAt: user.created_at,
});

/** Project counts, for the dashboard header. */
async function projectStats(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE r.after_image_path IS NOT NULL)::int AS rendered,
            MAX(r.created_at) AS last_created
       FROM redesigns r
       JOIN rooms rm ON rm.id = r.room_id
      WHERE rm.user_id = $1`,
    [userId],
  );
  const row = rows[0] || {};
  return {
    total: row.total || 0,
    rendered: row.rendered || 0,
    lastCreatedAt: row.last_created || null,
  };
}

/**
 * GET /api/me - everything the shell needs on load: who you are, what plan you
 * are on, how much of your quota is gone, and how many projects you have.
 */
router.get('/', async (req, res) => {
  try {
    return res.json({
      user: profileOf(req.user),
      storage: await storageStatus(req.user),
      projects: await projectStats(req.user.id),
      plans: Object.values(PLANS),
    });
  } catch (err) {
    console.error('[GET /me]', err);
    return res.status(500).json({ error: 'Could not load your account.' });
  }
});

/**
 * POST /api/me/plan - switch plans.
 *
 * There is no payment processor wired up: this records the choice so the quota
 * and the dashboard reflect it. Swap this handler for a checkout session (and
 * set the plan from the provider's webhook) when billing goes in - nothing else
 * in the app reads the plan directly, it all goes through plans.js.
 */
router.post('/plan', async (req, res) => {
  try {
    const plan = String(req.body?.plan || '').trim();
    if (!isPlanId(plan)) {
      return res.status(400).json({ error: 'Unknown plan.' });
    }
    if (plan === req.user.plan) {
      return res.json({
        user: profileOf(req.user),
        storage: await storageStatus(req.user),
      });
    }

    const { rows } = await query(
      `UPDATE users SET plan = $2, plan_since = now()
        WHERE id = $1 RETURNING *`,
      [req.user.id, plan],
    );
    const updated = rows[0];

    // Downgrading below current usage is allowed - we never delete a user's
    // work - but new uploads stay blocked until they are back under the cap.
    const storage = await storageStatus(updated);
    return res.json({
      user: profileOf(updated),
      storage,
      overQuota: storage.used > storage.limit,
    });
  } catch (err) {
    console.error('[POST /me/plan]', err);
    return res.status(500).json({ error: 'Could not change your plan.' });
  }
});

/**
 * GET /api/me/storage - the quota meter on its own, for cheap refreshes.
 */
router.get('/storage', async (req, res) => {
  try {
    return res.json(await storageStatus(req.user));
  } catch (err) {
    console.error('[GET /me/storage]', err);
    return res.status(500).json({ error: 'Could not load your storage usage.' });
  }
});

export default router;
