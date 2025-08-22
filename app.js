// app.js — 최종 교체본

// 1) API 모듈
import {
  API, login, getToken, clearToken,
  listItems, getItem, createItem, updateItem, deleteItem
} from './api.js';

/* =========================================================
   이미지 유틸: 200KB 타깃, WebP 우선 → JPEG 폴백
   ========================================================= */
function dataURLBytes(d) {
  const base64 = (d.split(',')[1] || '');
  return Math.ceil(base64.length * 3 / 4);
}

/** 더 강력한 리사이즈: WebP 우선, 품질↓ → 그래도 크면 해상도↓ 반복 */
async function resizeImageFile(file, {
  maxW = 1024,
  maxH = 1024,
  quality = 0.82,
  minQuality = 0.45,
  targetBytes = 200 * 1024,    // ✅ 200KB 목표
  downscaleStep = 0.85,        // 해상도 15%씩 감소
  minW = 640,
  minH = 640,
  formatPriority = ['image/webp', 'image/jpeg'], // WebP 먼저 시도
} = {}) {
  if (!file) return null;

  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  URL.revokeObjectURL(url);

  // 초기 크기 결정
  const s0 = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  let w = Math.max(1, Math.round(img.naturalWidth * s0));
  let h = Math.max(1, Math.round(img.naturalHeight * s0));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const bytesOf = (d) => Math.ceil((d.split(',')[1] || '').length * 3 / 4);
  const tryEncode = (fmt, q) => {
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    let dataURL = canvas.toDataURL(fmt, q);
    // 일부 브라우저는 webp 미지원 시 PNG로 반환 → 거르기
    if (fmt === 'image/webp' && !dataURL.startsWith('data:image/webp')) return null;
    return dataURL;
  };

  // 반복: 포맷/품질/해상도 조합으로 목표 용량 이하 만들기
  let q = quality;
  for (let tries = 0; tries < 10; tries++) {
    // 포맷 우선순위대로 시도, 가장 작은 것을 채택
    let best = { dataURL: null, bytes: Infinity, fmt: null };
    for (const fmt of formatPriority) {
      const d = tryEncode(fmt, q);
      if (!d) continue;
      const b = bytesOf(d);
      if (b < best.bytes) best = { dataURL: d, bytes: b, fmt };
    }

    if (best.dataURL && best.bytes <= targetBytes) return best.dataURL;

    // 품질을 더 내릴 수 있으면 먼저 내림
    if (q > minQuality) { q = Math.max(minQuality, q - 0.1); continue; }

    // 품질 한계면 해상도 줄이기
    const nw = Math.max(minW, Math.round(w * downscaleStep));
    const nh = Math.max(minH, Math.round(h * downscaleStep));
    if (nw === w && nh === h) {
      // 더 줄일 수 없으면 현재 최선 반환(200KB 조금 넘을 수도)
      return best.dataURL || tryEncode('image/jpeg', minQuality);
    }
    w = nw; h = nh;
    q = Math.min(0.82, q + 0.1); // 해상도 줄였으니 품질 약간 회복
  }

  // 안전망
  return tryEncode('image/jpeg', minQuality);
}

/* =========================================================
   표시용 경로 정규화
   ========================================================= */
function toSrc(u) {
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('http')) return u;
  if (u.startsWith('/')) return `${API}${u}`;
  return u;
}

/* =========================================================
   상태 & 유틸
   ========================================================= */
let selectedFloor = 0;   // 0=전체, 1~4=층
let editing = null;      // { id, floor } | null

const $ = (s) => document.querySelector(s);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
function setActiveTab(f) {
  for (let i = 0; i <= 4; i++) {
    document.getElementById(`tab-${i}`)?.classList.toggle('active', i === f);
  }
}
function isAdmin() { return !!getToken(); }
function syncRoleUI() {
  $('#fab-manage')?.classList.toggle('hidden', !isAdmin());
  $('#btn-edit')?.classList.toggle('hidden', !isAdmin());
  $('#btn-delete')?.classList.toggle('hidden', !isAdmin());
}

// 공통: 안전 삭제
async function safeDelete(id) {
  try {
    await deleteItem(id);
    alert('삭제되었습니다.');
    showScreen('screen-2');
    await renderList();
  } catch (e) {
    console.error(e);
    alert('삭제에 실패했습니다.');
  }
}

/* =========================================================
   로그인
   ========================================================= */
function mountLogin() {
  const idEl = $('#admin-id');
  const pwEl = $('#admin-pw');

  const goList = () => {
    showScreen('screen-2');
    setActiveTab(selectedFloor);
    syncRoleUI();
    renderList();
  };

  $('#btn-admin-submit')?.addEventListener('click', async () => {
    const id = (idEl?.value || '').trim();
    const pw = (pwEl?.value || '').trim();
    if (!id || !pw) return alert('아이디/비밀번호를 입력하세요.');
    try {
      await login(id, pw); // 예: a / b
      alert('관리자 로그인 성공');
      goList();
    } catch (e) {
      console.error(e);
      alert('로그인 실패');
    }
  });

  // Enter로 로그인
  pwEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-admin-submit')?.click();
  });

  $('#btn-guest-enter')?.addEventListener('click', () => {
    clearToken();
    goList();
  });
}

/* =========================================================
   목록/검색
   ========================================================= */
async function renderList() {
  try {
    const q = ($('#search-input')?.value || '').trim();
    const items = await listItems({ floor: selectedFloor, q });
    const ul = $('#lost-items');
    ul.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'card';
      empty.style.display = 'flex';
      empty.style.justifyContent = 'center';
      empty.style.alignItems = 'center';
      empty.style.minHeight = '120px';
      empty.textContent = q ? '검색 결과가 없습니다.' : '등록된 분실물이 없습니다.';
      ul.appendChild(empty);
      return;
    }

    items.forEach(it => {
      const li = document.createElement('li');
      li.className = 'card';
      li.dataset.id = it.id;
      li.style.position = 'relative';

      // 이미지 (image → imageUrl 순서)
      const img = document.createElement('img');
      img.className = 'card-img';
      img.alt = it.title || '이미지';
      const src = toSrc(it.image || it.imageUrl);
      if (src) img.src = src; else img.classList.add('hidden');
      img.onerror = () => img.classList.add('hidden');
      img.onload  = () => img.classList.remove('hidden');
      li.appendChild(img);

      // 메타
      const meta = document.createElement('div');
      meta.className = 'card-meta';
      const floorEl = document.createElement('div');
      floorEl.className = 'card-floor';
      floorEl.textContent = `${it.floor}층`;
      const nameEl = document.createElement('div');
      nameEl.className = 'card-name';
      nameEl.textContent = it.title || '(제목 없음)';
      meta.appendChild(floorEl);
      meta.appendChild(nameEl);
      li.appendChild(meta);

      // 관리자 전용: 리스트에서 바로 삭제
      if (isAdmin()) {
        const delBtn = document.createElement('button');
        delBtn.textContent = '삭제';
        delBtn.title = '이 항목 삭제';
        delBtn.setAttribute('aria-label', '항목 삭제');
        Object.assign(delBtn.style, {
          position: 'absolute',
          right: '8px',
          top: '8px',
          padding: '4px 8px',
          border: 'none',
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '12px'
        });
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('이 항목을 삭제하시겠습니까?')) return;
          await safeDelete(it.id);
        });
        li.appendChild(delBtn);
      }

      // 클릭 → 상세
      li.addEventListener('click', () => openDetail(it.id));
      ul.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    alert('목록을 불러오지 못했습니다.');
  }
}

function mountList() {
  // 탭
  for (let i = 0; i <= 4; i++) {
    document.getElementById(`tab-${i}`)?.addEventListener('click', () => {
      selectedFloor = i;
      setActiveTab(i);
      renderList();
    });
  }
  // 검색
  $('.search-btn')?.addEventListener('click', renderList);
  $('#search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renderList();
  });
  // 글쓰기 FAB
  $('#fab-manage')?.addEventListener('click', () => openCompose(null));
}

/* =========================================================
   상세
   ========================================================= */
async function openDetail(id) {
  try {
    const it = await getItem(id);
    $('#detail-title').textContent = it.title || '(제목 없음)';
    $('#detail-floor').textContent = `보관 위치 : ${it.floor}층`;

    const img = $('#detail-image');
    const src = toSrc(it.image || it.imageUrl);
    if (src) {
      img.src = src;
      img.classList.remove('hidden');
      img.onerror = () => img.classList.add('hidden');
    } else {
      img.classList.add('hidden');
    }
    $('#detail-desc').textContent = it.desc || '';

    syncRoleUI();
    showScreen('screen-4');

    // 편집/삭제 핸들러
    $('#btn-edit').onclick = () =>
      openCompose({
        id: it.id,
        floor: it.floor,
        title: it.title,
        desc: it.desc,
        image: it.image,        // data URL
        imageUrl: it.imageUrl,  // 옛 방식
      });

    $('#btn-delete').onclick = async () => {
      if (!confirm('이 항목을 삭제하시겠습니까?')) return;
      await safeDelete(it.id);
    };
  } catch (e) {
    console.error(e);
    // 상세 실패해도 관리자라면 강제 삭제 제공
    if (isAdmin() && confirm('상세를 불러오지 못했습니다. 이 항목을 강제로 삭제할까요?')) {
      await safeDelete(id);
      return;
    }
    alert('상세를 불러오지 못했습니다.');
  }
}

function mountDetailNav() {
  $('#btn-back-detail')?.addEventListener('click', () => showScreen('screen-2'));
}

/* =========================================================
   글쓰기/수정
   ========================================================= */
function openCompose(prefill) {
  if (!isAdmin()) { alert('관리자만 작성할 수 있습니다.'); return; }
  editing = prefill ? { id: prefill.id, floor: prefill.floor } : null;

  $('#form-title').value = prefill?.title || '';
  $('#form-floor').value = prefill?.floor ?? '';
  $('#form-desc').value  = prefill?.desc  || '';

  const pv = $('#form-preview');
  const src = toSrc(prefill?.image || prefill?.imageUrl);
  if (src) {
    pv.src = src;
    pv.classList.remove('hidden');
  } else {
    pv.src = '';
    pv.classList.add('hidden');
  }

  $('#btn-submit').textContent = editing ? '수정 저장' : '글 등록하기';
  showScreen('screen-3');
}

async function submitCompose() {
  if (!isAdmin()) return alert('관리자만 등록/수정할 수 있습니다.');

  const title = ($('#form-title').value || '').trim();
  const floor = Number($('#form-floor').value);
  const desc  = ($('#form-desc').value || '').trim();
  const file  = $('#form-image').files[0];

  if (!title) return alert('제목을 입력하세요.');
  if (![1, 2, 3, 4].includes(floor)) return alert('보관 위치(층)를 선택하세요.');

  try {
    let imageDataURL = null;

    if (file) {
      // ✅ 200KB 목표로 압축/리사이즈 (WebP 우선)
      imageDataURL = await resizeImageFile(file, {
        maxW: 1024,
        maxH: 1024,
        quality: 0.82,
        minQuality: 0.45,
        targetBytes: 200 * 1024,
        downscaleStep: 0.85,
        minW: 640,
        minH: 640,
        formatPriority: ['image/webp', 'image/jpeg'],
      });
      // 개발 확인용: 최종 용량 로그(원하면 주석 해제)
      // console.log('final ~KB:', Math.round(dataURLBytes(imageDataURL)/1024));
    }

    if (editing) {
      await updateItem(editing.id, { title, floor, desc, imageDataURL });
    } else {
      await createItem({ title, floor, desc, imageDataURL });
    }

    // reset
    $('#form-title').value = '';
    $('#form-floor').value = '';
    $('#form-desc').value  = '';
    $('#form-image').value = '';
    $('#form-preview').classList.add('hidden');

    showScreen('screen-2');
    renderList();
  } catch (e) {
    console.error(e);
    alert('저장에 실패했습니다.');
  }
}

function mountCompose() {
  // 미리보기(원본 미리보기로 충분; 압축은 제출 시 수행)
  $('#form-image')?.addEventListener('change', () => {
    const f = $('#form-image').files[0];
    const pv = $('#form-preview');
    if (!f) { pv.classList.add('hidden'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { pv.src = e.target.result; pv.classList.remove('hidden'); };
    reader.readAsDataURL(f);
  });

  $('#btn-submit')?.addEventListener('click', submitCompose);
  $('#btn-back-2')?.addEventListener('click', () => showScreen('screen-2'));
}

/* =========================================================
   부트스트랩
   ========================================================= */
window.addEventListener('load', () => {
  mountLogin();
  mountList();
  mountCompose();
  mountDetailNav();

  // 첫 화면은 로그인
  showScreen('screen-1');
  syncRoleUI();
});