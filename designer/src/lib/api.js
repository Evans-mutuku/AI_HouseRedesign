// The API client.
//
// Every request carries the caller's Firebase ID token; the server derives the
// account from it. No user id, session token, or account identifier is ever
// sent from here - there is nothing for the client to tamper with.
//
// The one exception is the share endpoint, which is public by design and
// authenticates on the token in the URL instead.

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

async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = {};
  if (auth) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, {
    method,
    headers,
    body:
      body instanceof FormData || body === undefined ? body : JSON.stringify(body),
    signal,
  });
  return handle(res);
}

/* ── Account ─────────────────────────────────────────────────────────────── */

export const getAccount = () => request('/api/me');
export const getStorage = () => request('/api/me/storage');
export const setPlan = (plan) => request('/api/me/plan', { method: 'POST', body: { plan } });

/* ── Rooms ───────────────────────────────────────────────────────────────── */

/**
 * Upload a photo and start the first redesign. Returns immediately with a job
 * to poll - generation happens on the server, so navigating away is safe.
 */
export function createRoom({ file, name, style, budget, currency, note, homeId, region }, signal) {
  const form = new FormData();
  form.append('image', file);
  if (name) form.append('name', name);
  if (style) form.append('style', style);
  if (budget) form.append('budget', String(budget));
  if (currency) form.append('currency', currency);
  if (note) form.append('note', note);
  if (homeId) form.append('homeId', homeId);
  if (region) form.append('region', JSON.stringify(region));
  return request('/api/rooms', { method: 'POST', body: form, signal });
}

export const listRooms = (homeId) =>
  request(`/api/rooms${homeId ? `?homeId=${encodeURIComponent(homeId)}` : ''}`);

export const getRoom = (id) => request(`/api/rooms/${encodeURIComponent(id)}`);

export const updateRoom = (id, patch) =>
  request(`/api/rooms/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });

export const deleteRoom = (id) =>
  request(`/api/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Ask for a change to an existing room - the revision flow. */
export const reviseRoom = (id, body) =>
  request(`/api/rooms/${encodeURIComponent(id)}/revisions`, { method: 'POST', body });

/* ── Redesigns ───────────────────────────────────────────────────────────── */

export const getRedesign = (id) => request(`/api/redesigns/${encodeURIComponent(id)}`);

export const deleteRedesign = (id) =>
  request(`/api/redesigns/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const getPaints = (id, brand) =>
  request(
    `/api/redesigns/${encodeURIComponent(id)}/paints${brand ? `?brand=${encodeURIComponent(brand)}` : ''}`,
  );

export const setChecklistItem = (id, key, body) =>
  request(
    `/api/redesigns/${encodeURIComponent(id)}/checklist/${encodeURIComponent(key)}`,
    { method: 'PUT', body },
  );

export const setFavorite = (id, favorited) =>
  request(`/api/redesigns/${encodeURIComponent(id)}/favorite`, {
    method: 'PUT',
    body: { favorited },
  });

export const createShare = (id, body = {}) =>
  request(`/api/redesigns/${encodeURIComponent(id)}/share`, { method: 'POST', body });

export const revokeShare = (id) =>
  request(`/api/redesigns/${encodeURIComponent(id)}/share`, { method: 'DELETE' });

/** Public - no token. */
export const getSharedBoard = (token) =>
  request(`/api/share/${encodeURIComponent(token)}`, { auth: false });

/* ── Jobs ────────────────────────────────────────────────────────────────── */

export const getJob = (id) => request(`/api/jobs/${encodeURIComponent(id)}`);
export const listJobs = () => request('/api/jobs');
export const cancelJob = (id) =>
  request(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });

/* ── Progress photos ─────────────────────────────────────────────────────── */

export const listProgress = (roomId) =>
  request(`/api/rooms/${encodeURIComponent(roomId)}/progress`);

export function addProgress(roomId, { file, caption }) {
  const form = new FormData();
  form.append('image', file);
  if (caption) form.append('caption', caption);
  return request(`/api/rooms/${encodeURIComponent(roomId)}/progress`, {
    method: 'POST',
    body: form,
  });
}

export const deleteProgress = (roomId, id) =>
  request(
    `/api/rooms/${encodeURIComponent(roomId)}/progress/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );

/* ── Homes ───────────────────────────────────────────────────────────────── */

export const listHomes = () => request('/api/homes');
export const createHome = (body) => request('/api/homes', { method: 'POST', body });
export const updateHome = (id, body) =>
  request(`/api/homes/${encodeURIComponent(id)}`, { method: 'PATCH', body });
export const deleteHome = (id) =>
  request(`/api/homes/${encodeURIComponent(id)}`, { method: 'DELETE' });

/* ── Trash ───────────────────────────────────────────────────────────────── */

export const getTrash = () => request('/api/trash');
export const restoreFromTrash = (body) =>
  request('/api/trash/restore', { method: 'POST', body });
export const emptyTrash = (body = {}) =>
  request('/api/trash/empty', { method: 'POST', body });
