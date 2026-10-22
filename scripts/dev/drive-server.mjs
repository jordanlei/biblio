// Mock Google Drive v3 for local testing. Implements the endpoints Biblio uses (folders,
// `'<id>' in parents` listing, multipart create/update, metadata moves, alt=media downloads,
// file versions), stores files under .dev-drive/, and serves a browsable index at
// http://127.0.0.1:9199/.
//
// Test controls (not part of Drive):
//   POST /__control/offline?on=1|0   simulate an outage (every Drive call fails with 503)
//   GET  /__control/tree             JSON dump: [{ id, path, mimeType, version, text? }]
//   POST /__control/edit?id=…        replace a file's content (simulates an edit in another app)
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.DEV_DRIVE_PORT ?? 9199);
const ROOT = resolve(process.env.DEV_DRIVE_DIR ?? ".dev-drive");
const INDEX = join(ROOT, "index.json");
const FOLDER = "application/vnd.google-apps.folder";
const TEXT_TYPES = /^(text\/|application\/(json|x-bibtex))/;

mkdirSync(join(ROOT, "blobs"), { recursive: true });
const files = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : {};
const persist = () => writeFileSync(INDEX, JSON.stringify(files, null, 2));
let offline = false;

function send(res, status, body, headers = {}) {
  const isJson = body !== undefined && !(body instanceof Buffer) && typeof body !== "string";
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...headers
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

const now = () => new Date().toISOString();
const newId = () => randomUUID().replace(/-/g, "");
const viewUrl = (id) => `http://127.0.0.1:${PORT}/view/${id}`;

function pick(file, fields) {
  const full = { ...file, webViewLink: viewUrl(file.id), version: String(file.version ?? 1) };
  if (!fields) return { id: full.id, name: full.name, mimeType: full.mimeType };
  const wanted = fields.replace(/^.*files\(([^)]*)\).*$/, "$1").split(",").map((f) => f.trim());
  return Object.fromEntries(wanted.map((f) => [f, full[f]]).filter(([, v]) => v !== undefined));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function parseMultipart(req, body) {
  const request = new Request("http://local/", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body });
  const form = await request.formData();
  const metadata = JSON.parse(await form.get("metadata").text());
  const file = form.get("file");
  return { metadata, bytes: Buffer.from(await file.arrayBuffer()) };
}

function pathOf(file) {
  const names = [file.name];
  let parent = files[file.parents?.[0]];
  while (parent) {
    names.unshift(parent.name);
    parent = files[parent.parents?.[0]];
  }
  return names.join("/");
}

/** The tiny subset of Drive's query language Biblio sends. */
function matches(file, q) {
  if (file.trashed) return false;
  for (const clause of q.split(/\s+and\s+/i)) {
    const parent = /'([^']+)' in parents/.exec(clause);
    if (parent && !(file.parents ?? []).includes(parent[1])) return false;
    const mime = /mimeType\s*(=|!=)\s*'([^']+)'/.exec(clause);
    if (mime && (mime[1] === "=") !== (file.mimeType === mime[2])) return false;
    const name = /name\s*=\s*'([^']+)'/.exec(clause);
    if (name && file.name !== name[1].replace(/\\'/g, "'")) return false;
  }
  return true;
}

