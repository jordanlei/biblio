# Build Brief: Browser-Native Personal Research Library

## 1. Product goal

Build a lightweight, browser-first research-paper library.

This is **not** a Zotero clone. Do not implement word-processor citation insertion, PDF annotation, collaborative editing, cloud PDF storage, citation-style rendering, or a desktop application.

The application should do one job extremely well:

> Capture papers from the web or external sources, store their biblioic metadata and personal organization in Firestore, store their PDFs exclusively in the user's Google Drive, make the library fast to browse/search/organize, allow Markdown notes with links between papers, and export the library as `references.bib`.

The initial implementation is single-user/private, but the database must be user-scoped so that multi-user support does not require a rewrite.

The user's data must remain portable. Firestore is the operational database, Google Drive owns PDFs, and BibTeX/JSON exports provide escape hatches.

---

# 2. Required technology

Use:

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia only if global state becomes useful; do not introduce it unnecessarily
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Google Drive API v3
- Chrome Manifest V3 extension
- Zotero's open-source translator infrastructure for webpage metadata extraction where practical
- Semantic Scholar Academic Graph API
- Markdown rendering library with sanitization
- Vitest for unit tests
- Playwright for browser/end-to-end tests

Do **not** use Firebase Storage. PDFs must never be stored there.

Do not introduce a conventional application server unless required for secrets or operations that cannot safely happen client-side. Firebase Cloud Functions are acceptable for narrowly defined server-side operations.

