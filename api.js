// api.js — 백엔드 호출 헬퍼
export const API =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4000'          // 개발용 로컬
    : 'https://lostfound-backend-c32o.onrender.com';

// 토큰 저장/가져오기
const tokenKey = 'lf_token';
export const getToken  = () => localStorage.getItem(tokenKey);
export const setToken  = (t) => localStorage.setItem(tokenKey, t);
export const clearToken = () => localStorage.removeItem(tokenKey);
const authHeader = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

// ------ Auth ------
export async function login(id, password) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ id, password })
  });
  if (!r.ok) throw new Error('로그인 실패');
  const { token } = await r.json();
  setToken(token);
  return token;
}

// ------ Items (lostItems 구조를 읽는 백엔드에 맞춤) ------
export async function listItems({ floor = 0, q = '' } = {}) {
  const p = new URLSearchParams();
  if (floor) p.set('floor', floor);
  if (q)     p.set('q', q);
  const r = await fetch(`${API}/api/items?${p.toString()}`);
  if (!r.ok) throw new Error('목록 실패');
  return (await r.json()).items; // [{id,title,desc,floor,imageUrl,...}]
}

export async function getItem(id) {
  const r = await fetch(`${API}/api/items/${id}`);
  if (!r.ok) throw new Error('상세 실패');
  return await r.json();
}

export async function createItem({ title, floor, desc, file }) {
  const fd = new FormData();
  fd.append('title', title);
  fd.append('floor', floor);
  if (desc) fd.append('desc', desc);
  if (file) fd.append('image', file);
  const r = await fetch(`${API}/api/items`, {
    method: 'POST',
    headers: { ...authHeader() },
    body: fd
  });
  if (!r.ok) throw new Error('등록 실패');
  return await r.json(); // { id }
}

export async function updateItem(id, { title, floor, desc, file }) {
  if (file) {
    const fd = new FormData();
    if (title != null) fd.append('title', title);
    if (floor != null) fd.append('floor', floor);
    if (desc  != null) fd.append('desc', desc);
    fd.append('image', file);
    const r = await fetch(`${API}/api/items/${id}`, {
      method: 'PUT',
      headers: { ...authHeader() },
      body: fd
    });
    if (!r.ok) throw new Error('수정 실패');
    return;
  }
  const r = await fetch(`${API}/api/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ title, floor, desc })
  });
  if (!r.ok) throw new Error('수정 실패');
}

export async function deleteItem(id) {
  const r = await fetch(`${API}/api/items/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() }
  });
  if (!r.ok) throw new Error('삭제 실패');
}
