// api.js — 백엔드 호출 헬퍼 (file 또는 imageUrl 둘 다 지원)

export const API =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:4000'          // 개발용 로컬
    : 'https://lostfound-backend-0js6.onrender.com'; // 배포된 백엔드 URL:contentReference[oaicite:1]{index=1}

// 토큰 저장/가져오기
const tokenKey = 'lf_token';
export const getToken   = () => localStorage.getItem(tokenKey);
export const setToken   = (t) => localStorage.setItem(tokenKey, t);
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

// ------ Items ------
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

/**
 * 새 항목 등록
 * - file이 있으면: FormData 업로드 (기존 방식)
 * - file이 없고 imageUrl이 있으면: JSON으로 imageUrl 전송 (data: 또는 절대 URL)
 */
export async function createItem({ title, floor, desc, file, imageUrl } = {}) {
  // JSON 경로 (Storage 없이 data URL/절대 URL 저장)
  if (!file && imageUrl) {
    const r = await fetch(`${API}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, floor, desc, imageUrl })
    });
    if (!r.ok) throw new Error('등록 실패');
    return await r.json(); // { id }
  }

  // FormData 경로 (파일 업로드 유지)
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

/**
 * 항목 수정
 * 우선순위: (1) imageUrl만 전달 → JSON, (2) file 포함 → FormData, (3) 텍스트만 수정 → JSON
 */
export async function updateItem(id, { title, floor, desc, file, imageUrl } = {}) {
  // JSON 경로 (imageUrl 교체/텍스트 수정)
  if (!file && (imageUrl != null)) {
    const r = await fetch(`${API}/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ title, floor, desc, imageUrl })
    });
    if (!r.ok) throw new Error('수정 실패');
    // 일부 백엔드는 본문이 없을 수 있으니 굳이 반환값 사용 안 함
    return;
  }

  // FormData 경로 (파일 교체)
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

  // 텍스트만 수정
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
