// Runs on Bibliograph's own pages. Relays window.postMessage requests from the web app to the
// extension's background worker and posts the answers back. Only same-window messages from the app
// are accepted.
(() => {
  const APP = "bibliograph-app";
  const EXTENSION = "bibliograph-extension";
  const version = chrome.runtime.getManifest().version;
  const reply = (data) => window.postMessage({ source: EXTENSION, version, ...data }, window.location.origin);

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== window || data?.source !== APP) return;
    if (data.type === "ping") return reply({ type: "pong", id: data.id });
    if (data.type === "fetch-pdf") {
      chrome.runtime.sendMessage({ type: "fetch-pdf", url: data.url }, (response) => {
        const error = chrome.runtime.lastError?.message;
        reply({ type: "fetch-pdf-result", id: data.id, ...(response ?? { ok: false, error: error ?? "No response" }) });
      });
    }
  });

  reply({ type: "hello" });
})();
