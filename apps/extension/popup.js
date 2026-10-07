// Popup: read the current tab's metadata (extract.js), then hand it to the web app's /capture page,
// which is signed in, checks for duplicates, saves the paper, and pulls the PDF through this
// extension. The extension itself never holds Firebase or Google credentials.
const $ = (id) => document.getElementById(id);

async function appUrl() {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return appUrl || DEFAULT_APP_URL;
}

function encode(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function summarize(paper) {
  const names = paper.authors.map((a) => (a.includes(",") ? a.split(",")[0] : a.split(" ").pop()));
  const who = names.length > 2 ? `${names[0]} et al.` : names.join(" & ");
  return [who, paper.year, paper.venue].filter(Boolean).join(" · ");
}

async function main() {
  const select = $("app");
  const hosted = $("hosted-app");
  // A build for a deployed copy adds its address; the source build only knows local test mode.
  if (DEFAULT_APP_URL.startsWith("http://localhost")) hosted.remove();
  else {
    hosted.value = DEFAULT_APP_URL;
    hosted.textContent = DEFAULT_APP_URL.replace(/^https?:\/\//, "");
  }
  select.value = await appUrl();
  select.addEventListener("change", () => chrome.storage.sync.set({ appUrl: select.value }));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let paper = null;
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["extract.js"] });
    paper = injection?.result ?? null;
  } catch {
    paper = null; // chrome:// pages, the Web Store, etc.
  }
  $("loading").hidden = true;

  if (!paper?.isPaper || !paper.title) {
    $("none").hidden = false;
    $("open").onclick = async () => chrome.tabs.create({ url: `${await appUrl()}/library` });
    $("add").onclick = async () => chrome.tabs.create({ url: `${await appUrl()}/search` });
    return;
  }

  $("found").hidden = false;
  $("title").textContent = paper.title;
  $("meta").textContent = summarize(paper);
  for (const label of [paper.doi && "DOI", paper.arxivId && "arXiv", paper.pdfUrl && "PDF available"].filter(Boolean)) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = label;
    $("chips").append(chip);
  }
  $("save").onclick = async () => {
    // The hash never reaches a server; the app reads it client-side.
    await chrome.tabs.create({ url: `${await appUrl()}/capture#${encode(paper)}` });
    window.close();
  };
}

main().catch((error) => {
  $("loading").textContent = `Something went wrong: ${error?.message ?? error}`;
});
