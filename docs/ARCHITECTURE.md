# Architecture

Biblio is a static Vue app talking directly to Firebase (Auth, Firestore) and Google Drive from the browser. There is no application server; two optional Cloud Functions exist for jobs browsers can't do (CORS-blocked fetches).

**The canonical library is a folder of open files in the user's Drive; Firestore is a disposable, fast materialized view.** See [STORAGE.md](STORAGE.md) for the classification, sync model, and rebuild path, and [LIBRARY_FORMAT.md](LIBRARY_FORMAT.md) for the file format.

```text
 ┌──────────── browser ────────────┐        ┌────────── Google ──────────┐
 │ Vue app (apps/web)              │──Auth──▶│ Firebase Auth (Google)     │
 │   session ─ library store ─ UI  │──data──▶│ Firestore users/{uid}/…    │
 │   drive / pdfFetch / lookup     │──PDFs──▶│ Drive (drive.file scope)   │
 │        ▲  window.postMessage    │──meta──▶│ OpenAlex · Crossref ·      │
 │        ▼                        │         │ DataCite (public APIs)     │
 │ Extension bridge.js ⇄ background│──fetch─▶│ any PDF host (cookies ok)  │
 └─────────────────────────────────┘         └────────────────────────────┘
```

## Data model (`packages/core`)

