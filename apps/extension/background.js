// Fetches PDFs for the Biblio web app (via bridge.js). Extensions with host permissions aren't
// bound by CORS, and `credentials: "include"` lets institutional/subscription access work too.
//
// This worker never looks at pages on its own: metadata is only ever read when you click the
// extension (popup.js injects the translators into the active tab then, and only then).
const MAX_BYTES = 80 * 1024 * 1024;

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

/** Only this extension's own content scripts, running on a page the manifest allows. */
function trusted(sender) {
  if (sender?.id !== chrome.runtime.id) return false;
  const origin = sender.origin || (sender.url ? new URL(sender.url).origin : "");
  const allowed = chrome.runtime.getManifest().content_scripts.flatMap((entry) => entry.matches);
  return allowed.some((pattern) => {
    const [scheme, rest] = pattern.split("://");
    const host = rest.replace(/\/.*$/, "");
    return origin === `${scheme}://${host}`;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
