// Saves the paper on the current tab to Biblio, and fetches PDFs for the Biblio web app (via
// bridge.js). Extensions with host permissions aren't bound by CORS, and `credentials: "include"`
// lets institutional/subscription access work too.
//
// This worker never looks at pages on its own: a page is read only when you click the toolbar
// button or the "Save to Biblio" menu item, which both run saveTab().
importScripts("app-url.js", "zotero-translator-index.js");
const MAX_BYTES = 80 * 1024 * 1024;
const CAPTURE_TOKEN_TTL = 15 * 60 * 1000;
const CAPTURE_TOKEN_PREFIX = "biblio-capture:";

function encodeCapture(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "save-to-biblio", title: "Save to Biblio", contexts: ["page", "selection", "link"] });
});
chrome.action.onClicked.addListener((tab) => saveTab(tab));
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-biblio") saveTab(tab);
});

/** Read the tab with Zotero's translators and open Biblio's capture page for it. */
async function saveTab(tab) {
  if (!tab?.id) return;
  await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  await chrome.action.setTitle({ tabId: tab.id, title: "Save to Biblio" });
  try {
    const paper = await readTab(tab);
    if (!paper?.isPaper || !paper.title) throw new Error("No paper detected on this page.");
    const captureToken = await registerCapturedPdf(paper.pdfUrl, tab);
    const capture = captureToken ? { ...paper, captureToken } : paper;
    await chrome.tabs.create({ url: `${DEFAULT_APP_URL}/capture#${encodeCapture(capture)}`, index: tab.index + 1 });
  } catch (error) {
    // chrome:// pages, the Web Store, or no paper: say so on the button itself.
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#b3261e" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    await chrome.action.setTitle({ tabId: tab.id, title: `Biblio: ${error?.message ?? "couldn't read this page."}` });
  }
}

async function readTab(tab) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["zotero-runtime.js", ...translatorFilesFor(tab.url), "zotero-capture.js"]
  });
  return injection?.result ?? null;
}

// The Zotero Connector's selection: web translators whose target matches the URL (an empty target
// matches every page), every import and search translator (translators hand data to these), and
// anything a chosen translator calls by ID. zotero-translator-index.js lists all of them.
const translatorsById = new Map(ZOTERO_TRANSLATORS.map((t) => [t.id, t]));
const targets = new Map();

function translatorFilesFor(url) {
  const chosen = new Set();
  const visit = (id) => {
    const translator = translatorsById.get(id);
    if (!translator || chosen.has(id)) return;
    chosen.add(id);
    translator.deps.forEach(visit);
  };
  for (const translator of ZOTERO_TRANSLATORS) {
    if (translator.type & 9) visit(translator.id);
    else if (translator.type & 4) {
      if (!targets.has(translator.id)) {
        try {
          targets.set(translator.id, translator.target ? new RegExp(translator.target, "i") : null);
        } catch {
          targets.set(translator.id, false);
        }
      }
      const target = targets.get(translator.id);
      if (target === null || (target && target.test(url))) visit(translator.id);
    }
  }
  return [...chosen].map((id) => `zotero-translators/${id}.js`);
}

async function registerCapturedPdf(url, tab) {
  if (!url) return undefined;
  let target;
  try {
    target = new URL(String(url));
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(target.protocol) || target.username || target.password || isPrivateAddress(target.hostname)) return undefined;
  const token = crypto.randomUUID();
  await chrome.storage.session.set({
    [`${CAPTURE_TOKEN_PREFIX}${token}`]: { url: target.href, tabId: tab?.id, pageUrl: tab?.url, expiresAt: Date.now() + CAPTURE_TOKEN_TTL }
  });
  return token;
}

/** The stored capture for this token and URL, or null when it doesn't match or has expired. */
async function capturedPdf(token, url) {
  if (typeof token !== "string" || !token) return null;
  const key = `${CAPTURE_TOKEN_PREFIX}${token}`;
  const stored = (await chrome.storage.session.get(key))[key];
  if (!stored || typeof stored.url !== "string" || typeof stored.expiresAt !== "number") return null;
  if (stored.expiresAt < Date.now()) {
    await chrome.storage.session.remove(key);
    return null;
  }
  return stored.url === String(url) ? stored : null;
}

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
  if (message?.type !== "fetch-pdf" && message?.type !== "resolve-doi-pdf") return false;
  // A credentialed fetch is a powerful capability: refuse anything but our own app's pages.
  if (!trusted(sender)) {
    sendResponse({ ok: false, error: "Not allowed from this page." });
    return false;
  }
  const work = message.type === "resolve-doi-pdf" ? publisherPdfForDoi(message.doi) : fetchCapturedOrTrusted(message);
  work
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
  return true; // async response
});

