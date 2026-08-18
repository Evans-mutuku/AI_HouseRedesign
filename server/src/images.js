// OpenAI gpt-image-1 integration — renders the "after" by EDITING the user's
// actual room photo (images/edits endpoint), so the result is the same room
// restyled rather than an unrelated generated scene.
//
// Key lives only here, read from process.env.OPENAI_API_KEY. Never shipped to
// the client. This is the only place a non-Anthropic provider is touched, kept
// isolated so it can be swapped (FLUX, Gemini, local SD) without ripple.

import sharp from 'sharp';

const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const DEFAULT_MODEL = 'gpt-image-1';

class ImageError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'ImageError';
    this.status = status;
  }
}

export function imagesEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Pick the output size whose aspect ratio is closest to the source.
 *
 * This matters more than it looks. The previous build asked for 1536×1024 for
 * every upload, so a portrait photo of a room came back reframed to landscape —
 * and whatever sat at the top and bottom of the original, very often a tall
 * window or a door head, was simply cropped out of existence. Matching the
 * source shape removes a whole class of "it deleted my window" failures before
 * the prompt has to do any work.
 */
function chooseSize(width, height) {
  const configured = process.env.OPENAI_IMAGE_SIZE;
  if (configured && configured !== 'auto') return configured;
  if (!width || !height) return '1536x1024';

  const ratio = width / height;
  const options = [
    { size: '1024x1536', ratio: 1024 / 1536 },
    { size: '1024x1024', ratio: 1 },
    { size: '1536x1024', ratio: 1536 / 1024 },
  ];
  return options.reduce((best, option) =>
    Math.abs(Math.log(option.ratio / ratio)) < Math.abs(Math.log(best.ratio / ratio))
      ? option
      : best,
  ).size;
}

/**
 * Build the PNG mask gpt-image-1 expects for a regional edit.
 *
 * Mask semantics: TRANSPARENT pixels are the ones the model may change, opaque
 * pixels are protected. `region` is {x,y,w,h} in 0–1 fractions of the image.
 */
export async function buildMask({ width, height, region }) {
  const x = Math.round(Math.max(0, Math.min(1, region.x)) * width);
  const y = Math.round(Math.max(0, Math.min(1, region.y)) * height);
  const w = Math.max(1, Math.round(Math.min(1 - region.x, region.w) * width));
  const h = Math.max(1, Math.round(Math.min(1 - region.y, region.h) * height));

  // Opaque black everywhere (protected) …
  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  });

  // … with a fully transparent hole where the edit is allowed.
  const hole = await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  return base
    .composite([{ input: hole, left: x, top: y, blend: 'dest-out' }])
    .png()
    .toBuffer();
}

/**
 * Edit `imageBuffer` into the redesigned room described by `prompt`.
 * Returns { buffer, mime, size } for the render, or throws ImageError.
 *
 * `region` (optional, {x,y,w,h} in 0–1) restricts the edit to one area.
 */
export async function generateAfterImage({ imageBuffer, mime, prompt, region = null }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ImageError('Server is missing OPENAI_API_KEY.', 500);
  }
  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
  const quality = process.env.OPENAI_IMAGE_QUALITY || 'high';

  const meta = await sharp(imageBuffer, { failOn: 'none' })
    .metadata()
    .catch(() => ({}));
  const size = chooseSize(meta.width, meta.height);

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('n', '1');
  // Keep as much of the source photograph as the model will allow. This is the
  // single most effective lever against structural drift.
  form.append('input_fidelity', process.env.OPENAI_INPUT_FIDELITY || 'high');

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  form.append('image', new Blob([imageBuffer], { type: mime }), `room.${ext}`);

  if (region) {
    if (!meta.width || !meta.height) {
      throw new ImageError('Could not read the photo dimensions for a masked edit.');
    }
    const mask = await buildMask({ width: meta.width, height: meta.height, region });
    form.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
  }

  let res;
  try {
    res = await fetch(OPENAI_EDITS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }, // fetch sets the boundary
      body: form,
    });
  } catch (err) {
    throw new ImageError(`Could not reach the image service: ${err.message}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ImageError(
      `Image service error (${res.status}). ${detail.slice(0, 300)}`,
      res.status === 429 ? 429 : 502,
    );
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new ImageError('Image service returned no image.');
  }
  return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png', size };
}

export { ImageError, DEFAULT_MODEL, chooseSize };
