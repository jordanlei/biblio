# Biblio extension (Chrome, Manifest V3)

Save the paper you're reading, with its PDF, to Biblio.

## Install (developer mode)

1. Build it for your copy of the app: `npm run build:extension` (setup does this too). It writes
   the deployment-specific `manifest.json` and `app-url.js` files in this folder, pointed at the
   address in `biblio.config.json`.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → choose `apps/extension`.
4. Pin the extension. In the popup, choose where to save: your app (default) or `localhost:5173`.

There is no `dist/` extension to load. If the popup says it could not read a page, remove the old
unpacked Biblio entry, run `npm run build:extension`, and load this exact folder: `apps/extension`.

There is one extension folder and one copy of its code. `config/manifest.template.json` is the
checked-in manifest template; `manifest.json` and `app-url.js` are generated and gitignored because
they contain this checkout's deployment address. Re-run `npm run build:extension` after changing
`biblio.config.json`, then click **Reload** on Biblio's card in `chrome://extensions`.

Chrome may warn about unpacked developer-mode extensions when it starts. That is expected for the
self-hosted install path; the extension is generated for your own Biblio copy rather than installed
from the Chrome Web Store.

## Use

On an article page (arXiv, a journal, PubMed, OpenReview, a PDF tab…), right-click the page and
choose **Save to Biblio**, or click the extension button and then **Save to Biblio**. Biblio opens
its capture page in a new tab, where you can choose a collection before saving. The capture page:

1. checks your library for duplicates (“✓ Already in library”, or “may already be in your library”);
2. saves the metadata;
3. fetches the PDF through the extension and uploads it to your Drive folder. This works for hosts that block web pages (CORS) and for subscription PDFs your browser can open;
4. links to the new paper.

## How it works

| File | Role |
| --- | --- |
| `zotero-runtime.js`, `zotero-translators/`, `zotero-capture.js` | Generated from the vendored Zotero Translate runtime and **every** official Zotero translator (one file each). Like the Zotero Connector, the worker injects the translators whose target matches the page, plus the import/search translators and anything they call, and Zotero picks the best one. Biblio has no site or author parser of its own. |
| `popup.html/js` | Shows what the worker read from the tab. **Save to Biblio** asks the worker to save, so it is the same action as the right-click menu item. |
| `tests/live.mjs` | `npm run test:extension:live`: loads this extension into Chromium and captures every page in `tests/paper-cases.json` (plus the ignored `paper-cases.local.json`), PDFs included. Pages that show automated browsers a CAPTCHA are reported, not failed. |
| `background.js` | Service worker. `readTab()` runs the translators and `saveCapture()` opens `/capture#<base64url JSON>` (the hash never reaches a server); the popup and the context menu both call these two. It fetches PDFs: a captured publisher PDF is fetched **inside the article tab first**, using the browser session you're reading in (institutional access included, independent of your Biblio sign-in), then by the worker with `credentials: "include"`. For "Find PDF" it resolves a DOI to the publisher page and takes its `citation_pdf_url`, which is Zotero's publisher-first order. |
| `bridge.js` | Content script on the app's own origins. Relays `window.postMessage` requests (`ping`, `fetch-pdf`, `resolve-doi-pdf`) to the background worker. |

The extension never sees Firebase or Google credentials: saving happens in the signed-in web app. Host permission `<all_urls>` is required to fetch PDFs from any publisher.

### On Zotero and licensing

Biblio **does not connect to a running Zotero installation** and has no live dependency on Zotero
services. It vendors the official Zotero Translate runtime and all of the official Zotero
translators (`vendor/zotero/translators`, revision in `VERSION`). The source
files are preserved under `vendor/zotero/`; the build wraps them in static factories so Manifest
V3's CSP does not block Zotero's translator sandbox.

Cross-origin requests made by those translators go through Biblio's extension worker, preserving
the translator request behavior while avoiding publisher CORS failures. If no official bundled
translator detects the page, Biblio fails closed rather than guessing an author name.

To pick up Zotero's latest translator fixes, run `npm run update:translators` and reload the
extension.

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
- Multi-paper pages (search results, tables of contents).
