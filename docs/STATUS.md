# Status — 2026-10-07

## Current Version

Biblio is a browser-native reference manager whose canonical library lives in the user's Google
Drive. Firestore is a fast materialized view; the durable library is ordinary files: CSL-JSON,
BibTeX, Markdown notes and research notes, PDFs, and a manifest for folders.

Biblio is open-source software that each person runs themselves. The project website is
GitHub Pages (<https://jordanlei.github.io/biblio/>, with a [setup tutorial](https://jordanlei.github.io/biblio/setup/));
each person's copy of the app runs on their own Firebase site ([SELF_HOSTING.md](SELF_HOSTING.md)).

## Implemented

- **User-owned storage:** `library.json`, `references.bib`, `notes/*.md`, `papers/*.pdf`,
  `biblio.json`, and `README.md` sync to Drive and can rebuild Firestore from Drive.
- **Capture and import:** OpenAlex search, DOI/arXiv/PMID lookup, BibTeX import, manual entry, and
  extension capture all flow through the same dedupe path.
- **Paper Inbox and shelves:** new papers default to Inbox. Shelves are Inbox, Read next, Skimming,
  Reading, Read, Reference, and Parked; legacy `tbr` and `skimmed` data still loads.
- **Organization:** folders remain first-class in the sidebar, with nesting and drag/drop. Tags remain
  cross-cutting labels. Shelf filters, PDF/notes/untagged filters, and local search compose in the
  library URL.
- **Saved reasons:** search/manual add can record why a paper is being saved; rows, inspectors, paper
  pages, Drive format, and local search include `savedBecause`.
- **Research notes:** freeform Markdown notes (`/research-notes/:id`) for questions, projects, and
  drafts. Papers connect through `@[key]` links; each note lists the papers it links, and recent
  notes appear in the sidebar. Each is `notes/<title>.md` in Drive, renamed with its title;
  `.md` files added there elsewhere become notes, and outside edits flow back in.
- **Contextual backlinks:** paper pages and inspectors show where a paper is mentioned (paper notes
  and research notes), with the paragraph or bullet around the link.
- **PDFs:** Find PDF, auto-grab after adding, drag/drop attach, replace, unlink, and delete from Drive.
- **Two sites:** the project website (`apps/site`, GitHub Pages: a home page carrying the argument,
  the architecture diagram, five feature demos and a drop-down FAQ, plus a setup tutorial at `setup/`); each copy of the app
  (`apps/web`) shows only a sign-in page when signed out.
- **Moving a library:** *Download library (.zip)* and *Import a library* (a .zip, Google Drive's own
  folder download, or an unzipped folder) move a library between copies; *Reconnect* reopens a
  library folder the same copy made. Drive access is `drive.file` only: no unverified-app warning.
- **Run your own copy:** `npm run setup` creates and configures a new Firebase project (web app,
  Firestore, APIs, hosting) and deploys; config lives in gitignored
  `biblio.config.json`, with no project hardcoded in source. Optional push-to-deploy via
  GitHub Actions. See [SELF_HOSTING.md](SELF_HOSTING.md).
- **Appearance and onboarding:** guided first-run tour, settings, themes, accents, font choices, and
  text sizes.
- **Test split:** `npm run test:core` is the fast development loop; `npm run test:final` is the release
  gate; `npm run bench:latency` appends local benchmark baselines to [BENCHMARKS.md](BENCHMARKS.md).

## Verification

- `npm run test:core`: provider-boundary check + core unit tests.
- `npm run typecheck`: core build + web typecheck.
- `npm run build`: production build.
- `npm run bench:latency`: deterministic synthetic latency log for serialization, parsing, BibTeX
  export, citation-context extraction, and local search scanning.
- `npx playwright test`: end-to-end walkthrough and ownership specs against the Firebase emulators
  and mock Drive (needs Java 11+ on `PATH`).
- `node scripts/capture-landing.mjs`: regenerates the home-page captures from a live demo; see
  [CAPTURES.md](CAPTURES.md).

## Known Gaps

- `npm run setup` has run end to end on a fresh project on the free plan; the GitHub deploy option
  (`--github`) hasn't been run for real yet.

- No full-text PDF search yet.
- No Zotero JSON import yet; BibTeX import is the current path.
- Cloud Functions for `semanticScholarSearch` and `fetchPdf` require the Firebase Blaze plan. The app
  works without them through OpenAlex/direct/extension PDF flows.