async function fetchCapturedOrTrusted(message) {
  if (!message.captureToken) return fetchPdf(message.url);
  const capture = await capturedPdf(message.captureToken, message.url);
  if (!capture) throw new Error("That captured PDF link is no longer available.");
  // Ask the article's own tab first: it is the session the user is reading in, so its cookies
  // are first-party and a subscription PDF the page can open is one we can save.
  const fromTab = await fetchPdfInTab(capture).catch(() => null);
  if (fromTab) return fromTab;
  try {
    return await fetchPdf(message.url);
  } catch (error) {
    // Hosts like PMC answer scripted requests with a bot check that a real tab clears by itself.
    // Open the PDF in a background tab once, as Zotero does, then ask again.
    if (!(await clearChallengeInTab(message.url))) throw error;
    return (await fetchPdfInTab(capture).catch(() => null)) ?? fetchPdf(message.url);
  }
}

async function clearChallengeInTab(url) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const current = await chrome.tabs.get(tab.id);
      // Chrome's PDF viewer has taken over, or the page settled somewhere other than a challenge.
      if (current.status === "complete" && !/captcha|challenge|just a moment|checking your browser/i.test(current.title ?? "")) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

async function fetchPdfInTab(capture) {
  if (typeof capture.tabId !== "number" || !capture.pageUrl) return null;
  const tab = await chrome.tabs.get(capture.tabId);
  // An https page can't fetch http:// (arXiv's translator still reports http links).
  const url = tab.url?.startsWith("https:") ? capture.url.replace(/^http:/, "https:") : capture.url;
  if (!tab?.url || new URL(tab.url).origin !== new URL(capture.pageUrl).origin) return null;
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: capture.tabId },
    args: [url, MAX_BYTES],
    func: async (url, maxBytes) => {
      const response = await fetch(url, { credentials: "include", redirect: "follow" });
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) return null;
      const bytes = new Uint8Array(buffer);
      if (!new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-")) return null;
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    }
  });
  return injection?.result ? { base64: injection.result, contentType: "application/pdf" } : null;
}

// Zotero's "Find Available PDF" order: resolve the DOI to the publisher's landing page with the
// browser's own session, and take the PDF the page itself declares (citation_pdf_url).
async function publisherPdfForDoi(doi) {
  const clean = String(doi ?? "").trim();
  if (!/^10\.\d{4,9}\/\S+$/.test(clean)) throw new Error("Not a DOI.");
  const response = await fetch(`https://doi.org/${encodeURIComponent(clean).replace(/%2F/g, "/")}`, { credentials: "include", redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > TRANSLATOR_HTTP_MAX_BYTES) throw new Error("Landing page is too large.");
  const html = new TextDecoder().decode(buffer);
  if (html.slice(0, 1024).includes("%PDF-")) return { base64: toBase64(buffer), contentType: "application/pdf" };
  const meta = html.match(/<meta[^>]+name=["']citation_pdf_url["'][^>]*>/i)?.[0];
  const href = meta?.match(/content=["']([^"']+)["']/i)?.[1];
  if (!href) throw new Error("The publisher page doesn't link a PDF.");
  const pdfUrl = new URL(href.replace(/&amp;/g, "&"), response.url).href;
  return { ...(await fetchPdf(pdfUrl)), url: pdfUrl };
}

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
  const charset = message.responseCharset || /charset=([^;]+)/i.exec(response.headers.get("content-type") || "")?.[1] || "utf-8";
  let text;
  try {
    text = new TextDecoder(charset.trim()).decode(buffer);
  } catch {
    text = new TextDecoder().decode(buffer);
  }
  const headers = [];
  response.headers.forEach((value, name) => headers.push(`${name}: ${value}`));
  return {
    status: response.status,
    statusText: response.statusText,
    responseURL: response.url,
    headers: headers.join("\r\n"),
    responseText: message.binary ? "" : text,
    ...(message.binary ? { base64: toBase64(buffer) } : {})
  };
}
