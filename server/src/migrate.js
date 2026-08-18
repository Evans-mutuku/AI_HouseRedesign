// Applies schema.sql to the database in DATABASE_URL.
// Idempotent: every statement uses IF NOT EXISTS.
//
//   node src/migrate.js
//
import './env.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  console.log('[migrate] applying schema.sql …');
  await pool.query(sql);
  console.log('[migrate] done.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});
