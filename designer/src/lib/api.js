// The API client.
//
// Every request carries the caller's Firebase ID token; the server derives the
// account from it. No user id, session token, or account identifier is ever
// sent from here — there is nothing for the client to tamper with.

let tokenProvider = async () => null;

/** AuthProvider installs the function that mints a current ID token. */
export function setTokenProvider(fn) {
  tokenProvider = fn;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body || null;
    this.quota = body?.quota || null;
  }
}

async function authHeaders() {
  const token = await tokenProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed (${res.status}). Please try again.`,
      res.status,
      data,
    );
  }
  return data;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = await authHeaders();
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, {
    method,
    headers,
    body:
      body instanceof FormData || body === undefined
        ? body
        : JSON.stringify(body),
    signal,
  });
  return handle(res);
}

/* — Account ————————————————————————————————————————————————— */

export const getAccount = () => request('/api/me');

export const getStorage = () => request('/api/me/storage');

export const setPlan = (plan) =>
  request('/api/me/plan', { method: 'POST', body: { plan } });

/* — Redesigns ——————————————————————————————————————————————— */

export function createRedesign({ file, style, budget, note }, signal) {
  const form = new FormData();
  form.append('image', file);
  if (style) form.append('style', style);
  if (budget) form.append('budget', budget);
  if (note) form.append('note', note);
  return request('/api/redesign', { method: 'POST', body: form, signal });
}

export const fetchRedesign = (id) =>
  request(`/api/redesign/${encodeURIComponent(id)}`);

export const listRedesigns = () => request('/api/redesigns');

export const deleteRedesign = (id) =>
  request(`/api/redesign/${encodeURIComponent(id)}`, { method: 'DELETE' });
