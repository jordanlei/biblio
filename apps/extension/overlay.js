// Dynamically injected into the article page for a Zotero-style in-place capture surface.
// The actual capture and collection flow stays in Biblio, inside the iframe, so Firebase and
// Drive credentials never move into the extension or the page being captured.
(() => {
  const HOST_ID = "__biblio_capture_overlay__";

  function embeddedUrl(url) {
    const hashIndex = url.indexOf("#");
    const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
    return `${base}${base.includes("?") ? "&" : "?"}embed=1${hash}`;
  }

  function close() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;
    host.remove();
    document.removeEventListener("keydown", onKeydown, true);
  }

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  function show(url) {
    const existing = document.getElementById(HOST_ID);
    if (existing) {
      const frame = existing.shadowRoot?.querySelector("iframe");
      if (frame) frame.src = embeddedUrl(url);
      return;
    }

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:auto";
    const shadow = host.attachShadow({ mode: "open" });

    const backdrop = document.createElement("div");
    backdrop.style.cssText = [
      "position:fixed",
      "inset:0",
      "display:grid",
      "place-items:center",
      "padding:clamp(12px, 4vw, 48px)",
      "background:rgba(16, 20, 18, .42)",
      "backdrop-filter:blur(3px)",
      "font-family:Inter, ui-sans-serif, system-ui, sans-serif"
    ].join(";");
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });

    const panel = document.createElement("div");
    panel.style.cssText = [
      "position:relative",
      "width:min(720px, 100%)",
      "height:min(860px, 100%)",
      "overflow:hidden",
      "border:1px solid rgba(32,34,31,.18)",
      "border-radius:16px",
      "background:#f6f4ee",
      "box-shadow:0 28px 80px rgba(20,24,22,.32)"
    ].join(";");

    const frame = document.createElement("iframe");
    frame.title = "Save paper to Biblio";
    frame.src = embeddedUrl(url);
    frame.style.cssText = "display:block;width:100%;height:100%;border:0;background:#f6f4ee";
    frame.setAttribute("allow", "clipboard-read; clipboard-write");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close Biblio overlay");
    closeButton.textContent = "×";
    closeButton.style.cssText = [
      "position:absolute",
      "top:12px",
      "right:12px",
      "z-index:1",
      "width:32px",
      "height:32px",
      "border:1px solid rgba(32,34,31,.16)",
      "border-radius:50%",
      "background:rgba(255,253,248,.92)",
      "color:#20221f",
      "font:24px/26px ui-sans-serif, system-ui, sans-serif",
      "cursor:pointer",
      "box-shadow:0 3px 12px rgba(20,24,22,.12)"
    ].join(";");
    closeButton.addEventListener("click", close);

    panel.append(frame, closeButton);
    backdrop.append(panel);
    shadow.append(backdrop);
    document.documentElement.append(host);
    document.addEventListener("keydown", onKeydown, true);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "show-biblio-overlay" && typeof message.url === "string") show(message.url);
  });
})();
