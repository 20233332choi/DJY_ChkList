const categoryList = document.querySelector("#category-list");
const managePanel = document.querySelector("#manage-panel");
const logPanel = document.querySelector("#log-panel");
const checkedCount = document.querySelector("#checked-count");
const totalCount = document.querySelector("#total-count");
const searchInput = document.querySelector("#search-input");
const resetButton = document.querySelector("#reset-button");
const manageToggle = document.querySelector("#manage-toggle");
const logToggle = document.querySelector("#log-toggle");
const statusBadge = document.querySelector("#status");
const actorGate = document.querySelector("#actor-gate");
const actorForm = document.querySelector("#actor-form");
const actorInput = document.querySelector("#actor-input");
const actorName = document.querySelector("#actor-name");

const ACTOR_STORAGE_KEY = "djy-checklist-actor";

let currentState = null;
let searchTerm = "";
let currentView = "board";
let currentActor = localStorage.getItem(ACTOR_STORAGE_KEY) || "";

function setStatus(text, className) {
  statusBadge.textContent = text;
  statusBadge.className = `status ${className}`;
}

function totals(categories) {
  const allItems = categories.flatMap(category => category.items);
  return {
    total: allItems.length,
    checked: allItems.filter(item => item.checked).length
  };
}

function setActor(name) {
  currentActor = String(name || "").trim();
  if (currentActor) {
    localStorage.setItem(ACTOR_STORAGE_KEY, currentActor);
    actorGate.hidden = true;
    actorName.textContent = currentActor;
  } else {
    localStorage.removeItem(ACTOR_STORAGE_KEY);
    actorGate.hidden = false;
    actorInput.focus();
  }
}

function setView(view) {
  currentView = view;
  const isManaging = view === "manage";
  const isLog = view === "log";

  manageToggle.setAttribute("aria-pressed", String(isManaging));
  logToggle.setAttribute("aria-pressed", String(isLog));
  manageToggle.textContent = isManaging ? "체크 보드" : "품목 관리";
  logToggle.textContent = isLog ? "체크 보드" : "로그 보기";

  categoryList.hidden = isManaging || isLog;
  managePanel.hidden = !isManaging;
  logPanel.hidden = !isLog;

  if (currentState) render(currentState);
}

