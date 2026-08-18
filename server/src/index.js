import './env.js';
import express from 'express';
import cors from 'cors';

import { storage } from './storage.js';
import { authConfigured } from './auth.js';
import { startWorker } from './worker.js';
import { startJanitor } from './janitor.js';

import roomRoutes from './routes/rooms.js';
import redesignRoutes from './routes/redesigns.js';
import libraryRoutes from './routes/library.js';
import accountRoutes from './routes/account.js';
import mediaRoutes from './routes/media.js';
import shareRoutes from './routes/share.js';

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.use(cors()); // dev convenience; in prod serve client same-origin
app.use(express.json({ limit: '1mb' }));

// Note: there is deliberately no express.static mount for /uploads. Room photos
// and renders belong to one account each and are served only through
// /api/media/:file, which requires a signature (see media.js).

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
    images: Boolean(process.env.OPENAI_API_KEY),
    auth: authConfigured(),
  });
});

// Distinct prefixes, so a request passes through exactly one router - and
// therefore verifies its token exactly once. `/api/share` is the one public
// data route; it authenticates on the token in the path instead.
app.use('/api/media', mediaRoutes);
app.use('/api', shareRoutes);
app.use('/api/me', accountRoutes);
app.use('/api', libraryRoutes);
app.use('/api', redesignRoutes);
app.use('/api', roomRoutes);

// 404 + final error guard (JSON, never HTML).
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  void storage; // ensure the upload dir exists at boot
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[server] ANTHROPIC_API_KEY is not set - redesigns will fail.');
  }
  if (!authConfigured()) {
    console.warn('[server] FIREBASE_PROJECT_ID is not set - sign-in will fail.');
  }

  // Generation runs out of band; the janitor clears expired trash.
  startWorker();
  startJanitor();
});
