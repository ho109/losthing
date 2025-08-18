// app.js (최신 전체본)

// 1) API 모듈 임포트는 파일 최상단
import {
  API, login, getToken, clearToken,
  listItems, getItem, createItem, updateItem, deleteItem
} from './api.js';

// 2) 이미지 경로 정규화 유틸
function toSrc(u) {
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API}${u}`;
  return u;
}

// ---- 상태 ----
let selectedFloor = 0;   // 0=전체, 1~4=층
let editing = null;      // { id, floor } | null

// ---- 유틸 ----
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

// 공통: 안전 삭제 핸들러
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

// ========================= 로그인 =========================
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

  $('#btn-guest-enter')?.addEventListener('click', () => {
    clearToken();
    goList();
  });
}

// ========================= 목록/검색 =========================
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

      // 이미지
      const img = document.createElement('img');
      img.className = 'card-img';
      img.alt = it.title || '이미지';
      img.src = toSrc(it.imageUrl);
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

// ========================= 상세 =========================
async function openDetail(id) {
  try {
    const it = await getItem(id);
    $('#detail-title').textContent = it.title || '(제목 없음)';
    $('#detail-floor').textContent = `보관 위치 : ${it.floor}층`;

    const img = $('#detail-image');
    if (it.imageUrl) {
      img.src = toSrc(it.imageUrl);
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
      openCompose({ id: it.id, floor: it.floor, title: it.title, desc: it.desc, imageUrl: it.imageUrl });

    $('#btn-delete').onclick = async () => {
      if (!confirm('이 항목을 삭제하시겠습니까?')) return;
      await safeDelete(it.id);
    };
  } catch (e) {
    console.error(e);
    // 상세 실패 시에도 관리자 강제 삭제 제공
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

// ========================= 글쓰기/수정 =========================
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
    if (editing) {
      await updateItem(editing.id, { title, floor, desc, file });
    } else {
      await createItem({ title, floor, desc, file });
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
  // 이미지 미리보기
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

// ========================= 부트스트랩 =========================
window.addEventListener('load', () => {
  mountLogin();
  mountList();
  mountCompose();
  mountDetailNav();

  // 첫 화면은 로그인
  showScreen('screen-1');
  syncRoleUI();
});
