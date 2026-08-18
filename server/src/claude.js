// Anthropic transport.
//
// The key lives ONLY here, read from process.env.ANTHROPIC_API_KEY. Nothing in
// this file is ever shipped to the browser. This module knows how to call the
// Messages API and how to get JSON back out of it; what to *ask* lives in
// design.js.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-5';

class ClaudeError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'ClaudeError';
    this.status = status;
  }
}

export function activeModel() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/**
 * Strip markdown fences / leading prose and parse JSON. Returns the parsed
 * object or throws SyntaxError.
 */
export function parseModelJson(text) {
  if (typeof text !== 'string') throw new SyntaxError('no text content');
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip ```json … ``` fences if present, then grab the outermost { … }.
    let cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }
    return JSON.parse(cleaned); // may throw - caller handles
  }
}

const imageBlock = ({ base64, mediaType }) => ({
  type: 'image',
  source: { type: 'base64', media_type: mediaType, data: base64 },
});

/**
 * One Messages API call that must come back as JSON.
 *
 * `images` are placed before the text (image-before-text ordering, which the
 * vision models handle best), and `schema` is passed as `output_config.format`
 * so the API constrains generation to the shape we need. That is stronger than
 * asking nicely in the prompt, and it is the documented replacement for
 * assistant prefill - current models reject a trailing assistant turn outright.
 *
 * Adaptive thinking is on: reading a room and pricing a plan are both jobs
 * where the model reasoning first measurably beats it answering first.
 */
export async function askForJson({
  images = [],
  prompt,
  system,
  schema,
  effort = 'high',
  maxTokens = 8192,
  label = 'request',
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeError('Server is missing ANTHROPIC_API_KEY.', 500);
  }
  const model = activeModel();

  const body = {
    model,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: {
      effort,
      ...(schema ? { format: { type: 'json_schema', schema } } : {}),
    },
    ...(system ? { system } : {}),
    messages: [
      {
        role: 'user',
        content: [...images.map(imageBlock), { type: 'text', text: prompt }],
      },
    ],
  };

  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ClaudeError(`Could not reach the Anthropic API: ${err.message}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ClaudeError(
      `Anthropic API error (${res.status}). ${detail.slice(0, 300)}`,
      res.status === 429 ? 429 : 502,
    );
  }

  const data = await res.json();

  if (data?.stop_reason === 'max_tokens') {
    throw new ClaudeError(
      `The design model ran out of room mid-response (${label}). Please try again.`,
    );
  }
  if (data?.stop_reason === 'refusal') {
    throw new ClaudeError(
      `The model declined this request (${label}). Try a different photo.`,
    );
  }

  // With a schema in play the first text block is guaranteed to be valid JSON,
  // but parseModelJson stays in the path: it costs nothing and keeps this
  // working if the schema is ever dropped.
  const text = data?.content?.find((b) => b.type === 'text')?.text ?? '';
  try {
    return { parsed: parseModelJson(text), model, usage: data?.usage || null };
  } catch {
    throw new ClaudeError(
      `The design model returned a response we could not read (${label}). Please try again.`,
    );
  }
}

export { ClaudeError, DEFAULT_MODEL };
