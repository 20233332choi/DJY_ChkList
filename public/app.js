const categoryList = document.querySelector("#category-list");
const checkedCount = document.querySelector("#checked-count");
const totalCount = document.querySelector("#total-count");
const searchInput = document.querySelector("#search-input");
const resetButton = document.querySelector("#reset-button");
const statusBadge = document.querySelector("#status");

let currentState = null;
let searchTerm = "";

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

function render(state) {
  currentState = state;
  const total = totals(state.categories);
  checkedCount.textContent = total.checked;
  totalCount.textContent = `/ ${total.total}`;

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
    const items = category.items.map(item => `
      <li class="item ${item.checked ? "checked" : ""}">
        <label>
          <input type="checkbox" data-id="${item.id}" ${item.checked ? "checked" : ""}>
          <span>${escapeHtml(item.name)}</span>
        </label>
      </li>
    `).join("");

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
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

async function updateItem(id, checked) {
  const response = await fetch("/api/items", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, checked })
  });

  if (!response.ok) {
    throw new Error("Failed to update item");
  }
}

categoryList.addEventListener("change", async event => {
  const checkbox = event.target.closest('input[type="checkbox"][data-id]');
  if (!checkbox) return;

  checkbox.disabled = true;
  try {
    await updateItem(checkbox.dataset.id, checkbox.checked);
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

async function loadInitialState() {
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