Firebase Hosting supports static SPA deployment and rewrites to `index.html`, making it appropriate for the Vite build. [Firebase](https://firebase.google.com/docs/hosting/full-config?hl=en\&utm_source=chatgpt.com)

## Reuse and plugin policy

Prefer proven open-source packages and existing APIs where they reduce risky custom code:

- Use Firebase client SDKs for Auth and Firestore rather than custom auth/session code.
- Use the narrow `drive.file` scope (no "unverified app" warning). A copy sees only files it created; libraries move between copies by .zip export/import, never by opening another copy's files.
- Use Citation.js or a similarly maintained biblioic library for BibTeX/CSL parsing and export once the canonical data model is stable.
- Use Zotero Translate and bundled Zotero translators behind `extractFromCurrentPage()` rather than writing publisher-specific parsers.

Security constraints for dependencies and plugins:

- Do not add services that store user paper metadata, Drive file IDs, notes, email addresses, or account identifiers outside the user's Firebase project and Google Drive.
- Do not ship private API keys in the Vite app or extension.
- Do not add telemetry, analytics, crash reporting, or hosted search by default.
- Do not grant broad OAuth scopes when a narrower scope works.
- Lock dependency versions through `package-lock.json`, review transitive packages before release, and document any package that handles user metadata.

---

# 3. Repository structure

Use one repository:

```text
/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   └── ...
│   │
│   └── extension/
│       ├── src/
│       ├── manifest.json
│       └── ...
│
├── packages/
│   ├── core/
│   │   ├── types/
│   │   ├── citation-key/
│   │   ├── normalization/
│   │   ├── bibtex/
│   │   ├── markdown/
│   │   └── deduplication/
│   │
│   └── zotero-translate/
│
├── functions/
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── package.json
```

Critical rule:

**The web app, extension, Zotero importer, and Semantic Scholar importer must all use the same normalization and paper-creation code.**

There must not be four subtly different ways to construct a `Paper`.

---

# 4. Authentication and onboarding

## First visit

Unauthenticated users see only:

**Continue with Google**

Use Firebase Authentication with Google.

Firebase officially supports Google authentication on the web. [Firebase](https://firebase.google.com/docs/auth/web/google-signin?utm_source=chatgpt.com)

After authentication, check whether the user's application profile exists.

Create:

```text
/users/{uid}
```

containing:

```ts
interface UserProfile {
  email: string;
  displayName: string | null;
  photoURL: string | null;

  driveConnected: boolean;
  driveRootFolderId: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Drive connection

Authentication and Drive authorization are separate concepts.

After first login, show onboarding:

> Choose Google Drive folder  
> PDFs will be stored directly in your Google Drive. This app does not host copies of your PDFs.

Request the narrow:

`drive.file`

scope.

Google recommends `drive.file` for applications that create/manage files the user has opened with or shared with the application; it is a non-sensitive scope and avoids blanket access to the user's Drive. [Google for Developers](https://developers.google.com/workspace/drive/api/guides/api-specific-auth?utm_source=chatgpt.com)

Do not request unrestricted Drive access.

On successful connection, let the user choose or create the folder that will own app-managed PDFs. Use the Google Picker or a Drive folder-selection flow compatible with `drive.file`. If the user creates a new folder, create it in the visible `drive` space, not `appDataFolder`. `appDataFolder` is hidden application data and is inappropriate for PDFs the user should own and see. [Google for Developers](https://developers.google.com/workspace/drive/api/guides/about-files?utm_source=chatgpt.com)

Suggested folder name when creating a new folder:

```text
Research Library/
```

Store the chosen Drive folder ID in the user profile.

---

# 5. Fundamental storage rule

There are two independent objects:

**Biblioic record → Firestore**

**PDF file → Google Drive**

A paper does not require a PDF.

Never infer paper existence from Drive contents.

Never upload PDFs to Firebase Storage, Firestore, Firebase Hosting, or another application-controlled file store.

Firestore stores only the Drive identifier and relevant attachment metadata.

---

# 6. Firestore data model

Use user-scoped collections.

## Papers

```text
/users/{uid}/papers/{paperId}
```

Use an application-generated UUID for `paperId`.

Do **not** use DOI or citation key as the Firestore document ID because either can be missing or changed.

Use approximately:

```ts
interface Paper {
  id: string;

  // Stable human-facing identifier
  citationKey: string;

  // Biblioic type
  type:
    | "article"
    | "conferencePaper"
    | "preprint"
    | "book"
    | "bookChapter"
    | "thesis"
    | "report"
    | "other";

  title: string;

  authors: Creator[];
  editors?: Creator[];

  issued?: {
    year?: number;
    month?: number;
    day?: number;
    raw?: string;
  };

  containerTitle?: string;
  shortContainerTitle?: string;

  volume?: string;
  issue?: string;
  pages?: string;

  publisher?: string;
  publisherPlace?: string;

  edition?: string;

  doi?: string;
  arxivId?: string;
  pmid?: string;
  semanticScholarId?: string;

  issn?: string[];
  isbn?: string[];

  url?: string;
  abstract?: string;

  language?: string;

  // User data
  tags: string[];
  notesMarkdown: string;

  // PDF
  pdf?: {
    driveFileId: string;
    filename: string;
    mimeType: "application/pdf";
    sourceUrl?: string;
    addedAt: Timestamp;
  };

  // Import provenance
  source:
    | "extension"
    | "semantic-scholar"
    | "zotero"
    | "manual";

  sourceIdentifiers?: {
    zoteroKey?: string;
    semanticScholarId?: string;
  };

  rawImportData?: unknown;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Creators:

```ts
interface Creator {
  given?: string;
  family?: string;
  literal?: string;
  orcid?: string;
}
```

Do not collapse author names into a single string.

---

# 7. Citation keys

Citation keys are **first-class persistent data**.

They are not dynamically computed whenever BibTeX is exported.

Use a Better-BibTeX-like default pattern:

```text
firstAuthor + shortTitle + year
```

For example:

```text
vaswaniAttentionNeed2017
```

Better BibTeX itself defaults to an author + short-title + year style and emphasizes that citation keys need to be stable because they become references from other systems. [Retorque](https://retorque.re/zotero-better-bibtex/citing/?utm_source=chatgpt.com)

Normalize generated keys to safe ASCII.

If collision:

```text
smithPlanning2024
smithPlanning2024a
smithPlanning2024b
```

Once assigned, **do not automatically change a citation key when metadata changes.**

The user may manually edit the citation key.

Citation-key uniqueness must be enforced per user.

Use a Firestore transaction when allocating keys so simultaneous additions cannot receive the same key. Firestore transactions provide atomic read/write behavior and retry on conflicting concurrent modifications. [Firebase](https://firebase.google.com/docs/firestore/manage-data/transactions?utm_source=chatgpt.com)

---

# 8. Paper-to-paper Markdown links

Notes are stored as raw Markdown:

```text
notesMarkdown: "This extends @[vaswaniAttentionNeed2017]..."
```

Implement custom syntax:

```text
@[citationKey]
```

During Markdown rendering, resolve this against the current user's papers.

Render it as a clickable paper reference.

For example:

```text
@[vaswaniAttentionNeed2017]
```

renders visually as something like:

**Vaswani et al. (2017)**

and links internally to:

```text
/paper/{paperId}
```

If the key doesn't exist, render it as an obvious unresolved reference without breaking Markdown rendering.

Do not replace the stored Markdown with IDs. Store exactly:

```text
@[vaswaniAttentionNeed2017]
```

This preserves human readability and portability.

When editing notes, autocomplete after typing:

```text
@[
```

Search citation key, title and authors.

Selecting a result inserts:

```text
@[key]
```

Changing a paper's citation key must warn:

> This key is referenced by 7 notes. Update those references?

If confirmed, update all affected notes.

Markdown HTML output must be sanitized before insertion into the DOM.

---

# 9. Folders and subfolders

Call these **Folders** in the UI.

Firestore:

```text
/users/{uid}/folders/{folderId}
```

Schema:

```ts
interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Paper membership must allow one paper to appear in multiple folders.

Use either a `folderIds: string[]` field on Paper for v1 or a membership collection if scale requires it later.

For the private v1, use:

```text
folderIds: string[]
```

Folders can nest arbitrarily.

Deleting a folder must **not delete papers**.

Prompt:

> Delete folder “Planning”? Papers inside it will remain in your library.

Children should either be recursively deleted as folders or explicitly moved upward. For v1, recursively delete the folder structure while retaining every paper.

---

# 10. Main library UI

The authenticated root route is:

```text
/library
```

It must render quickly.

Show:

- title
- first author / author summary
- year
- venue
- tags
- PDF availability
- folders
- citation key

Provide:

- full-text client-side search for normal personal-library scale
- sort by date added
- sort by publication year
- sort by author
- sort by title
- tag filtering
- folder filtering
- PDF/no-PDF filtering

Do not require a server round trip after the relevant library data has loaded.

Clicking a paper opens:

```text
/paper/{paperId}
```

---

# 11. Paper view

Show editable:

- title
- authors
- publication date
- type
- venue
- volume
- issue
- pages
- publisher
- DOI
- arXiv
- PMID
- URL
- citation key
- tags
- folders
- Markdown notes

Provide actions:

**Open PDF**  
**Replace PDF**  
**Download PDF**  
**Edit metadata**  
**Delete paper**  
**Export BibTeX**

Google Drive supports downloading blob files such as PDFs through `files.get(...?alt=media)` and browser download through `webContentLink`. [Google for Developers](https://developers.google.com/workspace/drive/api/guides/manage-downloads?utm_source=chatgpt.com)

---

# 12. Adding a paper manually

Provide:

```text
+ Add Paper
```

Options:

- Search Semantic Scholar
- Add DOI/arXiv/PMID/URL
- Add manually
- Import PDF

Manual addition must require only:

```text
Title
```

Everything else is optional.

Do not artificially require DOI, year, author, or PDF.

---

# 13. Semantic Scholar integration

Add `/search`.

Use Semantic Scholar Academic Graph API.

Search:

```text
GET /graph/v1/paper/search
```

Request sufficient fields to populate the canonical Paper model, including where available:

```text
paperId
title
authors
year
publicationDate
venue
externalIds
abstract
url
openAccessPdf
publicationTypes
journal
```

Semantic Scholar's Graph API supports paper search and allows callers to explicitly request fields; its records expose identifiers and other paper metadata. [Semantic Scholar](https://api.semanticscholar.org/api-docs/graphs?utm_source=chatgpt.com)

Search results show:

```text
Title
Authors
Venue · Year
Abstract snippet

[Add]
```

If already present, show:

```text
✓ In Library
```

Deduplicate using the rules below.

When **Add** is clicked:

1. Fetch full Semantic Scholar record.
2. Normalize it into canonical Paper.
3. Check duplicates.
4. Generate stable citation key.
5. Write Firestore Paper.
6. If `openAccessPdf` exists, offer:

   **Save available PDF to Drive**

Do not assume Semantic Scholar's PDF URL can always be downloaded or redistributed. Only upload when access succeeds legitimately.

### API secret

Semantic Scholar says many endpoints work without authentication, but recommends an API key and explicitly says not to share private API keys. Therefore, if using an API key, **never ship it in the Vite bundle or Chrome extension.** Proxy authenticated Semantic Scholar requests through a Firebase Cloud Function. [Semantic Scholar](https://webflow.semanticscholar.org/product/api?utm_source=chatgpt.com)

---

# 14. Deduplication

Every ingestion route must call:

```ts
findExistingPaper(candidate)
```

Priority:

1. normalized DOI exact match
2. Semantic Scholar ID exact match
3. arXiv ID exact match
4. PMID exact match
5. ISBN + chapter/title where applicable
6. normalized title + publication year + first author

Do not silently merge solely from fuzzy title similarity.

If probable duplicate:

> This may already be in your library.

Show both records and allow:

**Use existing** / **Add anyway**

DOI normalization must remove:

```text
https://doi.org/
http://doi.org/
doi:
```

and compare case-insensitively.

---

# 15. PDF upload

All ingestion routes should eventually call the same:

```ts
attachPdf(paperId, pdfBlob, sourceUrl?)
```

Process:

1. Validate MIME/content as PDF.
2. Generate filename.
3. Upload into the user's Research Library Drive folder.
4. Obtain Drive file ID.
5. Update Firestore Paper.
6. Only report success after both operations succeed.

Google Drive provides multipart and resumable upload mechanisms. Use resumable uploads for robustness. [Google for Developers](https://developers.google.com/workspace/drive/api/guides/create-file?utm_source=chatgpt.com)

Suggested filename:

```text
{citationKey}.pdf
```

Example:

```text
vaswaniAttentionNeed2017.pdf
```

If citation key later changes, **do not automatically rename the Drive file**. Provide explicit rename behavior if desired later.

---

# 16. Deleting papers

Deleting a paper has two possible meanings.

Prompt:

> Delete this paper from your library?

Options:

**Delete metadata only**  
**Delete metadata and PDF**

Metadata-only:

- delete Firestore record
- leave Drive PDF untouched

Metadata + PDF:

1. delete Drive file
2. delete Firestore record

If Drive deletion fails, do not pretend the PDF was deleted.

Warn about incoming `@[key]` links:

> 4 notes reference this paper. Those links will become unresolved.

Do not silently modify those notes.

---

# 17. Chrome extension

Build a Manifest V3 extension.

During development, install it with Chrome's **Load unpacked** developer workflow. Production distribution can later use the Chrome Web Store.

Use:

- service worker
- content scripts
- popup
- `chrome.storage`
- only required host permissions

Manifest V3 separates normal permissions from host permissions. [Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/manifest?hl=en\&utm_source=chatgpt.com)

Use `chrome.storage`, not webpage `localStorage`, for extension-specific state. Chrome explicitly recommends its extension storage API and notes that service workers cannot use normal Web Storage. [Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies?utm_source=chatgpt.com)

## Extension states

When clicked:

### Unsupported page

```text
No paper detected.

[Open manual add]
```

### Paper detected

```text
Attention Is All You Need
Vaswani et al. · 2017

[Save to Library]
```

### Already saved

```text
✓ Already in library

[Open in Library]
```

### Saving

```text
Saving metadata...
Saving PDF to Drive...
```

### Saved

```text
✓ Saved

PDF saved to Drive
[Open Paper]
```

PDF line should only appear if PDF actually succeeded.

---

# 18. Extension extraction

Do not build hundreds of publisher parsers yourself.

Use Zotero's open-source translator architecture as the basis for webpage detection/extraction.

Zotero currently maintains 600+ translators covering major publishers, databases and library systems. [GitHub](https://github.com/zotero/zotero-docs/blob/main/content/translators.md?utm_source=chatgpt.com)

Zotero Translate is specifically a standalone browser translation architecture. However, it is **not plug-and-play**: consumers must implement translator lookup, HTTP, item saving, schema initialization and related interfaces. Zotero also instructs consumers to bundle translators and schema rather than remotely loading them. [GitHub](https://github.com/zotero/translate?utm_source=chatgpt.com)

Therefore create an adapter:

```ts
extractFromCurrentPage(): Promise<ExtractedPaper[]>
```

Everything Zotero-specific stays behind this interface.

Output canonical candidates, not Zotero objects.

For pages containing multiple papers, show a selection UI.

### Licensing

Before distributing the extension publicly, perform an explicit license review of the Zotero components/translators being bundled and comply with their licenses. Zotero's translator documentation discusses AGPL-compatible licensing for contributed translators. [GitHub](https://github.com/zotero/zotero-docs/blob/main/content/dev/translators.md?utm_source=chatgpt.com)

Do not postpone this until after public release.

---

# 19. Extension authentication

Do not invent an insecure mechanism for passing Firebase credentials from the webpage.

Firebase officially documents Manifest V3 extension authentication. Its extension SDK supports `firebase/auth/web-extension`; federated Google popup flows require additional handling using an offscreen document. [Firebase](https://firebase.google.com/docs/auth/web/chrome-extension?utm_source=chatgpt.com)

Implement extension auth according to that supported flow.

The extension and web app must ultimately resolve to the same Firebase UID.

After authentication:

```text
extension Firebase UID === web Firebase UID
```

must hold.

Never store Google passwords, Firebase passwords, or long-lived plaintext secrets in extension storage.

---

# 20. Zotero import

For v1, **do not implement permanent Zotero synchronization**.

Implement migration/import.

Support at minimum:

1. Zotero JSON
2. BibTeX

Prefer Zotero JSON because it preserves richer Zotero metadata. Zotero supports JSON-based API records and numerous biblioic export formats, including BibTeX, BibLaTeX, CSL JSON and RIS. [Zotero](https://www.zotero.org/support/dev/web_api/v3/basics?utm_source=chatgpt.com)

Import flow:

```text
Settings
→ Import Library
→ Zotero
→ Choose exported file
→ Parse
→ Preview
→ Import
```

Preview:

```text
1,842 items found

1,721 new
104 possible duplicates
17 unsupported

[Import]
```

Map:

- Zotero biblioic metadata → Paper
- Zotero tags → tags
- Zotero collections → folders
- nested Zotero collections → nested folders
- Zotero notes → Markdown/plain text where reasonably convertible

Do **not** import Zotero PDF attachments into Firebase.

For initial v1, either:

- leave imported papers without Drive PDFs, or
- provide a separate explicit PDF migration workflow.

Do not make Zotero attachment migration a prerequisite for importing metadata.

Preserve original Zotero item key in:

```ts
sourceIdentifiers.zoteroKey
```

If Better BibTeX citation keys are present in the export, preserve them as `citationKey` where possible rather than regenerating them.

Resolve collisions interactively/deterministically.

---

# 21. BibTeX export

The application must support:

**Export selected papers**

and:

**Export entire library**

Filename must default to:

```text
references.bib
```

Every entry uses the persistent `citationKey`:

```bibtex
@article{vaswaniAttentionNeed2017,
  ...
}
```

Map canonical Paper types to appropriate BibTeX types.

Properly escape BibTeX-sensitive characters.

Never include:

- Firebase IDs
- Firebase URLs
- Google OAuth tokens
- Drive access tokens
- internal application state

Drive file IDs should not be exported by default.

Notes should not be exported by default.

Tags may optionally become BibTeX `keywords`.

Add round-trip tests:

```text
Paper → BibTeX → parser → equivalent biblioic metadata
```

for every supported paper type.

---

# 22. Editing behavior

Every Paper field must be editable.

Do not automatically overwrite user edits with newly fetched metadata.

Treat the current Firestore Paper as authoritative after creation.

Future enrichment from Semantic Scholar/Zotero should produce a proposed change, not silently replace metadata.

Keep `rawImportData` only for debugging/provenance; application behavior must not depend on it.

---

# 23. Firestore security

Every private document must live underneath:

```text
/users/{uid}/...
```

Rules must enforce:

```text
request.auth != null
&& request.auth.uid == uid
```

No authenticated user may read another user's library.

No unauthenticated user may read any paper metadata.

Test rules using Firebase Emulator Suite before deployment.

Firebase supports using Authentication information in Firestore rules for user-specific access control. [Firebase](https://firebase.google.com/docs/firestore/manage-data/transactions?utm_source=chatgpt.com)

---

# 24. Required user journey

The complete happy path must work as follows.

### New user

1. Visit app.
2. Click Continue with Google.
3. Authenticate.
4. Connect Google Drive.
5. App creates Research Library Drive folder.
6. Empty library appears.

### Save from Semantic Scholar

1. Search from application.
2. Find paper.
3. Click Add.
4. Metadata appears immediately in library.
5. If an accessible PDF exists, offer/save it to Drive.
6. Paper opens normally.

### Save from publisher

1. Browse to supported paper page.
2. Click extension.
3. Extension detects metadata.
4. Click Save.
5. Duplicate check occurs.
6. Metadata enters Firestore.
7. PDF is saved to Drive when available.
8. Extension reports success.
9. Clicking Open Paper opens web UI.

### Add notes

1. Open paper.
2. Enter Markdown.
3. Type `@[`.
4. Select another paper.
5. Save.
6. Rendered note contains clickable reference.
7. Clicking it opens referenced paper.

### Organize

1. Create folder.
2. Create subfolder.
3. Add paper to folder.
4. Navigate folder.
5. Delete folder.
6. Paper remains in library.

### Export

1. Select Export Library.
2. Browser downloads `references.bib`.
3. Every paper has its stable citation key.

### Migration

1. Export Zotero library.
2. Open Import.
3. Upload Zotero export.
4. Preview import.
5. Resolve duplicates if necessary.
6. Import.
7. Existing citation keys are preserved where available.
8. Collections become folders.
9. Library is usable without Zotero afterward.

---

# 25. Required automated tests

Do not consider the project complete merely because the happy path works manually.

## Citation-key unit tests

Test:

- one author
- two authors
- no author
- organization author
- missing year
- Unicode names
- punctuation
- accented characters
- duplicate keys
- three simultaneous collisions
- manually fixed key
- metadata edited after key creation
- imported Better BibTeX key

Critical assertion:

> Editing title/author/year must not change an existing citation key automatically.

---

## Normalization tests

Provide fixtures from:

- Semantic Scholar
- Zotero JSON
- extension/Zotero translator
- manual entry

All should normalize into the same canonical Paper representation.

Test DOI normalization.

Test arXiv normalization.

Test creator names.

Test incomplete dates.

Test missing metadata.

---

## Deduplication tests

Test:

- same DOI → duplicate
- DOI URL vs bare DOI → duplicate
- same arXiv → duplicate
- same PMID → duplicate
- same Semantic Scholar ID → duplicate
- identical title/year/author → probable duplicate
- similar title but different paper → do not automatically merge
- conference paper and later journal article → do not automatically merge merely because titles resemble each other

---

## Markdown tests

Test:

```text
@[validKey]
```

resolves.

Test nonexistent key.

Test multiple links.

Test links adjacent to punctuation.

Test normal `@` symbols.

Test malformed syntax.

Test citation-key rename.

Test Markdown XSS payloads.

No raw script/event handler may execute.

---

## BibTeX tests

For each supported Paper type:

1. create canonical fixture
2. export BibTeX
3. parse output
4. compare important fields

Test:

- braces
- accents
- Unicode
- ampersands
- quotes
- multiline abstracts
- missing optional fields
- citation-key collisions
- multiple authors
- organizational authors

---

# 26. Firebase security tests

Using emulator:

User A:

- can read own papers
- can create own paper
- can edit own paper
- can delete own paper
- can read own folders

User B:

- cannot read A's paper by known ID
- cannot query A's collection
- cannot update A's paper
- cannot delete A's paper
- cannot access A's folders

Unauthenticated:

- cannot access anything private.

These tests are release-blocking.

---

# 27. Drive integration tests

Use a dedicated test Google account.

Test:

- connect Drive
- folder creation
- upload 1 MB PDF
- upload large PDF
- interrupted upload/retry
- open PDF
- download PDF
- replace PDF
- metadata-only deletion
- metadata + PDF deletion
- Drive permission revoked
- Drive file manually deleted
- Drive folder manually renamed
- Drive folder manually moved
- duplicate filename
- expired OAuth token

The application must survive missing Drive files gracefully.

If Firestore references a nonexistent PDF:

```text
PDF unavailable
[Locate/Replace PDF]
```

Do not crash the paper page.

---

# 28. Extension tests

Maintain a fixed integration-test corpus of representative pages.

At minimum:

- arXiv
- PubMed
- Nature
- Science
- Springer
- ScienceDirect
- Wiley
- IEEE
- ACM
- bioRxiv
- Google Scholar result page
- Semantic Scholar
- direct PDF URL
- ordinary webpage with no paper
- page containing multiple papers

For each supported page assert:

- detection
- title
- authors
- year/date
- DOI/identifier when available
- PDF detection when available
- successful normalization

Because publisher websites change, these should be regression tests around the bundled translator system.

---

# 29. Zotero migration tests

Create a representative Zotero fixture containing:

- journal article
- conference paper
- preprint
- book
- chapter
- thesis
- DOI-less paper
- tags
- nested collections
- notes
- Unicode
- Better BibTeX citation keys
- duplicate items

Import.

Verify every mapped field.

Then export imported library to `references.bib`.

Verify stable citation keys and biblioic correctness.

---

# 30. End-to-end acceptance test

Before calling v1 complete, perform this exact manual test with a fresh Firebase test user:

1. Sign in with Google.
2. Connect empty Drive.
3. Confirm Research Library folder appears.
4. Add one paper manually.
5. Add one through Semantic Scholar.
6. Add one from arXiv extension.
7. Add one from a publisher extension.
8. Confirm all four appear in library.
9. Confirm available PDFs exist **in Drive and nowhere in Firebase storage**.
10. Create `Planning` folder.
11. Create `Planning/Meta-control`.
12. Add two papers.
13. Add three tags.
14. Write Markdown notes.
15. Reference another paper using `@[key]`.
16. Follow the rendered link.
17. Edit metadata.
18. Confirm citation key remains unchanged.
19. Search library.
20. Export `references.bib`.
21. Import BibTeX into an independent BibTeX parser/reference manager and verify it works.
22. Delete one paper without deleting its PDF.
23. Confirm PDF remains in Drive.
24. Delete another with PDF deletion.
25. Confirm PDF disappears from Drive.
26. Export a representative Zotero library.
27. Import it.
28. Verify collections/tags/metadata/keys.
29. Sign out.
30. Confirm private routes/data cannot be accessed.
31. Sign back in.
32. Confirm library is intact.

**v1 is not complete until this entire sequence succeeds.**

---

# 31. Build order

Build in this order. Do not start by polishing the UI.

**Phase 1 — Foundation:** Create Vue/Vite/TypeScript project, Firebase project, Firebase Auth, Firestore, Hosting, emulator configuration and security rules.

**Phase 2 — Canonical data layer:** Implement `Paper`, `Creator`, `Folder`, normalization, citation-key generation, deduplication and CRUD. This package must be independent of UI.

**Phase 3 — Basic UI:** Login → library → paper view → add/edit/delete → folders → tags → search.

**Phase 4 — Drive:** Connect Drive → create folder → upload/open/delete/replace PDF.

At this point the application should already function as a minimal private citation manager.

**Phase 5 — Markdown:** Notes editor → safe rendering → `@[key]` resolution → autocomplete → backlinks/key-change handling.

**Phase 6 — BibTeX:** `references.bib` export and round-trip tests.

**Phase 7 — Semantic Scholar:** Search → preview → canonical normalization → add → optional OA PDF.

**Phase 8 — Zotero import:** JSON first, then BibTeX. Collections → folders, tags → tags, preserve stable citation keys.

**Phase 9 — Chrome extension:** Start with a hard-coded metadata extractor just to prove extension → authentication → Firestore → Drive works. Only after that works, integrate Zotero Translate and bundled translators.

**Phase 10 — Hardening:** Full regression corpus, Drive failure cases, security tests, Zotero migration fixture and fresh-user acceptance test.

---

# 32. Implementation readiness notes

The brief is ready to implement in phases, but the following decisions and local reference facts should be recorded before Phase 1 begins.

## Decisions still needed

### Firebase project configuration

Each copy of the app uses its own Firebase project, named in a gitignored `biblio.config.json` written by `npm run setup` (see section 35). Nothing in the source names a project.

Remaining setup:

- `npm run setup` creates Hosting, the Cloud Firestore database, rules, and APIs, and walks through enabling the Firebase Authentication Google provider.
- Authorized domains for local development and deployed Hosting
- Whether local emulator data should be seeded with representative sample papers

Do not commit real Firebase config secrets that are not meant for the browser bundle. Firebase web app config is not a database secret, but it is per copy: it lives in `biblio.config.json` (gitignored), never as a fallback in source, so a fork can't silently use another person's project.

Semantic Scholar search cannot call the Graph API directly from the browser because of CORS. The app includes a Firebase Function proxy in `functions/`, but deployment requires the project to be upgraded to Blaze so Cloud Build and Artifact Registry can be enabled.

Security note: as of the initial implementation, `npm audit --omit=dev` reports a high-severity advisory on Firebase's transitive `@grpc/grpc-js` dependency. The current app uses Firebase in the browser and does not run a Node gRPC server, but this remains a release-blocking dependency review item. Do not resolve it with `npm audit fix --force` without verifying Firebase Auth and Firestore behavior, because npm currently proposes a breaking Firebase downgrade that introduces worse advisories.

### Google OAuth and Drive consent

The web app and extension both need Google auth surfaces configured intentionally.

Required values:

- OAuth client for the Vite web app sufficient for pressing **Login with Google** and authenticating with Firebase Auth
- OAuth client for the Chrome extension once extension authentication begins
- Chrome extension ID strategy for local development
- Redirect/offscreen document URLs required by Firebase Auth in Manifest V3
- Drive consent copy for the `drive.file` scope

The extension and web app must resolve to the same Firebase UID after Google sign-in.

### Package manager and workspace tooling

Use npm workspaces across the repo.

- `npm`
- TypeScript project references if package boundaries become awkward
- shared lint/format config at the repository root

The first commit should establish the monorepo skeleton, scripts, and test commands before feature code grows around it.

### V1 PDF folder policy

For v1, let the user choose which Google Drive folder becomes the PDF store during onboarding. Store the selected Drive folder ID in `UserProfile.driveRootFolderId`.

Suggested default if the user creates a folder through the app:

```text
Research Library/
```

Within the selected folder, new app-managed uploads should use:

```text
{citationKey}.pdf
```

Existing local Zotero attachments use a different convention:

```text
Zotero Attachments/{ZOTERO_ATTACHMENT_KEY}/Author et al. - Year - Title.pdf
```

For the working demo, do not port existing Zotero PDFs. Treat existing Zotero attachment folders as future migration input only. Do not adopt Zotero's attachment-folder layout for new app-managed PDFs.

### Zotero migration source

The preferred user-facing import path remains Zotero JSON export, then BibTeX.

A real Zotero library (a local `zotero.sqlite` backup) is useful for designing fixtures and migration checks: a few hundred items, many attachments, journal articles, preprints, notes, conference papers, collections, hundreds of tags, and a dedicated `citationKey` field. But the app should not depend on reading the local SQLite database. SQLite import may be a developer-only fixture path later; the product path should stay export-file based.

### Extension boundary

Before integrating Zotero Translate, implement a small hard-coded extractor for one or two pages and prove:

```text
extension auth -> shared Firebase UID -> create Paper -> optional Drive upload -> open in web app
```

Only after that works should Zotero translator bundling and the broader test corpus be added.

## Ready-to-start definition

Implementation can begin once these are available:

- Firebase project ID and web app config for the dedicated `biblio` Firebase project
- Google OAuth configuration sufficient for web **Login with Google**
- npm workspace setup
- Drive onboarding that lets the user choose the PDF storage folder

Everything else can be handled during the phased build.

---

# 33. Explicit non-goals for v1

Do **not** implement:

- Word integration
- Google Docs integration
- LaTeX editor integration
- citation-style rendering
- CSL style management
- PDF annotations
- PDF text extraction
- AI summaries
- embeddings
- recommendations
- social features
- public profiles
- sharing
- collaborative libraries
- Zotero synchronization
- offline-first synchronization
- citation graph visualization
- Semantic Scholar citation graph features
- automatic metadata updates
- mobile app
- Firefox/Safari extension
- Firebase PDF storage

These are scope creep.

---

# 34. Design principles the implementation must preserve

**Firestore is the canonical library.** Zotero, Semantic Scholar and browser extraction are ingestion sources, not authorities.

**Drive is the canonical PDF store.** The application never owns the PDF bytes long-term.

**Citation keys are stable identifiers.** `@[key]`, BibTeX and future integrations depend upon this.

**Every ingestion route converges onto one canonical schema.** Never make UI behavior depend on whether something came from Zotero versus Semantic Scholar.

**User edits win.** Never silently replace them with external metadata.

**Missing data is valid.** A paper without DOI, date, PDF or even author can still exist.

**Import/export is part of data ownership, not an afterthought.**

**You run it; it's yours.** Biblio is open-source software that each person runs themselves, not a service. The project website (GitHub Pages, `apps/site`) explains it and how to set it up; each person's copy of the app runs on their own Firebase site and shows only a sign-in page. Nothing belongs to anyone but the person running it. See section 35 and `CONTRIBUTING.md`.

**Keep the product fast and boring underneath.** This is a personal library containing thousands or perhaps tens of thousands of small metadata records, not a distributed scientific-computing system.

And one final instruction to the agent: **do not attempt to implement the whole brief in one giant pass.** Treat each phase above as a working checkpoint with its tests passing before moving to the next. The most important early milestone is not Zotero extraction—it is proving that `Google login → Firestore paper → Drive PDF → library UI → BibTeX export` works cleanly end-to-end. Once that spine works, every other ingestion mechanism is just another adapter.

---

# 35. Run your own copy

Anyone should be able to take this code, run their own copy on their own terms, and change it at will. Owning the data (section 5) extends to owning the app.

**Goal.** A new user with a Google account, Node, and git gets a working copy of their own (their own Firebase project, Firestore database, web app, Google sign-in, and `<id>.web.app` address) from:

```sh
git clone <their fork> && cd biblio
npm install
npm run setup
```

**Requirements:**

- **No project in the source.** All per-copy settings live in `biblio.config.json` (gitignored), or the `BIBLIO_CONFIG` variable in CI. A build without it fails with a pointer to `npm run setup`; it never falls back to someone else's project. Local test mode (`npm run dev:local`) needs no config at all.
- **One command, safe to rerun.** `npm run setup` signs in through the Firebase CLI (a pinned dev dependency, so `npm install` is enough). It creates or reuses the project and web app, turns on the Firestore, Drive, and sign-in APIs, creates the database and hosting site, writes the config, points the extension at the new address, and deploys. Every step checks what already exists first. `--dry-run` shows the plan without changing anything.
- **Be honest about the manual step.** Google offers no API to turn on Google sign-in for a personal project, so setup opens the Firebase console page, waits for the one click, and verifies it. If any automated step is blocked (e.g. by an organization policy), setup prints the console page for that step instead of failing.
- **Change, try, publish.** `npm run dev` (own project) or `npm run dev:local` (emulators), then `npm run deploy`. Deploy commands always target the project in the config.
- **Optional push-to-deploy.** `npm run setup -- --github` creates a deploy-only service account (hosting and rules only) and stores its key and the config in the fork's GitHub settings. `.github/workflows/deploy.yml` then tests and deploys every push to `main`, and is skipped in forks without those settings.
- **Free.** Everything runs on Firebase's Spark plan. Cloud Functions stay optional.
- **Portable between copies.** Copies share the on-Drive format (section 5 and `docs/LIBRARY_FORMAT.md`), so a library made in one copy moves to another as a .zip: *Download library* in one, *Import a library* in the other, or Google Drive's own folder download. Copies keep the narrow `drive.file` permission, so signing in never shows an "unverified app" warning.

**Two kinds of site, always.** GitHub Pages for the code (the project website: how it works, features, comparison, and a step-by-step setup tutorial at `setup/`); each person's own Firebase site for their own copy (sign-in only when signed out). The project website never signs anyone in, and no copy of the app advertises.

Documentation for users: the setup tutorial on the project website, and `docs/SELF_HOSTING.md`.