function render(state) {
  currentState = state;
  const total = totals(state.categories);
  checkedCount.textContent = total.checked;
  totalCount.textContent = `/ ${total.total}`;
  renderManager(state);
  renderLog(state);

  const query = searchTerm.trim().toLowerCase();
  const visibleCategories = state.categories
    .map(category => ({
      ...category,
      items: category.items.filter(item => item.name.toLowerCase().includes(query))
    }))
    .filter(category => category.items.length > 0);

  if (visibleCategories.length === 0) {
    categoryList.innerHTML = '<div class="empty">검색 결과가 없습니다.</div>';
    return;
  }

  categoryList.innerHTML = visibleCategories.map(category => {
    const categoryTotal = category.items.length;
    const categoryChecked = category.items.filter(item => item.checked).length;
    const items = category.items.map(item => {
      const visibleActor = item.checked ? item.checkedBy : item.addedBy;
      return `
      <li class="item ${item.checked ? "checked" : ""}">
        <label>
          <input type="checkbox" data-id="${item.id}" ${item.checked ? "checked" : ""}>
          <span class="item-main">
            <span class="item-name">${escapeHtml(item.name)}</span>
            ${visibleActor ? `<span class="item-actor">${escapeHtml(visibleActor)}</span>` : ""}
          </span>
        </label>
      </li>
    `;
    }).join("");

    return `
      <article class="category" data-category="${escapeHtml(category.id)}">
        <div class="category-header">
          <h2><span></span>${escapeHtml(category.name)}</h2>
          <span class="category-progress">${categoryChecked} / ${categoryTotal}</span>
        </div>
        <ul class="items">${items}</ul>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function categoryOptions(selectedId) {
  return currentState.categories.map(category => `
    <option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>
      ${escapeHtml(category.name)}
    </option>
  `).join("");
}

function renderManager(state) {
  if (currentView !== "manage") return;

  managePanel.innerHTML = `
    <form class="add-category-form" data-action="add-category">
      <input name="name" type="text" placeholder="새 카테고리 이름" autocomplete="off" required>
      <button class="secondary-button" type="submit">카테고리 추가</button>
    </form>
    <div class="manage-list">
      ${state.categories.map((category, categoryIndex) => `
        <article class="manage-category" data-category-id="${escapeHtml(category.id)}">
          <form class="manage-category-head" data-action="rename-category">
            <input name="name" type="text" value="${escapeHtml(category.name)}" required>
            <div class="order-actions" aria-label="카테고리 순서">
              <button class="icon-button secondary-button" type="button" data-action="move-category" data-direction="up" ${categoryIndex === 0 ? "disabled" : ""}>▲</button>
              <button class="icon-button secondary-button" type="button" data-action="move-category" data-direction="down" ${categoryIndex === state.categories.length - 1 ? "disabled" : ""}>▼</button>
            </div>
            <button class="secondary-button" type="submit">수정</button>
            <button class="danger-button" type="button" data-action="delete-category" ${category.items.length ? "disabled" : ""}>삭제</button>
          </form>
          <form class="add-item-form" data-action="add-item">
            <input name="name" type="text" placeholder="새 품목 이름" autocomplete="off" required>
            <button class="secondary-button" type="submit">품목 추가</button>
          </form>
          <ul class="manage-items">
            ${category.items.map((item, itemIndex) => `
              <li class="manage-item" data-item-id="${escapeHtml(item.id)}">
                <input name="name" type="text" value="${escapeHtml(item.name)}" required>
                <select name="categoryId" aria-label="카테고리">${categoryOptions(category.id)}</select>
                <div class="order-actions" aria-label="품목 순서">
                  <button class="icon-button secondary-button" type="button" data-action="move-item" data-direction="up" ${itemIndex === 0 ? "disabled" : ""}>▲</button>
                  <button class="icon-button secondary-button" type="button" data-action="move-item" data-direction="down" ${itemIndex === category.items.length - 1 ? "disabled" : ""}>▼</button>
                </div>
                <button class="secondary-button" type="button" data-action="save-item">저장</button>
                <button class="danger-button" type="button" data-action="delete-item">삭제</button>
              </li>
            `).join("")}
          </ul>
        </article>
      `).join("")}
    </div>
  `;
}

function renderLog(state) {
  if (currentView !== "log") return;
  const logs = (state.activityLog || []).slice().reverse();

  if (logs.length === 0) {
    logPanel.innerHTML = '<div class="empty">아직 기록된 로그가 없습니다.</div>';
    return;
  }

  logPanel.innerHTML = `
    <div class="log-list">
      ${logs.map(entry => `
        <article class="log-entry">
          <div>
            <strong>${escapeHtml(entry.itemName || entry.categoryName || "-")}</strong>
            <span>${escapeHtml(logActionLabel(entry.action))} · ${escapeHtml(entry.categoryName || "")}</span>
          </div>
          <div>
            <span>${escapeHtml(entry.actor || "-")}</span>
            <time datetime="${escapeHtml(entry.at || "")}">${formatDate(entry.at)}</time>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function logActionLabel(action) {
  return {
    "add-item": "품목 추가",
    "add-category": "카테고리 추가",
    check: "체크",
    uncheck: "체크 해제"
  }[action] || "기록";
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

async function updateItem(payload) {
  return requestJson("/api/items", {
    method: "PATCH",
    body: { ...payload, actor: currentActor }
  });
}

actorForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = new FormData(actorForm).get("actor");
  setActor(name);
});

categoryList.addEventListener("change", async event => {
  const checkbox = event.target.closest('input[type="checkbox"][data-id]');
  if (!checkbox) return;

  checkbox.disabled = true;
  try {
    await updateItem({ id: checkbox.dataset.id, checked: checkbox.checked });
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    setStatus("저장 실패", "offline");
  } finally {
    checkbox.disabled = false;
  }
});

searchInput.addEventListener("input", event => {
  searchTerm = event.target.value;
  if (currentState) render(currentState);
});

resetButton.addEventListener("click", async () => {
  if (!confirm("전체 체크를 해제할까요?")) return;
  const response = await fetch("/api/reset", { method: "POST" });
  if (!response.ok) setStatus("초기화 실패", "offline");
});

manageToggle.addEventListener("click", () => {
  setView(currentView === "manage" ? "board" : "manage");
});

logToggle.addEventListener("click", () => {
  setView(currentView === "log" ? "board" : "log");
});

managePanel.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  const action = form.dataset.action;
  const categoryEl = form.closest("[data-category-id]");
  const name = new FormData(form).get("name");

  try {
    if (action === "add-category") {
      await requestJson("/api/categories", {
        method: "POST",
        body: { name, actor: currentActor }
      });
      form.reset();
      return;
    }
    if (action === "rename-category") {
      await requestJson("/api/categories", {
        method: "PATCH",
        body: { id: categoryEl.dataset.categoryId, name, actor: currentActor }
      });
      return;
    }
    if (action === "add-item") {
      await requestJson("/api/items", {
        method: "POST",
        body: { categoryId: categoryEl.dataset.categoryId, name, actor: currentActor }
      });
      form.reset();
    }
  } catch (error) {
    setStatus(error.message, "offline");
  }
});

managePanel.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const categoryEl = button.closest("[data-category-id]");
  const itemEl = button.closest("[data-item-id]");

  try {
    if (action === "delete-category") {
      if (!confirm("빈 카테고리를 삭제할까요?")) return;
      await requestJson("/api/categories/delete", {
        method: "POST",
        body: { id: categoryEl.dataset.categoryId, actor: currentActor }
      });
      return;
    }
    if (action === "move-category") {
      await requestJson("/api/categories/move", {
        method: "POST",
        body: { id: categoryEl.dataset.categoryId, direction: button.dataset.direction, actor: currentActor }
      });
      return;
    }
    if (action === "save-item") {
      await updateItem({
        id: itemEl.dataset.itemId,
        name: itemEl.querySelector('input[name="name"]').value,
        categoryId: itemEl.querySelector('select[name="categoryId"]').value
      });
      return;
    }
    if (action === "move-item") {
      await requestJson("/api/items/move", {
        method: "POST",
        body: { id: itemEl.dataset.itemId, direction: button.dataset.direction, actor: currentActor }
      });
      return;
    }
    if (action === "delete-item") {
      if (!confirm("이 품목을 삭제할까요?")) return;
      await requestJson("/api/items/delete", {
        method: "POST",
        body: { id: itemEl.dataset.itemId, actor: currentActor }
      });
    }
  } catch (error) {
    setStatus(error.message, "offline");
  }
});

async function loadInitialState() {
  setActor(currentActor);
  const response = await fetch("/api/state");
  if (!response.ok) throw new Error("Failed to load state");
  render(await response.json());
}

function connectEvents() {
  const events = new EventSource("/api/events");

  events.addEventListener("open", () => setStatus("실시간 연결", "online"));
  events.addEventListener("message", event => render(JSON.parse(event.data)));
  events.addEventListener("error", () => setStatus("재연결 중", "offline"));
}

loadInitialState()
  .then(connectEvents)
  .catch(() => setStatus("연결 실패", "offline"));
