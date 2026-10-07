# Bibliograph

**Finally, a reference manager that's actually yours.** Bibliograph is open-source software you run yourself: there's no Bibliograph service to sign up for.

- **You run it.** Your own copy, in your own Firebase project, at your own address. Change any of the code.
- **Five-minute setup.** `npm install && npm run setup`: [setup tutorial](https://jordanlei.github.io/bibliograph/setup/).
- **Your data is in your Google Drive.** Papers, notes, research notes, PDFs, and the links between them are ordinary files (CSL-JSON, Markdown, BibTeX, PDF), readable without Bibliograph.
- **Nothing belongs to anyone else.** No central server, no accounts, no analytics. The people who write Bibliograph never see your copy or your library.

> Bibliograph can disappear. Your research cannot.

**Two kinds of site.** This repository's [project website](https://jordanlei.github.io/bibliograph/) (GitHub Pages, `apps/site`) explains Bibliograph, [how it works](https://jordanlei.github.io/bibliograph/how-it-works/), and how to set it up. Each person's own copy of the app (`apps/web`) runs on their own Firebase site and shows just a sign-in page. See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules that keep it that way.

- Set up your own copy: [tutorial](https://jordanlei.github.io/bibliograph/setup/) · full guide [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)
- Current state, verification, and known gaps: [docs/STATUS.md](docs/STATUS.md)
- Storage architecture (what's canonical, sync, rebuild): [docs/STORAGE.md](docs/STORAGE.md)
- The on-Drive library format: [docs/LIBRARY_FORMAT.md](docs/LIBRARY_FORMAT.md)
- How it's built: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Where it could go: [docs/ROADMAP.md](docs/ROADMAP.md)
- How the website's screenshots and videos are made: [docs/CAPTURES.md](docs/CAPTURES.md)
- Contributing and the rules that always hold: [CONTRIBUTING.md](CONTRIBUTING.md)
- Original product brief: [brief.md](brief.md)

## What it does

| Area | What you get |
| --- | --- |
| **Library** | Sidebar with All papers / Recently added, recent research notes, folders, and tags. Bibliography-style list with year in the margin, relevance-ranked search with highlights, and filter chips: shelf (Inbox / Read next / Skimming / Reading / Read / Reference / Parked), Has PDF / No PDF, Has notes, Untagged. A preview pane shows abstract, PDF, cite key, folders, tags, saved reason, and notes. |
| **Keyboard** | `↑ ↓` select (`⇧` extends), `Enter` open, `Space` check, `⌘A` check all, `1`-`7` shelf, `⌫` delete, `⌘Z` undo (15 steps), `/` search, `A` add, `?` help. |
| **Library search** | Every word must match; title and author hits rank above abstract, notes, and saved-because text. Qualifiers: `author:` `title:` `#tag` `key:` `year:2015-2020` `"phrase"`. |
| **Adding papers** | One dialog: **Search** (Topic / Title / Author modes over OpenAlex's 250M works, blended relevance + citations, author pages, year range), **DOIs & arXiv IDs** (bulk paste), **Import .bib** (keeps citation keys; previews new vs. duplicate), **Enter manually** (last resort). New papers land in Inbox by default; search/manual add can set a shelf and saved-because reason. |
| **PDFs** | "Find PDF" on any paper looks for an open-access copy (arXiv, the stored OA link, landing-page rules for NeurIPS/OpenReview/ACL/PMLR/bioRxiv, every OpenAlex location by DOI or exact title) and saves it to Drive. Adding a paper grabs its PDF automatically. Drop a PDF on any row or panel to attach it. |
| **Notes** | Markdown, autosaved. `@[` autocompletes a link to another paper; links render as "Vaswani et al. (2017)" and show up as contextual backlinks with the surrounding snippet. Edit in the preview pane by double-clicking. |
| **Research notes** | Freeform Markdown notes for anything bigger than one paper: a question, a project, a draft. Link papers with `@[`; each linked paper lists the note under "Mentioned in notes", and the note lists the papers it links. Each note is `research-notes/<title>.md` in Drive; Markdown files added there from other apps become notes. |
| **Extension** | Chrome extension reads the paper on the current page and saves it (and its PDF, including subscription PDFs your browser can open) through the app. See [apps/extension/README.md](apps/extension/README.md). |
| **First run** | A step-by-step spotlight tour with Skip; its Drive step creates or picks your library folder. Replay from Settings. |
| **Deleting** | Library and Drive stay in sync: deleting a paper (⌫, bulk, or the paper page) moves its PDF and note to the Drive trash after one confirmation; ⌘Z / Undo restores the record and untrashes the files. Deleting your account leaves your Drive library intact unless you tick “also trash my library folder”. |
| **Appearance** | Settings (click your name → Settings): theme (system/light/dark), 7 accents, 6 reading fonts, 6 interface fonts, 4 text sizes. Saved to your account. |
| **Two sites** | The **project website** (`apps/site`, GitHub Pages) explains Bibliograph, compares it, and shows how to run your own copy, using real captures of the app ([how they're made](docs/CAPTURES.md)). **Each copy of the app** (`apps/web`, on its owner's Firebase Hosting) shows only a sign-in page to signed-out visitors. |
| **Data ownership** | The canonical library is a Drive folder: `library.json` (CSL-JSON), `notes/*.md`, `papers/*.pdf`, `references.bib`, `research-notes/*.md`, `bibliograph.json` (folders), `README.md`. Edits appear instantly and sync in the background (status in the sidebar; offline edits queue). *Rebuild from Drive* or connect an existing library folder to restore everything. |

## Repository layout

```text
apps/web/            The app: Vue 3 + Vite (views, components, services, adapters/, sync/)
apps/site/           The project website: static Vue page, reuses the app's styles and icons
apps/extension/      Manifest V3 extension (popup, page extractor, PDF fetcher, app bridge)
packages/core/       Domain: types, citation keys, normalization, dedupe, BibTeX in/out,
                     library format + sync engine + storage ports (no SDKs)
functions/           Cloud Functions: Semantic Scholar proxy, PDF fetch proxy (need Blaze plan)
scripts/             setup (your own copy), deploy, dev-local launcher, mock Google Drive server
e2e/                 Playwright walkthrough of the new-user journey
samples/             Example Zotero/Better BibTeX export used by tests
docs/                Status, architecture, roadmap
```

## Develop

```sh
npm install
npm run setup        # once: connect this copy to your own Firebase project (docs/SELF_HOSTING.md)
npm run dev          # app against that project (needs a real Google sign-in)
npm run test:core    # fast development loop: provider-boundary check + core unit tests
npm run test:final   # final gate: core tests + typecheck + build + e2e
npm run bench:latency
npm run typecheck
npm run build
npm run site:dev     # the project website, on :5180
```

### Local test mode — no Google account needed

```sh
npm run dev:local    # Auth + Firestore emulators, mock Drive, and Vite on :5173 (WEB_PORT to change)
npm run test:e2e     # Playwright: new-user journey + data-loss/rebuild, offline, outside-edit tests (:5391)
```

- Sign in through the Auth emulator's fake Google chooser: **Add new account**, any email. Emulator UI: <http://127.0.0.1:4000>.
- Drive calls go to `scripts/dev-drive-server.mjs`, a mock of the Drive v3 endpoints the app uses. Files land in `.dev-drive/` and are listed at <http://127.0.0.1:9199>; `/__control/offline?on=1` simulates an outage.
- The project ID is `demo-bibliograph`, so nothing touches the real Firebase project.
- The Firestore emulator needs Java 11+ on `PATH` (`brew install openjdk`).
- There are no test credentials to keep: emulator accounts are invented on the spot. The e2e test signs in through an emulator-only hook (`apps/web/src/services/emulatorHooks.ts`) because the emulator's popup widget can't complete under the Playwright runner; the real popup works when driven by hand.

## Deploy

```sh
npm run deploy       # build + deploy hosting and Firestore rules to the project in bibliograph.config.json
```

Cloud Functions (`semanticScholarSearch`, `fetchPdf`) require upgrading the project to the Blaze plan; then `npm run firebase -- deploy --only functions,hosting`. The app works without them: search uses OpenAlex directly and PDFs fall back to direct and extension fetching.

## Google Cloud configuration

`npm run setup` does all of this for a new copy ([docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)):

- Firebase Auth (Google provider), Firestore, Hosting, and rules.
- **Google Picker key:** the Firebase browser key is restricted to Firebase services, which caused “The API developer key is invalid” in *Use an existing folder*. A separate key, **“Bibliograph Picker (browser)”**, is limited to the Picker API and to the app's origins and localhost. It's stored in `bibliograph.config.json` as `pickerApiKey` (override with `VITE_GOOGLE_PICKER_API_KEY`).
- Drive access uses the narrow `drive.file` scope: the app sees only files it created or that you picked.

## License

[MIT](LICENSE). Run it, change it, share it.
