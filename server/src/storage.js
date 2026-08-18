// Storage abstraction.
//
// Uploaded originals and rendered "after" images are written to the local
// /uploads directory. Nothing here is web-readable on its own: the files are
// only ever reached through a signed, expiring URL (see media.js). The rest of
// the app talks to this interface alone (`save`, `absolutePath`, `remove`), so
// swapping to S3 / GCS / R2 later is a single-file change.
//
// Images are re-encoded before they get here - see assets.js, which is the only
// module that calls save().

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', 'uploads');
const PUBLIC_PREFIX = '/uploads';

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

class LocalDiskStorage {
  constructor() {
    this.dir = UPLOAD_DIR;
    this.ready = mkdir(this.dir, { recursive: true });
  }

  /**
   * Persist a buffer. Returns a storage-relative key (e.g. "/uploads/ab.jpg")
   * which is what we store in the DB and hand to the client.
   */
  async save(buffer, mime, originalName = '') {
    await this.ready;
    const ext = MIME_EXT[mime] || extname(originalName) || '.bin';
    const key = `${PUBLIC_PREFIX}/${randomUUID()}${ext}`;
    await writeFile(this.absolutePath(key), buffer);
    return key;
  }

  /** Where the bytes physically live (used when streaming a signed request). */
  absolutePath(key) {
    // basename() so a crafted key ("../../etc/passwd") can never escape the
    // upload directory, even though keys are only ever minted by save().
    return join(this.dir, basename(key.replace(`${PUBLIC_PREFIX}/`, '')));
  }

  /** Read an object back. Returns null if it is no longer there. */
  async read(key) {
    if (!key) return null;
    try {
      return await readFile(this.absolutePath(key));
    } catch {
      return null;
    }
  }

  /**
   * Delete a stored object. Best-effort and idempotent: a already-missing file
   * is not an error, because the row that referenced it is going away anyway.
   */
  async remove(key) {
    if (!key) return;
    try {
      await rm(this.absolutePath(key), { force: true });
    } catch (err) {
      console.error('[storage] could not remove', key, err.message);
    }
  }
}

export const storage = new LocalDiskStorage();
export { UPLOAD_DIR, PUBLIC_PREFIX };
