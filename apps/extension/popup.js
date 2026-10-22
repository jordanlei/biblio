// Popup: shows what the background worker read from the current tab, and "Save to Biblio" asks the
// worker to run the same save the right-click menu runs (background.js readTab/saveCapture). The
// web app's /capture page then saves the paper and pulls the PDF through this extension, which
// never holds Firebase or Google credentials.
const $ = (id) => document.getElementById(id);

async function appUrl() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return appUrl || DEFAULT_APP_URL;
}

function summarize(paper) {
  const names = paper.authors.map((a) => {
    const parts = a.split(",").map((part) => part.trim());
    return parts.length > 2 ? `${parts[0]} ${parts.at(-1)}` : parts[0] || a.split(" ").pop();
  });
  const who = names.length > 2 ? `${names[0]} et al.` : names.join(" & ");
  return [who, paper.year, paper.venue].filter(Boolean).join(" · ");
}

function addChip(label) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = label;
  $("chips").append(chip);
}

async function main() {
  const select = $("app");
  const hosted = $("hosted-app");
  // The generated app-url.js supplies this checkout's deployed address.
  if (DEFAULT_APP_URL.startsWith("http://localhost")) hosted.remove();
  else {
    hosted.value = DEFAULT_APP_URL;
    hosted.textContent = DEFAULT_APP_URL.replace(/^https?:\/\//, "");
  }
  select.value = await appUrl();
  select.addEventListener("change", () => chrome.storage.sync.set({ appUrl: select.value }));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let paper = null;
  let captureError = null;
  const read = await chrome.runtime.sendMessage({ type: "read-tab", tabId: tab.id }).catch((error) => ({ ok: false, error: error?.message }));
  if (read?.ok) paper = read.paper ?? null;
  else captureError = new Error(read?.error ?? "No response"); // chrome:// pages, the Web Store, etc.
  $("loading").hidden = true;

  if (!paper?.isPaper || !paper.title) {
    if (captureError) {
      $("none-title").textContent = "Biblio could not read this page.";
      $("none-meta").textContent = "Reload the current Biblio extension from apps/extension (not dist/), then run npm run build:extension and try again.";
      $("none-meta").title = captureError?.message ?? String(captureError);
    }
    $("none").hidden = false;
    $("open").onclick = async () => chrome.tabs.create({ url: `${await appUrl()}/library` });
    $("add").onclick = async () => chrome.tabs.create({ url: `${await appUrl()}/search` });
    return;
  }

  $("found").hidden = false;
  $("title").textContent = paper.title;
  $("meta").textContent = summarize(paper);
  for (const label of [paper.translator, paper.doi && "DOI", paper.arxivId && "arXiv", paper.pmid && "PubMed", paper.pdfUrl && "PDF available"].filter(Boolean)) addChip(label);
  $("save").onclick = async () => {
    const saved = await chrome.runtime.sendMessage({ type: "save-tab", tabId: tab.id }).catch((error) => ({ ok: false, error: error?.message }));
    if (saved?.ok) window.close();
    else $("meta").textContent = `Couldn't save: ${saved?.error ?? "no response"}`;
  };
}

main().catch((error) => {
  $("loading").textContent = `Something went wrong: ${error?.message ?? error}`;
});
