// The marketing copy for the two plans, mirroring server/src/plans.js.
//
// The landing page is public, so it cannot ask the API what the plans are —
// this is the copy it renders. The server remains the only authority on what a
// plan actually grants; if the two drift, the server wins and the dashboard
// shows its numbers (it reads them from /api/me).

export const PLAN_CATALOG = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    storageLabel: '500 MB',
    blurb: 'Everything the studio does, with room for about a hundred redesigns.',
    features: [
      '500 MB of storage',
      'Full design boards — palette, materials, plan',
      'A rendered "after" image every time',
      'Your whole project history, kept',
    ],
    cta: 'Start free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: 'per month',
    storageLabel: '10 GB',
    blurb: 'For whole-home projects, repeat rooms, and client work.',
    features: [
      '10 GB of storage — 20× the free plan',
      'Everything in Free',
      'Priority rendering queue',
      'Keep every revision of every room',
    ],
    cta: 'Upgrade to Pro',
    featured: true,
  },
];
