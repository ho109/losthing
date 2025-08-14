// /***** Firebase 기본 설정 *****/
const firebaseConfig = {
  apiKey: "AIzaSyBo-zidIl1mJbseet9BUtSfhGwL6hzlnLc",
  authDomain: "ho109-6eb98.firebaseapp.com",
  projectId: "ho109-6eb98",
  storageBucket: "ho109-6eb98.appspot.com",
  messagingSenderId: "899224052562",
  appId: "1:899224052562:web:8bde649db9067d56c3908b",
  measurementId: "G-LMH7VZHRQJ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/***** 전역 상태 *****/
let selectedFloor = 1;      // 현재 선택 층
let role = "guest";         // 'guest' | 'admin'
let currentAdminId = null;  // 로그인한 관리자 아이디(옵션)

/** 하드코딩 관리자 계정 (원하는 아이디:비밀번호로 수정) */
const ADMIN_CREDENTIALS = {
  "a": "b",
  // "teacher": "ngms2025",
};

/***** 공용 유틸 *****/
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function syncButtonsByRole() {
  const goManageBtn = document.getElementById("go-manage");
  if (goManageBtn) goManageBtn.classList.toggle("hidden", role !== "admin");
}

/***** ① 입장 선택 화면 *****/
/***** ① 입장 선택 화면 *****/
function mountScreen1() {
  const btnGuest = document.getElementById("btn-guest");
  const btnAdmin = document.getElementById("btn-admin");
  const adminBox = document.getElementById("admin-login-box");
  const btnAdminSubmit = document.getElementById("btn-admin-submit");
  const goListFrom1 = document.getElementById("go-list-from-1");

  // 선택한 로그인 방식 버튼 강조
  function highlightSelection(selectedBtn) {
    btnGuest.classList.remove("selected-mode");
    btnAdmin.classList.remove("selected-mode");
    selectedBtn.classList.add("selected-mode");
  }

  btnGuest.onclick = () => {
    role = "guest";
    currentAdminId = null;
    adminBox.classList.add("hidden");
    highlightSelection(btnGuest);
    alert("비회원 모드로 입장합니다.");
  };

  btnAdmin.onclick = () => {
    adminBox.classList.remove("hidden");
    highlightSelection(btnAdmin);
  };

  // ✅ 관리자 로그인 성공 시 바로 리스트 화면으로 이동
  btnAdminSubmit.onclick = () => {
    const id = (document.getElementById("admin-id").value || "").trim();
    const pw = (document.getElementById("admin-pw").value || "").trim();
    if (!id || !pw) {
      alert("아이디/비밀번호를 입력하세요.");
      return;
    }
    const expected = ADMIN_CREDENTIALS[id];
    if (expected && expected === pw) {
      role = "admin";
      currentAdminId = id;
      console.log("[login] admin:", id); // 확인용 로그
      alert("관리자 로그인 성공");

      // 관리자 UI 반영 후 화면 전환
      syncButtonsByRole();
      highlightSelection(btnAdmin);
      showScreen("screen-2");   // ← 바로 전환
      selectFloor(1);
      loadNotice();
    } else {
      role = "guest";
      currentAdminId = null;
      alert("아이디 또는 비밀번호가 올바르지 않습니다.");
      highlightSelection(btnGuest);
    }
  };

  // 게스트 또는 테스트용: 리스트로 이동
  goListFrom1.onclick = () => {
    showScreen("screen-2");
    syncButtonsByRole();
    selectFloor(1);
    loadNotice();
  };
}

/***** ② 물품 리스트/공통 렌더 *****/
async function selectFloor(floor) {
  selectedFloor = floor;

  const t1 = document.getElementById("floor-title");
  if (t1) t1.innerText = `${floor}층 분실물`;

  const t2 = document.getElementById("floor-title-manage");
  if (t2) t2.innerText = `${floor}층 분실물`;

  renderItems("lost-items");          // 화면②
  renderItems("lost-items-manage");   // 화면③
}

async function renderItems(targetUlId) {
  const list = document.getElementById(targetUlId);
  if (!list) return;
  list.innerHTML = "";

  const doc = await db.collection("lostItems").doc(`floor${selectedFloor}`).get();
  const items = (doc.exists ? (doc.data().items || []) : []).slice(-30);

  items.forEach((item, index) => {
    const li = document.createElement("li");

    // 이미지(있으면)
    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.style.cursor = "pointer";
      img.onclick = (e) => {
        e.stopPropagation();
        showImagePopup(item.image);
      };
      li.appendChild(img);
    }

    // 텍스트 (관리자만 클릭 삭제)
    const text = document.createElement("p");
    text.innerText = item.name;
    if (role === "admin") {
      text.style.cursor = "pointer";
      text.title = "클릭하면 삭제";
      text.onclick = () => deleteItem(index, items);
    } else {
      text.style.cursor = "default";
    }
    li.appendChild(text);

    list.appendChild(li);
  });
}

