# Biblio extension (Chrome, Manifest V3)

Save the paper you're reading, with its PDF, to Biblio.

## Install (developer mode)

1. Build it for your copy of the app: `npm run build:extension` (setup does this too). It writes
   the deployment-specific `manifest.json` and `app-url.js` files in this folder, pointed at the
   address in `biblio.config.json`.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → choose `apps/extension`.
4. Pin the extension. In the popup, choose where to save: your app (default) or `localhost:5173`.

There is one extension folder and one copy of its code. `config/manifest.template.json` is the
checked-in manifest template; `manifest.json` and `app-url.js` are generated and gitignored because
they contain this checkout's deployment address. Re-run `npm run build:extension` after changing
`biblio.config.json`, then click **Reload** on Biblio's card in `chrome://extensions`.

Chrome may warn about unpacked developer-mode extensions when it starts. That is expected for the
self-hosted install path; the extension is generated for your own Biblio copy rather than installed
from the Chrome Web Store.

## Use

On an article page (arXiv, a journal, PubMed, OpenReview, a PDF tab…), right-click the page and
choose **Save to Biblio**, or click the extension button and then **Save to Biblio**. An in-page
overlay opens over the article, where you can choose a collection before saving. The
original article stays visible underneath; the embedded app surface:

1. checks your library for duplicates (“✓ Already in library”, or “may already be in your library”);
2. saves the metadata;
3. fetches the PDF through the extension and uploads it to your Drive folder. This works for hosts that block web pages (CORS) and for subscription PDFs your browser can open;
4. links to the new paper.

## How it works

| File | Role |
| --- | --- |
| `zotero-capture.js` | Generated from the vendored Zotero Translate runtime and official translators. It detects and translates the active page without a Biblio-owned author or site parser. |
| `popup.html/js` | Shows what was found and opens the in-page Biblio overlay. The capture hash never reaches a server. |
| `overlay.js` | Dynamically injected into the current article page to render the embedded Biblio capture surface. |
| `background.js` | Service worker that detects capturable pages for the toolbar badge and fetches PDFs (`credentials: "include"`), verifies `%PDF-`, and returns base64. |
| `bridge.js` | Content script on the app's own origins. Relays `window.postMessage` requests (`ping`, `fetch-pdf`) to the background worker. |

The extension never sees Firebase or Google credentials: saving happens in the signed-in web app. Host permission `<all_urls>` is required to fetch PDFs from any publisher.

### On Zotero and licensing

Biblio **does not connect to a running Zotero installation** and has no live dependency on Zotero
services. It vendors the official Zotero Translate runtime and the official PubMed, PubMed XML,
Nature Publishing Group, Springer Link, Embedded Metadata, RDF, and RIS translators. The source
files are preserved under `vendor/zotero/`; the build wraps them in static factories so Manifest
V3's CSP does not block Zotero's translator sandbox.

Cross-origin requests made by those translators go through Biblio's extension worker, preserving
the translator request behavior while avoiding publisher CORS failures. If no official bundled
translator detects the page, Biblio fails closed rather than guessing an author name.

The extension is distributed under AGPL-3.0-or-later because of these vendored translators and
runtime. See
`LICENSE` and `THIRD_PARTY_NOTICES.md` for the license and attribution. The web app outside
`apps/extension` remains MIT-licensed.

### Privacy

The extension reads a page **only when you click it**. There is no background scanning, no badge
that probes tabs, and no `tabs` permission. `activeTab` grants access to the current page at the
moment you click, and nothing else. `<all_urls>` exists solely so the worker can fetch a PDF you
asked for, including from hosts that block ordinary web pages.

## Not yet

- Chrome Web Store packaging and a fixed extension ID.
- More bundled translators for pages without standard metadata.
- Multi-paper pages (search results, tables of contents).
