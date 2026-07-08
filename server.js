const http = require("http");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");
const PUBLIC_DIR = path.join(ROOT, "public");

const clients = new Set();
let writeQueue = Promise.resolve();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg"
};

async function loadState() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function saveState(state) {
  const tmpFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(state, null, 2) + "\n", "utf8");
  await fs.rename(tmpFile, DATA_FILE);
}

async function withStateMutation(mutator) {
  const nextWrite = writeQueue.catch(() => {}).then(async () => {
    const state = await loadState();
    const result = mutator(state);
    await saveState(state);
    broadcast(state);
    return result;
  });
  writeQueue = nextWrite.catch(() => {});
  return nextWrite;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(Object.assign(new Error("Invalid JSON body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function broadcast(state) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) res.write(payload);
}

function findCategory(state, categoryId) {
  return state.categories.find(category => category.id === categoryId) || null;
}

function findItemEntry(state, itemId) {
  for (const category of state.categories) {
    const index = category.items.findIndex(entry => entry.id === itemId);
    if (index >= 0) return { category, index, item: category.items[index] };
  }
  return null;
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function cleanName(value) {
  return String(value || "").trim();
}

function moveItem(entry, nextCategory) {
  entry.category.items.splice(entry.index, 1);
  nextCategory.items.push(entry.item);
}

function moveArrayEntry(list, index, direction) {
  const offset = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = index + offset;
  if (!offset || nextIndex < 0 || nextIndex >= list.length) return false;
  const [entry] = list.splice(index, 1);
  list.splice(nextIndex, 0, entry);
  return true;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, await loadState());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`data: ${JSON.stringify(await loadState())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  }

  if (req.method === "PATCH" && url.pathname === "/api/items") {
    const payload = await readBody(req);
    const item = await withStateMutation(state => {
      const entry = findItemEntry(state, payload.id);
      if (!entry) throw Object.assign(new Error("Item not found"), { status: 404 });

      if (Object.prototype.hasOwnProperty.call(payload, "checked")) {
        entry.item.checked = Boolean(payload.checked);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "name")) {
        const name = cleanName(payload.name);
        if (!name) throw Object.assign(new Error("Item name is required"), { status: 400 });
        entry.item.name = name;
      }
      if (payload.categoryId && payload.categoryId !== entry.category.id) {
        const nextCategory = findCategory(state, payload.categoryId);
        if (!nextCategory) throw Object.assign(new Error("Category not found"), { status: 404 });
        moveItem(entry, nextCategory);
      }
      entry.item.updatedAt = new Date().toISOString();
      return entry.item;
    });

    sendJson(res, 200, item);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/items") {
    const payload = await readBody(req);
    const item = await withStateMutation(state => {
      const category = findCategory(state, payload.categoryId);
      const name = cleanName(payload.name);
      if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
      if (!name) throw Object.assign(new Error("Item name is required"), { status: 400 });

      const nextItem = {
        id: makeId("item"),
        name,
        checked: false,
        updatedAt: null
      };
      category.items.push(nextItem);
      return nextItem;
    });

    sendJson(res, 201, item);
    return true;
  }

  if ((req.method === "DELETE" && url.pathname === "/api/items") ||
      (req.method === "POST" && url.pathname === "/api/items/delete")) {
    const payload = await readBody(req);
    await withStateMutation(state => {
      const entry = findItemEntry(state, payload.id);
      if (!entry) throw Object.assign(new Error("Item not found"), { status: 404 });
      entry.category.items.splice(entry.index, 1);
      return null;
    });

    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/items/move") {
    const payload = await readBody(req);
    await withStateMutation(state => {
      const entry = findItemEntry(state, payload.id);
      if (!entry) throw Object.assign(new Error("Item not found"), { status: 404 });
      moveArrayEntry(entry.category.items, entry.index, payload.direction);
      return null;
    });

    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/categories") {
    const payload = await readBody(req);
    const category = await withStateMutation(state => {
      const name = cleanName(payload.name);
      if (!name) throw Object.assign(new Error("Category name is required"), { status: 400 });

      const nextCategory = {
        id: makeId("category"),
        name,
        items: []
      };
      state.categories.push(nextCategory);
      return nextCategory;
    });

    sendJson(res, 201, category);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/categories/move") {
    const payload = await readBody(req);
    await withStateMutation(state => {
      const index = state.categories.findIndex(category => category.id === payload.id);
      if (index < 0) throw Object.assign(new Error("Category not found"), { status: 404 });
      moveArrayEntry(state.categories, index, payload.direction);
      return null;
    });

    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "PATCH" && url.pathname === "/api/categories") {
    const payload = await readBody(req);
    const category = await withStateMutation(state => {
      const target = findCategory(state, payload.id);
      const name = cleanName(payload.name);
      if (!target) throw Object.assign(new Error("Category not found"), { status: 404 });
      if (!name) throw Object.assign(new Error("Category name is required"), { status: 400 });
      target.name = name;
      return target;
    });

    sendJson(res, 200, category);
    return true;
  }

  if ((req.method === "DELETE" && url.pathname === "/api/categories") ||
      (req.method === "POST" && url.pathname === "/api/categories/delete")) {
    const payload = await readBody(req);
    await withStateMutation(state => {
      const index = state.categories.findIndex(category => category.id === payload.id);
      if (index < 0) throw Object.assign(new Error("Category not found"), { status: 404 });
      if (state.categories[index].items.length > 0) {
        throw Object.assign(new Error("Category must be empty before deletion"), { status: 409 });
      }
      state.categories.splice(index, 1);
      return null;
    });

    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    const state = await withStateMutation(nextState => {
      for (const category of nextState.categories) {
        for (const item of category.items) {
          item.checked = false;
          item.updatedAt = null;
        }
      }
      return nextState;
    });
    sendJson(res, 200, state);
    return true;
  }

  return false;
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { error: "Not found" });
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DJY checklist running at http://localhost:${PORT}`);
});
