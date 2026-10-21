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
choose **Save to Biblio**, or click the extension button and then **Save to Biblio**. A tab opens
on the app's `/capture` page, where you can choose a collection before saving. That page:

1. checks your library for duplicates (“✓ Already in library”, or “may already be in your library”);
2. saves the metadata;
3. fetches the PDF through the extension and uploads it to your Drive folder. This works for hosts that block web pages (CORS) and for subscription PDFs your browser can open;
4. links to the new paper.

## How it works

| File | Role |
| --- | --- |
| `extract.js` | Injected into the tab. Runs ordered Biblio translators (arXiv, PubMed, OpenReview, DOI pages) before falling back to generic Highwire `citation_*`, Dublin Core, JSON-LD, URL patterns, and direct PDF tabs. |
| `popup.html/js` | Shows what was found and opens `/capture#<base64url JSON>`. The hash never reaches a server. |
| `background.js` | Service worker that detects capturable pages for the toolbar badge and fetches PDFs (`credentials: "include"`), verifies `%PDF-`, and returns base64. |
| `bridge.js` | Content script on the app's own origins. Relays `window.postMessage` requests (`ping`, `fetch-pdf`) to the background worker. |

The extension never sees Firebase or Google credentials: saving happens in the signed-in web app. Host permission `<all_urls>` is required to fetch PDFs from any publisher.

## Biblio Translate

Capture reads a page's own metadata. Publishers already publish it for Google Scholar, so the
extension mostly just reads standard tags:

- **Highwire Press** (`citation_title`, `citation_author`, `citation_doi`, `citation_pdf_url`…) — what
  Google Scholar asks publishers for, and what most journals emit.
- **Dublin Core** (`dc.title`, `dc.creator`), **PRISM**, **EPrints**, and **JSON-LD**
  (`schema.org/ScholarlyArticle`) as fallbacks.
- A few site translators (arXiv, PubMed, OpenReview, DOI pages) for sites whose markup needs help.

These are open web standards, not any one application's format.

| File | Role |
| --- | --- |
| `biblio-translate.js` | The translator registry: `register()`, priority ordering, and normalising a translator's output into Biblio capture JSON. ~60 lines, no network access. |
| `biblio-translators.js` | Bundled translators written against that interface. |
| `extract.js` | Runs Biblio Translate, then the built-in site translators, then the generic metadata translator. Returns the first confident match. |

### On Zotero and licensing

Biblio **never talks to Zotero**: no Zotero API, no `localhost:23119` connector endpoint, no Zotero
runtime, and no live dependency on Zotero services. The PubMed translator is an adapted copy of
Zotero's official `PubMed.js` translator and uses the same PMID detection and NCBI E-utilities
strategy, rewritten for Biblio's small browser-native interface.

The extension is distributed under AGPL-3.0-or-later because of this adapted translator. See
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
