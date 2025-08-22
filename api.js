// api.js — 최종본

export const API =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4000'
    : 'https://lostfound-backend-0js6.onrender.com';

const tokenKey = 'lf_token';
export const getToken   = () => localStorage.getItem(tokenKey);
export const setToken   = (t) => localStorage.setItem(tokenKey, t);
export const clearToken = () => localStorage.removeItem(tokenKey);
const authHeader = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

// (선택) 간단한 타임아웃
async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

async function handle(r) {
  if (r.ok) {
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json') ? r.json() : r.text();
  }
  try {
    const j = await r.json();
    throw new Error(j?.error || j?.message || r.statusText);
  } catch {
    const t = await r.text().catch(() => '');
    throw new Error(t || r.statusText || `HTTP ${r.status}`);
  }
}

/* ===== Auth ===== */
export async function login(id, password) {
  const r = await fetchWithTimeout(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password })
  });
  const data = await handle(r);
  if (!data?.token) throw new Error('로그인 실패: 토큰 없음');
  setToken(data.token);
  return data.token;
}

/* ===== Items ===== */
export async function listItems({ floor = 0, q = '' } = {}) {
  const p = new URLSearchParams();
  if (floor) p.set('floor', floor);
  if (q)     p.set('q', q);
  p.set('_ts', Date.now()); // 캐시 버스트(선택)
  const url = `${API}/api/items?${p.toString()}`;
  const r = await fetchWithTimeout(url);
  const data = await handle(r);
  return data.items || [];
}

export async function getItem(id) {
  const r = await fetchWithTimeout(`${API}/api/items/${encodeURIComponent(id)}?_ts=${Date.now()}`);
  return handle(r);
}

export async function createItem({ title, floor, desc, file, imageDataURL }) {
  if (imageDataURL && !file) {
    const r = await fetchWithTimeout(`${API}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, floor, desc, image: imageDataURL })
    });
    return handle(r); // { id }
  }

  if (file) {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('floor', floor);
    if (desc) fd.append('desc', desc);
    fd.append('image', file);
    const r = await fetchWithTimeout(`${API}/api/items`, {
      method: 'POST',
      headers: { ...authHeader() },
      body: fd
    });
    return handle(r);
  }

  const r = await fetchWithTimeout(`${API}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ title, floor, desc })
  });
  return handle(r);
}

export async function updateItem(id, { title, floor, desc, file, imageDataURL }) {
  if (imageDataURL && !file) {
    const r = await fetchWithTimeout(`${API}/api/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, floor, desc, image: imageDataURL })
    });
    await handle(r);
    return;
  }

  if (file) {
    const fd = new FormData();
    if (title != null) fd.append('title', title);
    if (floor != null) fd.append('floor', floor);
    if (desc  != null) fd.append('desc', desc);
    fd.append('image', file);
    const r = await fetchWithTimeout(`${API}/api/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { ...authHeader() },
      body: fd
    });
    await handle(r);
    return;
  }

  const r = await fetchWithTimeout(`${API}/api/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ title, floor, desc })
  });
  await handle(r);
}

export async function deleteItem(id) {
  const r = await fetchWithTimeout(`${API}/api/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeader() }
  });
  await handle(r);
}

// (선택) 서버 상태 확인
export async function ping() {
  const r = await fetchWithTimeout(`${API}/`);
  return handle(r);
}
