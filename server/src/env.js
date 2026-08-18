// Load environment from server/.env regardless of the current working
// directory. Import this FIRST (before db.js / anything reading process.env),
// since ESM executes imported modules in order and several modules read env at
// import time.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });
