// app.js — Data URL 업로드 + 이미지 대체 처리 (전체 교체본)

/* 1) API 임포트 */
import {
  API, login, getToken, clearToken,
  listItems, getItem, createItem, updateItem, deleteItem
} from './api.js';

/* 2) 이미지 경로 정규화 */
function toSrc(u) {
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('http://') || u.startsWith('https://')) return u; // 절대/데이터 URL 그대로
  if (u.startsWith('/')) return `${API}${u}`; // /uploads/... 는 API 붙이기
  return u;
}

/* 공용 대체 이미지 (자리 유지용) */
const FALLBACK_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#f1f1f1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#999">이미지를 불러올 수 없습니다</text></svg>');

/* ---- 상태 ---- */
let selectedFloor = 0;   // 0 = 전체
let editing = null;      // { id, floor } | null

/* ---- 유틸 ---- */
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

/* 파일 → DataURL (압축) */
async function fileToDataURL(file, { maxW = 1200, maxH = 1200, quality = 0.8 } = {}) {
  // createImageBitmap이 더 빠르고 EXIF 무시 회전 이슈 적음
  const bmp = await createImageBitmap(file);
  let { width, height } = bmp;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(bmp, 0, 0, w, h);

  return canvas.toDataURL('image/jpeg', quality); // "data:image/jpeg;base64,..."
}

/* 공통: 안전 삭제 */
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

/* ========================= 로그인 ========================= */
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
      await login(id, pw);
      alert('관리자 로그인 성공');
      goList();
    } catch (e) {
      console.error(e);
      alert('로그인 실패');
    }
  });

  $('#btn-guest-enter')?.addEventListener('click', () => {
    clearToken();
    goList();
  });
}

/* ========================= 목록/검색 ========================= */
async function renderList() {
  try {
    const q = ($('#search-input')?.value || '').trim();
    const items = await listItems({ floor: selectedFloor, q });
    const ul = $('#lost-items');
    ul.innerHTML = '';

    items.forEach(it => {
      const li = document.createElement('li');
      li.className = 'card';
      li.dataset.id = it.id;
      li.style.position = 'relative';

      // 이미지 (자리를 유지하고 실패 시 대체 이미지로 교체)
      const img = document.createElement('img');
      img.className = 'card-img';
      img.alt = it.title || '이미지';
      img.loading = 'lazy';

      const resolved = toSrc(it.imageUrl || '');
      img.src = resolved || FALLBACK_DATA_URL;
      img.onerror = () => { img.onerror = null; img.src = FALLBACK_DATA_URL; };
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

/* ========================= 상세 ========================= */
async function openDetail(id) {
  try {
    const it = await getItem(id);
    $('#detail-title').textContent = it.title || '(제목 없음)';
    $('#detail-floor').textContent = `보관 위치 : ${it.floor}층`;

    const img = $('#detail-image');
    const resolved = toSrc(it.imageUrl || '');
    if (resolved) {
      img.src = resolved;
      img.classList.remove('hidden');
      img.onerror = () => { img.onerror = null; img.src = FALLBACK_DATA_URL; };
    } else {
      img.src = FALLBACK_DATA_URL; // 이미지가 없어도 자리 유지
      img.classList.remove('hidden');
    }

    $('#detail-desc').textContent = it.desc || '';

    syncRoleUI();
    showScreen('screen-4');

    // 편집/삭제 핸들러
    $('#btn-edit').onclick = () =>
      openCompose({ id: it.id, floor: it.floor, title: it.title, desc: it.desc, imageUrl: it.imageUrl });

    $('#btn-delete').onclick = async () => {
      if (!confirm('이 항목을 삭제하시겠습니까?')) return;
      await safeDelete(it.id);
    };
  } catch (e) {
    console.error(e);
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

/* ========================= 글쓰기/수정 ========================= */
function openCompose(prefill) {
  if (!isAdmin()) { alert('관리자만 작성할 수 있습니다.'); return; }
  editing = prefill ? { id: prefill.id, floor: prefill.floor } : null;

  $('#form-title').value = prefill?.title || '';
  $('#form-floor').value = prefill?.floor ?? '';
  $('#form-desc').value  = prefill?.desc  || '';

  const pv = $('#form-preview');
  if (prefill?.imageUrl) {
    pv.src = toSrc(prefill.imageUrl);
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
    // 파일이 있으면 Data URL로 변환해서 서버에 imageUrl(문자열)로 보냄
    let imageUrl = null;
    if (file) imageUrl = await fileToDataURL(file, { maxW: 1280, maxH: 1280, quality: 0.8 });

    if (editing) {
      await updateItem(editing.id, { title, floor, desc, imageUrl }); // file 대신 imageUrl 우선
    } else {
      await createItem({ title, floor, desc, imageUrl });
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
  // 이미지 미리보기 (원본 미리보기)
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

/* ========================= 부트스트랩 ========================= */
window.addEventListener('load', () => {
  mountLogin();
  mountList();
  mountCompose();
  mountDetailNav();

  // 첫 화면은 로그인
  showScreen('screen-1');
  syncRoleUI();
});
