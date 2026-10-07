# Bibliograph extension (Chrome, Manifest V3)

Save the paper you're reading, with its PDF, to Bibliograph.

## Install (developer mode)

1. Build it for your copy of the app: `npm run build:extension` (setup does this too). It writes
   `apps/extension/dist/`, pointed at the address in `bibliograph.config.json`.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → choose `apps/extension/dist`. (Loading `apps/extension` itself gives a
   version that saves to local test mode, `localhost:5173`.)
4. Pin the extension. In the popup, choose where to save: your app (default) or `localhost:5173`.

## Use

On an article page (arXiv, a journal, PubMed, OpenReview, a PDF tab…), click the extension and then **Save to Bibliograph**. A tab opens on the app's `/capture` page, which:

1. checks your library for duplicates (“✓ Already in library”, or “may already be in your library”);
2. saves the metadata;
3. fetches the PDF through the extension and uploads it to your Drive folder. This works for hosts that block web pages (CORS) and for subscription PDFs your browser can open;
4. links to the new paper.

## How it works

| File | Role |
| --- | --- |
| `extract.js` | Injected into the tab. Reads Highwire `citation_*` tags, Dublin Core, JSON-LD, and arXiv/DOI URL patterns, and detects direct PDF tabs. |
| `popup.html/js` | Shows what was found and opens `/capture#<base64url JSON>`. The hash never reaches a server. |
| `background.js` | Service worker that fetches PDFs (`credentials: "include"`), verifies `%PDF-`, and returns base64. |
| `bridge.js` | Content script on the app's own origins. Relays `window.postMessage` requests (`ping`, `fetch-pdf`) to the background worker. |

The extension never sees Firebase or Google credentials: saving happens in the signed-in web app. Host permission `<all_urls>` is required to fetch PDFs from any publisher.

## Not yet

- Chrome Web Store packaging and a fixed extension ID.
- Zotero translator bundling for pages without standard metadata, and multi-paper pages (search results, tables of contents).
