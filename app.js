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

    // ✅ 이미지 추가 (클릭 시 전체보기 팝업)
    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.style.cursor = "pointer";
      img.onclick = (e) => {
        e.stopPropagation(); // 삭제 이벤트 막기
        showImagePopup(item.image);
      };
      li.appendChild(img);
    }

    // ✅ 이름 클릭 시 삭제
    const text = document.createElement("p");
    text.innerText = item.name;
    text.style.cursor = "pointer";
    text.onclick = () => deleteItem(index, items);
    li.appendChild(text);

    list.appendChild(li);
  });
}

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

async function deleteItem(index, items) {
  if (confirm("이 분실물을 삭제할까요?")) {
    items.splice(index, 1);
    await db.collection("lostItems").doc(`floor${selectedFloor}`).set({ items });
    renderItems();
  }
}

async function searchItems() {
  const query = document.getElementById("search-input").value.toLowerCase().trim();
  if (!query) return;
  let results = [];
  for (let floor = 1; floor <= 4; floor++) {
    const doc = await db.collection("lostItems").doc(`floor${floor}`).get();
    const items = doc.exists ? doc.data().items : [];
    if (items.some(item => item.name.toLowerCase().includes(query))) {
      results.push(`${floor}층`);
    }
  }
  alert(results.length
    ? `'${query}'은(는) ${results.join(", ")}에 있습니다.`
    : `'${query}'을(를) 찾을 수 없습니다.`);
}

function showGuide() {
  document.getElementById("guide-popup").style.display = "block";
}

function closeGuide() {
  document.getElementById("guide-popup").style.display = "none";
}

// ✅ 이미지 전체보기 팝업 함수
function showImagePopup(url) {
  const popup = document.getElementById("image-popup");
  const popupImg = document.getElementById("popup-img");
  popupImg.src = url;
  popup.style.display = "flex";
}

// ✅ 팝업 닫기 함수
function closeImagePopup() {
  document.getElementById("image-popup").style.display = "none";
}

window.onload = () => selectFloor(1);
