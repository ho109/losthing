// api.js — 백엔드 호출 헬퍼

// 배포/로컬 자동 스위치 (뒤 슬래시 ❌)
export const API =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4000'
    : 'https://lostfound-backend-0js6.onrender.com';

// ===== 토큰 관리 =====
const tokenKey = 'lf_token';
export const getToken   = () => localStorage.getItem(tokenKey);
export const setToken   = (t) => localStorage.setItem(tokenKey, t);
export const clearToken = () => localStorage.removeItem(tokenKey);
const authHeader = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

// ===== 공통 응답 핸들러 =====
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

// ===== Auth =====
export async function login(id, password) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password })
  });
  const data = await handle(r);
  if (!data?.token) throw new Error('로그인 실패: 토큰 없음');
  setToken(data.token);
  return data.token;
}

// ===== Items =====
export async function listItems({ floor = 0, q = '' } = {}) {
  const p = new URLSearchParams();
  if (floor) p.set('floor', floor);
  if (q)     p.set('q', q);
  const qs = p.toString();
  const r = await fetch(qs ? `${API}/api/items?${qs}` : `${API}/api/items`);
  const data = await handle(r);
  return data.items || [];
}

export async function getItem(id) {
  const r = await fetch(`${API}/api/items/${encodeURIComponent(id)}`);
  return handle(r);
}

export async function createItem({ title, floor, desc, file, imageDataURL }) {
  // JSON 경로(추천): 리사이즈된 dataURL 전송
  if (imageDataURL && !file) {
    const r = await fetch(`${API}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, floor, desc, image: imageDataURL })
    });
    return handle(r); // { id }
  }

  // (옵션) 파일 경로 유지하고 싶다면
  if (file) {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('floor', floor);
    if (desc) fd.append('desc', desc);
    fd.append('image', file);
    const r = await fetch(`${API}/api/items`, {
      method: 'POST',
      headers: { ...authHeader() }, // FormData는 Content-Type 자동
      body: fd
    });
    return handle(r);
  }

  // 이미지 없이 텍스트만
  const r = await fetch(`${API}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ title, floor, desc })
  });
  return handle(r);
}

export async function updateItem(id, { title, floor, desc, file, imageDataURL }) {
  // JSON 경로(추천): 리사이즈된 dataURL 전송
  if (imageDataURL && !file) {
    const r = await fetch(`${API}/api/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, floor, desc, image: imageDataURL })
    });
    await handle(r);
    return;
  }

  // (옵션) 파일 경로
  if (file) {
    const fd = new FormData();
    if (title != null) fd.append('title', title);
    if (floor != null) fd.append('floor', floor);
    if (desc  != null) fd.append('desc', desc);
    fd.append('image', file);
    const r = await fetch(`${API}/api/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { ...authHeader() },
      body: fd
    });
    await handle(r);
    return;
  }

  // 텍스트만 수정
  const r = await fetch(`${API}/api/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ title, floor, desc })
  });
  await handle(r);
}

// (선택) 핑
export async function ping() {
  const r = await fetch(`${API}/`);
  return handle(r);
}

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}
// 사용 예: const r = await fetchWithTimeout(`${API}/api/items?...`);