- `Paper` (`users/{uid}/papers/{uuid}`): bibliographic fields with structured `Creator`s, persistent `citationKey`, `tags`, `folderIds`, `notesMarkdown`, `readingStatus` (`inbox | readNext | skimming | reading | read | reference | parked`, plus legacy `tbr | skimmed`), optional `savedBecause`, optional `pdf` (Drive file ID + filename only), `openAccessPdfUrl`, `source`, timestamps.
- `Folder` (`users/{uid}/folders/{uuid}`): `name`, `parentId`. Papers can be in many folders; deleting a folder never deletes papers.
- `ResearchNote` (`users/{uid}/researchNotes/{uuid}`): a freeform Markdown note (title, body, timestamps). Papers are connected by `@[key]` links in the body. Notes stored in the old structured shape (question, saved search, papers with roles) are folded into Markdown on read by `migrateResearchNote` and saved in the new shape on their next edit.
- Profile (`users/{uid}`): Drive folder ID/name, `onboardingCompleted`.
- **One way to make a paper:** every route (search, identifiers, `.bib` import, manual, extension) builds a `PaperCandidate` and calls `buildPaper()`, which allocates a unique citation key and strips `undefined`.
- Citation keys never change automatically. Renaming one offers to rewrite `@[old]` references in all notes (`replaceCitationKey`).
- `parseBibtex()` handles `@string`, `#` concatenation, nested braces, accents/LaTeX (including Zotero's `{\textbackslash}` escapes), `and others`, arXiv `eprint`, month macros. `exportBibtex()` round-trips every paper type (tested).
- `findExistingPaper()`: exact by DOI / Semantic Scholar / arXiv / PMID, probable by title + year + first author.
- `library/format.ts` — the Drive library format (CSL-JSON `library.json`, `biblio.json`, Markdown notes); `library/ports.ts` — `FileStore`, `LibraryView`, `SyncStateStore`; `library/sync.ts` — `SyncEngine`, `readLibrary`, `inspectLibrary`; `library/memoryStore.ts` — in-memory `FileStore` for tests.

## Web app (`apps/web/src`)

### Services

| File | Role |
| --- | --- |
| `firebase.ts` | Firebase init (`ignoreUndefinedProperties`), emulator wiring, the Drive scope. |
| `services/session.ts` | Auth state; publishes the user only after the profile exists (fixes onboarding/reload races). Caches the Google access token for ~50 min in memory + `sessionStorage` (never Firestore) so Drive actions don't re-prompt. |
| `services/library.ts` | The Firestore materialized view: live `onSnapshot` stores for papers, folders, and Research Notes shared by every view; all writes; contextual backlinks; `replaceLibrary()` for rebuilds; the **undo stack**. |
| `adapters/googleDrive.ts` | All Drive REST: `driveRequest` (maps failures to `StorageUnavailableError` / `StorageAuthError`), folders, and `GoogleDriveFileStore` (the core `FileStore` port). |
| `adapters/firestoreSyncState.ts` | Sync bookkeeping in `users/{uid}/sync/library`. |
| `sync/librarySync.ts` | Composition root: wires `SyncEngine` to Drive + Firestore; reactive `syncStatus`; triggers (edits, online, focus); `connectLibraryFolder`, `rebuildFromDrive`, `reconnectDrive`. |
| `services/librarySearch.ts` | Fielded, accent-folded, relevance-scored local search over metadata, notes, tags, citation keys, and saved-because text + highlight segments. |
| `services/scope.ts` | `/library?folder|tag|view` scopes and combinable filters (`pdf`, `notes`, `untagged`, `status`) kept in the URL. |
| `services/lookup.ts` | OpenAlex works/author search (reciprocal-rank fusion of relevance and citation rankings), identifier lookups (Crossref, DataCite, OpenAlex), `author:`/`year:` qualifier parsing. |
| `services/pdfFetch.ts` | Finds OA PDF sources and downloads the first real PDF: direct → extension → `fetchPdf` function. |
| `services/drive.ts` | App-level Drive actions: create/pick the library folder, attach/find/remove PDFs (into `papers/`), links. |
| `services/extensionBridge.ts` | `postMessage` protocol to the extension's content script (ping, fetch-pdf). |
| `services/notes.ts` | Markdown rendering with an inline `@[key]` token, sanitized by DOMPurify. |
| `services/ui.ts` | Toasts, the Add dialog state, list context for prev/next, undo trigger. |
| `services/emulatorHooks.ts` | Local test mode only: programmatic sign-in for Playwright. |

### Views and key components

- `LibraryView` — list, toolbar (search, filters, sort), bulk bar, keyboard model, drag/drop; reserves the preview column so selection never reflows the list.
- `PaperInspector` — preview pane; double-click notes to edit in place.
- `PaperView` — reading layout, notes editor, backlinks, prev/next within the originating list.
- `ResearchNotesView` (`/research-notes/:id?`) — a list of notes and a Markdown editor (the same `NotesEditor` paper notes use, with the `@[` picker), plus the papers the note links. `BacklinkList` shows research notes and paper notes on each paper's page.
- `AddPapersDialog` + `PaperSearch` + `CandidateRow` — all ways in; auto-grabs PDFs after adding.
- `PdfPanel` — Find PDF / drop / replace / unlink vs. delete-from-Drive / missing-file state.
- `GuidedTour` — spotlight tour anchored to `data-tour` attributes; steps whose targets are absent are skipped.
- `CaptureView` (`/capture#…`) — landing page for the extension; dedupe → save → PDF.
- `LoginView` — the only signed-out page: sign in with Google. (What Biblio is lives on the project website.)

### Routing

`router.beforeEach` awaits `sessionReady`, so deep links and reloads resolve auth before rendering. Unauthenticated routes redirect to `/login?next=…` (hash preserved for `/capture`).

## Your own features (`apps/web/src/custom`)

Three registries (`customRoutes`, `customNavItems`, `customPaperPanels`) are read at startup by `router.ts`, `AppSidebar.vue`, and `PaperView.vue`. Upstream never changes that folder, so a fork's own features survive merges. See [EXTENDING.md](EXTENDING.md).

## Project website (`apps/site`)

Three static Vue pages published to GitHub Pages (`.github/workflows/site.yml`): the home page (`src/App.vue`: the model in brief, features, the comparison), How it works (`src/HowItWorksPage.vue`, at `how-it-works/`: Biblio is code, not a service, with the architecture diagram; keep it true to `scripts/setup.mjs` and [STORAGE.md](STORAGE.md)), and the setup tutorial (`src/SetupPage.vue`, served at `setup/`; keep it in step with `scripts/setup.mjs`). Captures of the app (`public/landing/`, made by `scripts/capture-landing.mjs`, see [CAPTURES.md](CAPTURES.md)),. It has no Firebase and no sign-in. Each person's copy of the app (`apps/web`) is deployed separately, to their own Firebase project; see [CONTRIBUTING.md](../CONTRIBUTING.md) for the rules that keep the two apart. It reuses the app's `styles.css`, `AppIcon`, and `BrandMark` by relative import, so the two look the same.

## Running a copy (`scripts/setup.mjs`, `biblio.config.json`)

Each copy of the app is configured by a gitignored `biblio.config.json` read at build time (`apps/web/vite.config.ts`); nothing in the source names a Firebase project. `npm run setup` creates and fills it; `npm run deploy` targets it. See [SELF_HOSTING.md](SELF_HOSTING.md).

## Moving a library (`services/transfer.ts`, core `library/transfer.ts`)

A copy only sees Drive files it created (`drive.file`), so libraries move by copying files: *Download library* zips the library folder (fflate, in the browser); *Import a library* takes that .zip, Google Drive's own folder download (also a .zip, with extra wrapping folders), or an unzipped folder, finds `library.json`, checks it, writes the files into a new folder this copy creates (`library.json` last), and switches to it. *Reconnect* lists library folders this copy made earlier, for when its index was reset.

## Extension (`apps/extension`)

The source points at local test mode; `npm run build:extension` writes `apps/extension/dist/` for this copy's address. The extension never holds Firebase or Google credentials. The popup runs `extract.js` in the tab (Highwire `citation_*`, Dublin Core, JSON-LD, arXiv and DOI URL patterns, direct PDFs) and opens `/capture#<base64url JSON>` in the signed-in app. The app saves the paper, then asks the extension (via `bridge.js` → `background.js`) to fetch the PDF with `credentials: "include"`, which works for CORS-blocked and subscription hosts.

## Testing

- `packages/core/src/core.test.ts` — citation keys, dedupe, BibTeX round-trips for every type, LaTeX/Zotero edge cases, and `samples/sample.bib`.
- `packages/core/src/library.test.ts` — format round-trips, CSL interoperability, folders, shelves, saved-because fields, research notes (files, rename on retitle, hand-written and outside-edited files, migration from the old manifest field), sync: no-op when unchanged, offline queue, outside note edit, conflict copies, rebuild after index loss, adopting an existing library, shrink backup.
- `e2e/ownership.spec.ts` — data-loss (wipe Firestore → reconnect folder → everything back), human-readable Drive contents, offline edits across a reload, outside note edits.
- `scripts/check-boundaries.mjs` — provider-boundary rules (run by `npm test`).
- `e2e/walkthrough.spec.ts` — the new-user journey against emulators + mock Drive: tour + Drive setup, two imports, keyboard delete/undo/status, search qualifiers, folders + drag, a research note that links a paper (file in Drive, backlink on the paper), notes links + contextual backlinks, PDF upload, edit keeps key, deep link, export, delete with PDF, sign-out guard.
- Manual/scripted checks done for this release (see STATUS): live OpenAlex search quality and latency, author mode, PDF grabbing direct (arXiv) and via the loaded extension (NeurIPS), `extract.js` on arXiv, `/capture` save + PDF + duplicate.

### Remaining test gaps

- E2E and capture recording need the Firebase emulator stack, which requires Java 11+ on `PATH`.
- Future tests should cover research note deletion trashing the file (end to end) and rebuild behavior for very large note sets.
