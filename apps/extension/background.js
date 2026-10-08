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

async function fetchPdf(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error("Only http(s) URLs can be fetched.");
  const response = await fetch(url, { credentials: "include", redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error("PDF is too large.");
  const head = new TextDecoder("latin1").decode(buffer.slice(0, 1024));
  if (!head.includes("%PDF-")) throw new Error("That link didn't return a PDF.");
  return { base64: toBase64(buffer), contentType: "application/pdf" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "fetch-pdf") return false;
  fetchPdf(message.url)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
  return true; // async response
});