/***** 등록(관리자 전용) *****/
async function addItem() {
  if (role !== "admin") {
    alert("관리자만 등록할 수 있습니다.");
    return;
  }
  const input = document.getElementById("item-input");
  const imageInput = document.getElementById("item-image");
  const itemName = (input?.value || "").trim();
  const imageFile = imageInput?.files?.[0];

  if (!itemName) {
    alert("이름을 입력하세요.");
    return;
  }

  const newItem = { name: itemName, image: null };

  const saveItem = async () => {
    const ref = db.collection("lostItems").doc(`floor${selectedFloor}`);
    const snap = await ref.get();
    const items = snap.exists ? (snap.data().items || []) : [];
    items.push(newItem);
    await ref.set({ items });
    input.value = "";
    if (imageInput) imageInput.value = "";
    renderItems("lost-items");
    renderItems("lost-items-manage");
  };

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = (e) => {
      newItem.image = e.target.result;
      saveItem();
    };
    reader.readAsDataURL(imageFile);
  } else {
    saveItem();
  }
}

/***** 삭제(관리자 전용) *****/
async function deleteItem(index, items) {
  if (role !== "admin") {
    alert("관리자만 삭제할 수 있습니다.");
    return;
  }
  if (!confirm("이 분실물을 삭제하시겠습니까?")) return;
  items.splice(index, 1);
  await db.collection("lostItems").doc(`floor${selectedFloor}`).set({ items });
  renderItems("lost-items");
  renderItems("lost-items-manage");
}

/***** 검색(보기 공통, 삭제는 관리자만) *****/
async function searchItems() {
  const query = (document.getElementById("search-input").value || "")
    .toLowerCase().trim();

  const list = document.getElementById("lost-items");
  if (list) list.innerHTML = "";
  if (!query) {
    alert("검색어를 입력하세요.");
    return;
  }

  let foundItems = [];
  for (let floor = 1; floor <= 4; floor++) {
    const doc = await db.collection("lostItems").doc(`floor${floor}`).get();
    const items = doc.exists ? (doc.data().items || []) : [];
    const matched = items
      .filter(item => (item.name || "").toLowerCase().includes(query))
      .map(item => ({ ...item, floor }));
    foundItems = foundItems.concat(matched);
  }

  const title = document.getElementById("floor-title");
  if (title) title.innerText = `🔍 '${query}' 검색 결과`;

  if (foundItems.length === 0) {
    alert(`'${query}'을(를) 찾을 수 없습니다.`);
    return;
  }

  const ul = document.getElementById("lost-items");
  if (!ul) return;
  ul.innerHTML = "";

  foundItems.forEach(item => {
    const li = document.createElement("li");

    const floorTag = document.createElement("span");
    floorTag.textContent = `[${item.floor}층] `;
    floorTag.style.fontWeight = "bold";
    li.appendChild(floorTag);

    const name = document.createElement("span");
    name.textContent = item.name;

    if (role === "admin") {
      name.style.cursor = "pointer";
      name.title = "클릭하면 삭제";
      name.onclick = () => deleteItemFromSearch(item.floor, item.name);
    }
    li.appendChild(name);

    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.style.cursor = "pointer";
      img.onclick = (e) => {
        e.stopPropagation();
        showImagePopup(item.image);
      };
      li.appendChild(document.createElement("br"));
      li.appendChild(img);
    }

    ul.appendChild(li);
  });
}

