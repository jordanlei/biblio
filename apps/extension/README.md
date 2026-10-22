# Biblio extension (Chrome, Manifest V3)

Save the paper you're reading, with its PDF, to Biblio. Metadata comes from Zotero's own
translators, the same ones the Zotero Connector uses.

## Install (developer mode)

1. Build it for your copy of the app: `npm run build:extension` (setup and deploy do this too).
   It writes `apps/extension/build/`, pointed at the address in `biblio.config.json`.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → choose `apps/extension/build`.
4. Pin the extension.

After pulling changes or editing `biblio.config.json`, run `npm run build:extension` again and
click **Reload** on Biblio's card in `chrome://extensions`. Chrome may warn about developer-mode
extensions when it starts; that is expected for a self-hosted install.

## Use

On an article page (a journal, PubMed, PMC, arXiv, a PDF tab…), click the Biblio button or
right-click the page and choose **Save to Biblio**; both do the same thing. Biblio opens its
capture page in a new tab, which:

1. checks your library for duplicates, and upgrades an existing record (often an arXiv preprint)
   with the publisher's details and PDF;
2. saves the metadata;
3. fetches the PDF through the extension, inside the article's own tab first, so subscription PDFs
   your browser can open (institutional sign-in included) work, and uploads it to your Drive.

If the page has no paper (or Chrome doesn't let extensions read it), the button shows a red "!";
hover it for the reason.

## Layout

| Path | What it is |
| --- | --- |
| `src/background.js` | Service worker. `saveTab()` injects the Zotero runtime plus the translators whose target matches the page (and the import/search translators and dependencies they call), then opens `/capture#<base64url JSON>`; the hash never reaches a server. Fetches PDFs for the app: in the article tab first, then with `credentials: "include"`, retrying once in a background tab when a host answers with a bot check. Resolves a DOI to the publisher's `citation_pdf_url` for "Find PDF". |
| `src/bridge.js` | Content script on the app's own origins. Relays `window.postMessage` requests (`ping`, `fetch-pdf`, `resolve-doi-pdf`) to the worker. |
| `src/zotero-http-adapter.js` | Routes translator HTTP requests through the worker (no CORS), returning what Zotero's XMLHttpRequest code expects. |
| `src/manifest.json`, `src/icons/` | Manifest template (the build adds this copy's origins) and icons. |
| `vendor/zotero/` | Unmodified Zotero Translate runtime, utilities, and every official translator (`translators/VERSION`). |
| `scripts/build.mjs` | `npm run build:extension`: writes `build/` (runtime, one file per translator, translator index, manifest). |
| `scripts/update-translators.mjs` | `npm run update:translators`: pulls the latest zotero/translators and rebuilds. |
| `tests/` | `npm run test:extension` (build checks) and `npm run test:extension:live` (loads `build/` into Chromium and captures every page in `paper-cases.json`, plus the ignored `paper-cases.local.json`, PDFs included; pages that show automated browsers a CAPTCHA are reported, not failed). |

The extension never sees Firebase or Google credentials: saving happens in the signed-in web app.
Host permission `<all_urls>` is required to fetch PDFs from any publisher.

### On Zotero and licensing

Biblio **does not connect to a running Zotero installation** and has no live dependency on Zotero
services. It vendors the official Zotero Translate runtime and all of the official Zotero
translators (`vendor/zotero/translators`, revision in `VERSION`). The source
files are kept unmodified under `vendor/zotero/`; the build wraps them in static factories so
Manifest V3's CSP does not block Zotero's translator sandbox.

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

The extension reads a page **only when you click it**. There is no background scanning and no
`tabs` permission. `activeTab` grants access to the current page at the
moment you click, and nothing else. `<all_urls>` exists solely so the worker can fetch a PDF you
asked for, including from hosts that block ordinary web pages.

## Not yet

- Chrome Web Store packaging and a fixed extension ID.
- Multi-paper pages (search results, tables of contents): the first item is saved.
