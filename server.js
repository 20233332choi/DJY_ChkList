const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");
const PUBLIC_DIR = path.join(ROOT, "public");

const clients = new Set();
let state = null;
let writeQueue = Promise.resolve();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

async function loadState() {
  if (state) return state;
  const raw = await fs.readFile(DATA_FILE, "utf8");
  state = JSON.parse(raw);
  return state;
}

function saveState() {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2) + "\n", "utf8")
  );
  return writeQueue;
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
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function broadcast() {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

function findItem(itemId) {
  for (const category of state.categories) {
    const item = category.items.find(entry => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

async function handleApi(req, res, url) {
  await loadState();

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  }

  if (req.method === "PATCH" && url.pathname === "/api/items") {
    const payload = JSON.parse(await readBody(req));
    const item = findItem(payload.id);
    if (!item) {
      sendJson(res, 404, { error: "Item not found" });
      return true;
    }

    item.checked = Boolean(payload.checked);
    item.updatedAt = new Date().toISOString();
    await saveState();
    broadcast();
    sendJson(res, 200, item);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    for (const category of state.categories) {
      for (const item of category.items) {
        item.checked = false;
        item.updatedAt = null;
      }
    }
    await saveState();
    broadcast();
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
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DJY checklist running at http://localhost:${PORT}`);
});