function listHtml() {
  const rows = Object.values(files)
    .filter((f) => !f.trashed)
    .sort((a, b) => pathOf(a).localeCompare(pathOf(b)))
    .map((f) => {
      const path = pathOf(f);
      const link = f.mimeType === FOLDER ? `${path}/` : `<a href="/view/${f.id}">${path}</a>`;
      return `<tr><td>${link}</td><td>${f.mimeType}</td><td>${f.size ?? ""}</td><td>${f.version ?? ""}</td><td><code>${f.id}</code></td></tr>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>Mock Drive</title><style>body{font:14px system-ui;margin:24px}td,th{padding:4px 10px;text-align:left;border-bottom:1px solid #ddd}</style><h1>Mock Drive</h1><p>${offline ? "<strong>OFFLINE</strong> · " : ""}${ROOT}</p><table><tr><th>Path</th><th>Type</th><th>Bytes</th><th>Version</th><th>ID</th></tr>${rows}</table>`;
}

function store(file, bytes) {
  writeFileSync(join(ROOT, "blobs", file.id), bytes);
  file.size = bytes.length;
  file.version = (file.version ?? 0) + 1;
  file.modifiedTime = now();
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const fields = url.searchParams.get("fields") ?? undefined;
    if (req.method === "OPTIONS") return send(res, 204, "");
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, listHtml(), { "Content-Type": "text/html" });

    // --- test controls ---
    if (url.pathname === "/__control/offline") {
      offline = url.searchParams.get("on") === "1";
      return send(res, 200, { offline });
    }
    if (url.pathname === "/__control/tree") {
      const tree = Object.values(files)
        .filter((f) => url.searchParams.get("trashed") === "1" || !f.trashed)
        .map((f) => ({
          trashed: Boolean(f.trashed),
          id: f.id,
          path: pathOf(f),
          parents: f.parents ?? [],
          mimeType: f.mimeType,
          version: f.version ?? 1,
          ...(TEXT_TYPES.test(f.mimeType) ? { text: readFileSync(join(ROOT, "blobs", f.id), "utf8") } : {})
        }));
      return send(res, 200, tree);
    }
    if (url.pathname === "/__control/edit" && req.method === "POST") {
      const file = files[url.searchParams.get("id")];
      if (!file) return send(res, 404, { error: "no such file" });
      store(file, await readBody(req));
      persist();
      return send(res, 200, pick(file, "id,version"));
    }

    const view = url.pathname.match(/^\/view\/([\w-]+)$/);
    if (view) {
      const file = files[view[1]];
      if (!file || file.trashed) return send(res, 404, "File not found in mock Drive", { "Content-Type": "text/plain" });
      return send(res, 200, readFileSync(join(ROOT, "blobs", file.id)), { "Content-Type": file.mimeType });
    }

    if (offline) return send(res, 503, { error: { code: 503, message: "Mock Drive is offline" } });
    if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) return send(res, 401, { error: { code: 401, message: "Missing access token" } });

    if (req.method === "POST" && url.pathname === "/drive/v3/files") {
      const metadata = JSON.parse((await readBody(req)).toString() || "{}");
      const file = { id: newId(), name: metadata.name ?? "Untitled", mimeType: metadata.mimeType ?? "application/octet-stream", parents: metadata.parents ?? [], createdTime: now(), modifiedTime: now(), version: 1 };
      files[file.id] = file;
      persist();
      return send(res, 200, pick(file, fields));
    }

    if (req.method === "GET" && url.pathname === "/drive/v3/files") {
      const q = url.searchParams.get("q") ?? "";
      const list = Object.values(files).filter((f) => matches(f, q));
      return send(res, 200, { files: list.map((f) => pick(f, fields ?? "files(id,name,mimeType)")) });
    }

    const fileRoute = url.pathname.match(/^\/drive\/v3\/files\/([\w-]+)$/);
    if (fileRoute) {
      const file = files[fileRoute[1]];
      // Trashed files are invisible except to an update (which can untrash them).
      if (!file || (file.trashed && req.method !== "PATCH")) return send(res, 404, { error: { code: 404, message: "File not found" } });
      if (req.method === "DELETE") {
        delete files[file.id];
        rmSync(join(ROOT, "blobs", file.id), { force: true });
        persist();
        return send(res, 204, "");
      }
      if (req.method === "GET" && url.searchParams.get("alt") === "media") {
        return send(res, 200, readFileSync(join(ROOT, "blobs", file.id)), { "Content-Type": file.mimeType });
      }
      if (req.method === "GET") return send(res, 200, pick(file, fields));
      if (req.method === "PATCH") {
        const add = url.searchParams.get("addParents");
        const remove = url.searchParams.get("removeParents");
        const metadata = JSON.parse((await readBody(req)).toString() || "{}");
        if (remove) file.parents = (file.parents ?? []).filter((p) => !remove.split(",").includes(p));
        if (add) file.parents = [...new Set([...(file.parents ?? []), ...add.split(",")])];
        if (metadata.name) file.name = metadata.name;
        if (typeof metadata.trashed === "boolean") file.trashed = metadata.trashed;
        persist();
        return send(res, 200, pick(file, fields));
      }
    }

    const upload = url.pathname.match(/^\/upload\/drive\/v3\/files(?:\/([\w-]+))?$/);
    if (upload && (req.method === "POST" || req.method === "PATCH")) {
      const { metadata, bytes } = await parseMultipart(req, await readBody(req));
      const existing = upload[1] ? files[upload[1]] : undefined;
      if (upload[1] && !existing) return send(res, 404, { error: { code: 404, message: "File not found" } });
      const file = existing ?? { id: newId(), parents: metadata.parents ?? [], createdTime: now(), version: 0 };
      Object.assign(file, { name: metadata.name ?? file.name, mimeType: metadata.mimeType ?? file.mimeType ?? "application/octet-stream" });
      files[file.id] = file;
      store(file, bytes);
      persist();
      return send(res, 200, pick(file, fields));
    }

    send(res, 404, { error: { code: 404, message: `No mock for ${req.method} ${url.pathname}` } });
  } catch (error) {
    send(res, 500, { error: { code: 500, message: String(error) } });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Mock Drive listening on http://127.0.0.1:${PORT} (${ROOT})`));
