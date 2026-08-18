// Minimal, dependency-free image dimension reader for PNG / JPEG / WebP.
// Returns { width, height } or { width: null, height: null } if it can't tell.
// We avoid pulling in an image library just to fill two metadata columns.

export function imageSize(buf) {
  try {
    // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
    if (
      buf.length >= 24 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    // JPEG: scan SOF0..SOF15 markers.
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) {
          off++;
          continue;
        }
        const marker = buf[off + 1];
        const len = buf.readUInt16BE(off + 2);
        // SOF markers carry frame dimensions (skip DHT/DQT/etc).
        if (
          (marker >= 0xc0 && marker <= 0xcf) &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          return {
            height: buf.readUInt16BE(off + 5),
            width: buf.readUInt16BE(off + 7),
          };
        }
        off += 2 + len;
      }
    }

    // WebP: "RIFF"...."WEBP", then VP8 / VP8L / VP8X chunk.
    if (
      buf.length >= 30 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const fmt = buf.toString('ascii', 12, 16);
      if (fmt === 'VP8 ') {
        return {
          width: buf.readUInt16LE(26) & 0x3fff,
          height: buf.readUInt16LE(28) & 0x3fff,
        };
      }
      if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return {
          width: (b & 0x3fff) + 1,
          height: ((b >> 14) & 0x3fff) + 1,
        };
      }
      if (fmt === 'VP8X') {
        return {
          width: (buf.readUIntLE(24, 3) & 0xffffff) + 1,
          height: (buf.readUIntLE(27, 3) & 0xffffff) + 1,
        };
      }
    }
  } catch {
    /* fall through */
  }
  return { width: null, height: null };
}
