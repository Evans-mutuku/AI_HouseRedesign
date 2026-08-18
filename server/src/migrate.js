// Applies schema.sql, then brings older rows up to the current shape.
// Idempotent end to end: safe to run on every deploy.
//
//   npm run migrate
//
import './env.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';
import { runBackfill } from './backfill.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  console.log('[migrate] applying schema.sql …');
  await pool.query(sql);
  console.log('[migrate] schema up to date.');

  console.log('[migrate] backfilling …');
  await runBackfill();

  await pool.end();
}

main().catch(async (err) => {
  console.error('[migrate] failed:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
