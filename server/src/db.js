import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    '[db] DATABASE_URL is not set. Set it in server/.env before starting.',
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers require SSL; local does not.
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[db] unexpected idle client error', err);
});

export const query = (text, params) => pool.query(text, params);

/**
 * Run `fn` inside a transaction, committing on success and rolling back on any
 * throw. The client is always released.
 *
 *   const row = await withTransaction((client) => client.query(...));
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
