// Fetches PDFs for the Biblio web app (via bridge.js). Extensions with host permissions aren't
// bound by CORS, and `credentials: "include"` lets institutional/subscription access work too.
//
// This worker never looks at pages on its own: metadata is only ever read when you click the
// extension (popup.js injects the translators into the active tab then, and only then).
importScripts("app-url.js");
const MAX_BYTES = 80 * 1024 * 1024;

function encodeCapture(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function appUrl() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return appUrl || DEFAULT_APP_URL;
}

async function showOverlay(tabId, url) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["overlay.js"] });
  await chrome.tabs.sendMessage(tabId, { type: "show-biblio-overlay", url });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "save-to-biblio", title: "Save to Biblio", contexts: ["page", "selection", "link"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-biblio" || !tab?.id) return;
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["zotero-capture.js"] });
    const paper = injection?.result;
    if (!paper?.isPaper || !paper.title) {
      await showOverlay(tab.id, `${await appUrl()}/search`);
      return;
    }
    await showOverlay(tab.id, `${await appUrl()}/capture#${encodeCapture(paper)}`);
  } catch {
    try {
      await showOverlay(tab.id, `${await appUrl()}/search`);
    } catch {
      // chrome:// pages and the Web Store refuse script injection; there is nowhere to render an overlay.
    }
  }
});

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Private/loopback/link-local space. A credentialed fetch from the extension can reach the user's
// own LAN and localhost services, so those are refused even for our own pages.
//
// Always test `new URL(...).hostname`, never the raw string: the URL parser folds 2130706433,
// 0x7f000001, 0177.0.0.1 and 127.1 to 127.0.0.1, and checking before that would miss them.
// Mirrors functions/safe-destination.js; keep the two in step.
const BLOCKED_NAMES = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal"]);

function isPrivateIpv4(address) {
  const parts = address.split(".");
  if (parts.length !== 4) return false;
  if (parts.some((p) => p === "" || !/^\d+$/.test(p) || Number(p) > 255)) return true;
  const [a, b] = parts.map(Number);
  if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateAddress(hostname) {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_NAMES.has(host)) return true;
  if (/\.(internal|local|localhost|home\.arpa)$/.test(host)) return true;
  if (host.includes(":")) {
    const v6 = host.split("%")[0];
    if (v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return true;
    const mapped = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v6);
    return mapped ? isPrivateIpv4(mapped[1]) : /^(0:)*0*:?:?1$/.test(v6.replace(/:+/g, ":"));
  }
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPrivateIpv4(host);
  if (/^[\d.]+$/.test(host)) return true;
  return false;
}

async function fetchPdf(url) {
  let target;
  try {
    target = new URL(String(url));
  } catch {
    throw new Error("Only http(s) URLs can be fetched.");
  }
  if (!/^https?:$/.test(target.protocol)) throw new Error("Only http(s) URLs can be fetched.");
  if (target.username || target.password) throw new Error("That address isn't allowed.");
  if (isPrivateAddress(target.hostname)) throw new Error("That address isn't allowed.");
  const response = await fetch(target, { credentials: "include", redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error("PDF is too large.");
  const head = new TextDecoder("latin1").decode(buffer.slice(0, 1024));
  if (!head.includes("%PDF-")) throw new Error("That link didn't return a PDF.");
  return { base64: toBase64(buffer), contentType: "application/pdf" };
}

/**
 * Only this extension's own content scripts, on an origin we actually ship to.
 *
 * Derived from the manifest's concrete origins rather than by interpreting match patterns:
 * a pattern language has wildcards, and a parser that mishandles one would widen who can ask
 * for a credentialed fetch. Patterns containing a wildcard are ignored here by design.
 */
function allowedOrigins() {
  const patterns = (chrome.runtime.getManifest().content_scripts ?? []).flatMap((entry) => entry.matches ?? []);
  return patterns
    .map((pattern) => {
      const [scheme, rest] = pattern.split("://");
      if (!scheme || !rest) return ""; // <all_urls> and friends: no concrete origin
      const host = rest.split("/")[0];
      // A wildcard scheme or host has no single origin to compare against; ignore it.
      if (scheme.includes("*") || host.includes("*") || !host) return "";
      try {
        return new URL(`${scheme}://${host}`).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function trusted(sender) {
  if (sender?.id !== chrome.runtime.id) return false;
  let origin = sender.origin;
  if (!origin && sender.url) {
    try {
      origin = new URL(sender.url).origin;
    } catch {
      return false;
    }
  }
  if (!origin || origin === "null") return false; // opaque origins: sandboxed frames, data:, about:blank
  return allowedOrigins().includes(origin);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "zotero-http" && sender?.id === chrome.runtime.id) {
    fetchTranslatorRequest(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  }
  if (message?.type !== "fetch-pdf") return false;
  // A credentialed fetch is a powerful capability: refuse anything but our own app's pages.
  if (!trusted(sender)) {
    sendResponse({ ok: false, error: "Not allowed from this page." });
    return false;
  }
  fetchPdf(message.url)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
  return true; // async response
});

const TRANSLATOR_HTTP_MAX_BYTES = 12 * 1024 * 1024;

async function fetchTranslatorRequest(message) {
  let target;
  try {
    target = new URL(String(message.url));
  } catch {
    throw new Error("Translator requested an invalid URL.");
  }
  if (!/^https?:$/.test(target.protocol) || target.username || target.password || isPrivateAddress(target.hostname)) {
    throw new Error("That translator URL isn't allowed.");
  }
  const method = String(message.method || "GET").toUpperCase();
  if (!["GET", "POST", "HEAD"].includes(method)) throw new Error("That translator method isn't allowed.");
  const response = await fetch(target, {
    method,
    headers: message.headers && typeof message.headers === "object" ? message.headers : undefined,
    body: method === "GET" || method === "HEAD" ? undefined : String(message.body ?? ""),
    credentials: "include",
    redirect: "follow"
  });
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > TRANSLATOR_HTTP_MAX_BYTES) throw new Error("Translator response is too large.");
  return {
    status: response.status,
    responseURL: response.url,
    responseText: new TextDecoder().decode(buffer)
  };
}
