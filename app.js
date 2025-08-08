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

let selectedFloor = 1;

/* ✅ 층 선택 후 분실물 렌더링 */
async function selectFloor(floor) {
  selectedFloor = floor;
  document.getElementById("floor-title").innerText = `${floor}층 분실물`;
  renderItems();
}

async function renderItems() {
  const list = document.getElementById("lost-items");
  list.innerHTML = "";
  const doc = await db.collection("lostItems").doc(`floor${selectedFloor}`).get();
  const items = (doc.exists ? doc.data().items : []).slice(-30);

  items.forEach((item, index) => {
    const li = document.createElement("li");

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

    const text = document.createElement("p");
    text.innerText = item.name;
    text.style.cursor = "pointer";
    text.onclick = () => deleteItem(index, items);
    li.appendChild(text);

    list.appendChild(li);
  });
}

/* ✅ 분실물 추가 */
async function addItem() {
  const input = document.getElementById("item-input");
  const imageInput = document.getElementById("item-image");
  const itemName = input.value.trim();
  const imageFile = imageInput.files[0];
  if (!itemName) return;

  const newItem = { name: itemName, image: null };

  const saveItem = async () => {
    const ref = db.collection("lostItems").doc(`floor${selectedFloor}`);
    const doc = await ref.get();
    const items = doc.exists ? doc.data().items : [];
    items.push(newItem);
    await ref.set({ items });
    input.value = "";
    imageInput.value = "";
    renderItems();
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

/* ✅ 분실물 삭제 */
async function deleteItem(index, items) {
  if (!confirm("이 분실물을 삭제하시겠습니까?")) return;
  items.splice(index, 1);
  await db.collection("lostItems").doc(`floor${selectedFloor}`).set({ items });
  renderItems();
}

/* ✅ 검색 기능 (검색 결과 UI + 삭제 지원) */
async function searchItems() {
  const query = document.getElementById("search-input").value.toLowerCase().trim();
  const list = document.getElementById("lost-items");
  list.innerHTML = "";

  if (!query) {
    alert("검색어를 입력하세요.");
    return;
  }

  let foundItems = [];
  for (let floor = 1; floor <= 4; floor++) {
    const doc = await db.collection("lostItems").doc(`floor${floor}`).get();
    const items = doc.exists ? doc.data().items : [];
    const matched = items
      .filter(item => item.name.toLowerCase().includes(query))
      .map(item => ({ ...item, floor }));
    foundItems = foundItems.concat(matched);
  }

  if (foundItems.length === 0) {
    alert(`'${query}'을(를) 찾을 수 없습니다.`);
    return;
  }

  document.getElementById("floor-title").innerText = `🔍 '${query}' 검색 결과`;

  foundItems.forEach(item => {
    const li = document.createElement("li");

    const floorTag = document.createElement("span");
    floorTag.textContent = `[${item.floor}층] `;
    floorTag.style.fontWeight = "bold";
    li.appendChild(floorTag);

    const name = document.createElement("span");
    name.textContent = item.name;
    name.style.cursor = "pointer";
    name.onclick = () => deleteItemFromSearch(item.floor, item.name);
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

    list.appendChild(li);
  });
}

/* ✅ 검색 결과에서도 삭제 가능 */
async function deleteItemFromSearch(floor, name) {
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

/* ✅ 공지 불러오기 + 관리 */
async function loadNotice() {
  const ref = db.collection("settings").doc("schoolNotice");
  const docSnap = await ref.get();
  const listBox = document.getElementById("notice-text");
  listBox.innerHTML = "";

  let notices = [];
  if (docSnap.exists) {
    notices = docSnap.data().items || [];
    const ul = document.createElement("ul");
    notices.length === 0
      ? ul.innerHTML = "<li>현재 공지가 없습니다.</li>"
      : notices.forEach((n, i) => {
          const li = document.createElement("li");
          li.textContent = n;
          li.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`'${n}' 공지를 삭제할까요?`)) deleteNotice(i);
          };
          ul.appendChild(li);
        });
    listBox.appendChild(ul);
  } else {
    listBox.innerHTML = "<ul><li>현재 공지가 없습니다.</li></ul>";
  }

  document.getElementById("school-notice").onclick = async () => {
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

async function editNotice(notices) {
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
  const ref = db.collection("settings").doc("schoolNotice");
  const docSnap = await ref.get();
  if (!docSnap.exists) return;
  let items = docSnap.data().items || [];
  items.splice(index, 1);
  await ref.set({ items });
  loadNotice();
}

/* ✅ 사용 설명서 (드래그 제거) */
function showGuide() {
  const guide = document.getElementById("guide-popup");
  guide.style.display = "block";
  guide.style.left = "30px";
  guide.style.top = "50%";
  guide.style.transform = "translateY(-50%)";
}
function closeGuide() {
  document.getElementById("guide-popup").style.display = "none";
}

/* ✅ 이미지 팝업 */
function showImagePopup(url) {
  const popup = document.getElementById("image-popup");
  document.getElementById("popup-img").src = url;
  popup.style.display = "flex";
}
function closeImagePopup() {
  document.getElementById("image-popup").style.display = "none";
}

/* ✅ 초기 실행 */
window.onload = () => {
  selectFloor(1);
  loadNotice();
};
