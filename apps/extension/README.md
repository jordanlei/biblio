# Biblio extension (Chrome, Manifest V3)

Save the paper you're reading, with its PDF, to Biblio.

## Install (developer mode)

1. Build it for your copy of the app: `npm run build:extension` (setup does this too). It writes
   `apps/extension/dist/`, pointed at the address in `biblio.config.json`.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → choose `apps/extension/dist`. (Loading `apps/extension` itself gives a
   version that saves to local test mode, `localhost:5173`.)
4. Pin the extension. In the popup, choose where to save: your app (default) or `localhost:5173`.

Chrome may warn about unpacked developer-mode extensions when it starts. That is expected for the
self-hosted install path; the extension is generated for your own Biblio copy rather than installed
from the Chrome Web Store.

## Use

On an article page (arXiv, a journal, PubMed, OpenReview, a PDF tab…), the extension button shows a
**SAVE** badge when Biblio can translate the page. Click the extension and then **Save to Biblio**.
A tab opens on the app's `/capture` page, which:

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

### On Zotero

Biblio **never talks to Zotero**: no Zotero API, no `localhost:23119` connector endpoint, no Zotero
runtime, no Zotero data. Biblio reads public metadata standards and writes its own format.

Zotero's *ecosystem* is a good model — small page translators run in priority order — and their
translator repository is CC0. If you port logic from one, rewrite it against the interface above
rather than vendoring Zotero's runtime, and keep the attribution with it. A translator shaped like
`detect(doc, url)` / `extract(doc, url)` is Biblio's own, whatever inspired it.

### Privacy

The extension reads a page **only when you click it**. There is no background scanning, no badge
that probes tabs, and no `tabs` permission. `activeTab` grants access to the current page at the
moment you click, and nothing else. `<all_urls>` exists solely so the worker can fetch a PDF you
asked for, including from hosts that block ordinary web pages.

## Not yet

- Chrome Web Store packaging and a fixed extension ID.
- More bundled translators for pages without standard metadata.
- Multi-paper pages (search results, tables of contents).