async function deleteItemFromSearch(floor, name) {
  if (role !== "admin") {
    alert("관리자만 삭제할 수 있습니다.");
    return;
  }
  if (!confirm(`[${floor}층] '${name}'을(를) 삭제하시겠습니까?`)) return;
  const ref = db.collection("lostItems").doc(`floor${floor}`);
  const docSnap = await ref.get();
  if (!docSnap.exists) return;
  let items = docSnap.data().items || [];
  items = items.filter(i => i.name !== name);
  await ref.set({ items });
  alert("삭제 완료");
  searchItems();
}

/***** 공지 (보기 공통, 수정은 관리자만) *****/
async function loadNotice() {
  const ref = db.collection("settings").doc("schoolNotice");
  const docSnap = await ref.get();
  const listBox = document.getElementById("notice-text");
  if (!listBox) return;
  listBox.innerHTML = "";

  let notices = [];
  if (docSnap.exists) {
    notices = docSnap.data().items || [];
    const ul = document.createElement("ul");
    if (notices.length === 0) {
      ul.innerHTML = "<li>현재 공지가 없습니다.</li>";
    } else {
      notices.forEach((n, i) => {
        const li = document.createElement("li");
        li.textContent = n;
        if (role === "admin") {
          li.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`'${n}' 공지를 삭제할까요?`)) deleteNotice(i);
          };
        }
        ul.appendChild(li);
      });
    }
    listBox.appendChild(ul);
  } else {
    listBox.innerHTML = "<ul><li>현재 공지가 없습니다.</li></ul>";
  }

  const noticeBox = document.getElementById("school-notice");
  if (noticeBox) {
    noticeBox.onclick = async () => {
      if (role !== "admin") return; // 게스트 클릭 무시
      const choice = prompt("공지 관리\n \n1. 수정\n2. 새 공지 추가\n 취소하려면 ESC");
      if (choice === "1") editNotice(notices);
      else if (choice === "2") {
        const newText = prompt("새 공지를 입력하세요:");
        if (newText && newText.trim() !== "") {
          notices.push(newText.trim());
          await ref.set({ items: notices });
          loadNotice();
        }
      }
    };
  }
}

async function editNotice(notices) {
  if (role !== "admin") return;
  const ref = db.collection("settings").doc("schoolNotice");
  const current = notices.join("\n");
  const newText = prompt("공지 수정 (줄바꿈으로 여러 줄 입력):", current);
  if (newText !== null) {
    const items = newText.split("\n").map(t => t.trim()).filter(Boolean);
    await ref.set({ items });
    loadNotice();
  }
}

async function deleteNotice(index) {
  if (role !== "admin") return;
  const ref = db.collection("settings").doc("schoolNotice");
  const docSnap = await ref.get();
  if (!docSnap.exists) return;
  let items = docSnap.data().items || [];
  items.splice(index, 1);
  await ref.set({ items });
  loadNotice();
}

/***** 이미지 팝업 / 가이드 *****/
function showImagePopup(url) {
  const popup = document.getElementById("image-popup");
  const img = document.getElementById("popup-img");
  if (!popup || !img) return;
  img.src = url;
  popup.style.display = "flex";
}
function closeImagePopup() {
  const popup = document.getElementById("image-popup");
  if (popup) popup.style.display = "none";
}
function showGuide() {
  const guide = document.getElementById("guide-popup");
  if (!guide) return;
  guide.style.display = "block";
  guide.style.left = "30px";
  guide.style.top = "50%";
  guide.style.transform = "translateY(-50%)";
}
function closeGuide() {
  const guide = document.getElementById("guide-popup");
  if (guide) guide.style.display = "none";
}

/***** 화면 전환 네비게이션 *****/
function mountNavBetweenScreens() {
  const back1 = document.getElementById("btn-back-1");
  const back2 = document.getElementById("btn-back-2");
  const goManage = document.getElementById("go-manage");

  if (back1) back1.onclick = () => showScreen("screen-1");
  if (back2) back2.onclick = () => showScreen("screen-2");

  if (goManage) {
    goManage.onclick = () => {
      if (role !== "admin") {
        alert("관리자만 접근 가능합니다.");
        return;
      }
      showScreen("screen-3");
      renderItems("lost-items-manage");
    };
  }
}

/***** 초기 실행 *****/
window.onload = () => {
  mountScreen1();
  mountNavBetweenScreens();
  selectFloor(1);
  loadNotice();
};
