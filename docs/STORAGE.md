# Storage: a user-owned library

> **Biblio can disappear. The user's research cannot.**

Biblio is an interface, index, and intelligence layer over a library the user owns. The canonical library is a folder of open-format files in the user's Google Drive ([format spec](LIBRARY_FORMAT.md)). Biblio's database is a fast, disposable materialized view of it.

## What lives where

| Data | Classification | Canonical home | Also kept in (derived) |
| --- | --- | --- | --- |
| Paper metadata (title, authors, venue, identifiers…) | **Canonical** | `library.json` (CSL-JSON) | Firestore `papers/{id}` |
| Citation keys | **Canonical** | `library.json` `id` | Firestore |
| Tags, reading shelf/status, saved-because reason, date added | **Canonical** | `library.json` `custom.biblio` | Firestore |
| Collections (folders) and membership | **Canonical** | `biblio.json` + `custom.biblio.collections` | Firestore `folders/{id}` |
| Research notes | **Canonical** | `notes/<title>.md` | Firestore `researchNotes/{id}` |
| Notes | **Canonical** | `notes/<key>.md` | Firestore `notesMarkdown` |
| Paper ↔ paper links | **Canonical** | `@[key]` inside notes | backlinks computed in memory |
| PDFs | **Canonical** | `papers/<key>.pdf` | Drive file id in Firestore |
| BibTeX | Derived (convenience) | `references.bib` | — |
| Drive file ids, versions, content hashes | Derived | — | Firestore `sync/library` |
| Profile (chosen folder, onboarding done) | Derived / settings | — | Firestore `users/{uid}` |
| Search index, highlights, backlinks, undo stack | Derived | — | memory |
| UI preferences (sort, collapsed folders) | Derived | — | localStorage |
| Google OAuth tokens | Session | — | memory + sessionStorage (never Firestore or Drive) |

The test: delete Biblio's entire database, reconnect the Drive folder, and the library reconstructs. This is an automated test (`e2e/ownership.spec.ts`).

## Architecture

```text
                    USER-OWNED / CANONICAL
                  Google Drive: <library folder>
        README.md · biblio.json · library.json · references.bib
        folders · researchNotes
                notes/<key>.md        papers/<key>.pdf
                              ▲
                              │  FileStore port  (adapters/googleDrive.ts)
                   ┌──────────┴──────────┐
                   │  SyncEngine (core)  │  hashes · versions · conflicts · rebuild
                   └──────────┬──────────┘
                              │  LibraryView port (sync/librarySync.ts)
                   ┌──────────┴──────────┐
                   │ Firestore: papers,  │  materialized view, live via onSnapshot
                   │ folders, research   │
                   │ notes, sync state   │
                   └──────────┬──────────┘
                              │
          search (in memory) · filters · backlinks · Vue UI
```

### Layers and dependency direction

| Layer | Where | Depends on |
| --- | --- | --- |
| Domain + format + sync engine | `packages/core` (`library/format.ts`, `library/sync.ts`, `library/ports.ts`) | nothing provider-specific |
| Ports | `FileStore` (canonical files), `LibraryView` (materialized view), `SyncStateStore` (bookkeeping) | — |
| Adapters | `apps/web/src/adapters/googleDrive.ts` (FileStore over Drive REST), `adapters/firestoreSyncState.ts`, `services/library.ts` (Firestore view + Vue store) | SDKs/REST |
| Composition | `apps/web/src/sync/librarySync.ts` | core + adapters |
| UI | `components/`, `views/` | services only |

`npm test` runs `scripts/check-boundaries.mjs`, which fails if the core imports Firebase/Vue/Google SDKs or if UI code imports SDKs or adapters directly. Another provider (local folder, Dropbox, S3) would be one new `FileStore` adapter; `MemoryFileStore` in core is the reference implementation used by tests.

## Performance model

Drive is the canonical store, not the query engine.

```text
user action → Firestore write (latency-compensated: UI updates immediately)
            → SyncEngine.schedule()  (coalesced, ~1.5 s)
            → write changed files to Drive in the background
            → status: Saved
```

- Opening the library, browsing, searching, filtering, sorting, backlinks, and opening a paper read only the Firestore view (one live subscription) and in-memory indexes. None of them touch Drive.
- Notes, tags, shelves/statuses, saved reasons, folders, and Research Notes update on screen at once; Drive writes happen after.
- A sync pass costs three Drive listings plus writes for what actually changed (notes are per file; `library.json`/`references.bib` are single files). Unchanged files are never rewritten (content hashes, deterministic serialization).
- PDFs are uploaded straight to `papers/` when attached, and opened from Drive.

## Synchronization

`SyncEngine` (`packages/core/src/library/sync.ts`) is the only writer of library text files.

- **No fragile queue.** Pending work is derived: anything whose current content hash differs from the last confirmed write (stored in `sync/library`). Edits made while Drive is unreachable are already safe in Firestore and are written when a sync succeeds, even after a reload.
- **Status** shown in the sidebar: *Saved*, *Saving…*, *N changes to save*, *Offline — N queued*, *Reconnect Drive to sync*, *Sync error — retrying*, *Kept both versions* (conflict).
- **Retries** with backoff (2 s → 60 s) on network/5xx errors; immediately on `online`; on returning to the tab (≤ once a minute) to pick up outside edits.
- **Expired Google token:** background sync never opens popups. It shows *Reconnect Drive*; one click re-authorizes and flushes.
- **Multiple tabs:** a Web Lock makes one tab sync at a time; bookkeeping is shared via Firestore, so other tabs and devices see what was written.
- **Outside edits:** a file whose Drive `version` differs from the one we recorded was changed elsewhere. If we have no local change to it, the outside version is adopted (notes, or the whole library for `library.json`). If both changed, the outside version is kept as a `.conflict-<time>` copy and ours is written; nothing is lost.
- **Safety nets:** never sync from an index that failed to load; keep `library.backup-<time>.json` before writing a library that shrank to empty or by more than half; adopt (don't overwrite) an existing library found in a newly connected folder; tolerate duplicate `papers/`/`notes/` folders.

## Deleting

The library and Drive are kept in step for deliberate deletions, and every destructive action goes through one confirmation dialog (`components/ConfirmDialog.vue`):

| Action | Drive effect | Undo |
| --- | --- | --- |
| Delete paper(s) (⌫, bulk, paper page) | removed from `library.json`; PDF and note file moved to Drive trash | ⌘Z restores the record and untrashes both files |
| Remove PDF | PDF moved to Drive trash | ⌘Z |
| Delete folder | collection removed from `biblio.json`; papers stay | ⌘Z |
| Delete account | nothing, unless “also move my library folder to the trash” is ticked | — (Drive trash keeps it 30 days) |

Deletions are all-or-nothing: if a Drive file can't be trashed, nothing is deleted and any files already trashed are restored (`services/deletion.ts`). The sync engine itself never deletes files.

## Rebuild

`SyncEngine.rebuild()` (Settings → *Rebuild from Drive*), and connecting a folder that already holds a library, read `biblio.json`, `library.json`, every note, and the `papers/` listing, then replace the Firestore view and the sync bookkeeping. Folders come from `biblio.json`; research notes from `research-notes/*.md` (plus any left in an older manifest's `researchNotes`, which are converted). Search indexes and backlinks are in-memory and rebuild themselves. Future derived state (full-text, embeddings, graph) must be rebuildable the same way.

## Migration from the Firestore-canonical version

Existing libraries migrate on their first sync, with no user action:

1. The previously chosen Drive folder becomes the library root.
2. Papers, folders, and notes are written out from Firestore (`library.json`, `biblio.json`, `notes/`).
3. PDFs at the folder's top level are moved into `papers/` (same Drive files; ids and sharing unchanged).
4. Users without a connected folder see *Connect Google Drive* in the sidebar; their library stays in Firestore until they connect one.

User-facing behavior is otherwise unchanged.

## Known limits

- Drive `drive.file` scope: a copy sees only the files it created (no "unverified app" warning). Edits to those files made elsewhere are picked up; files added by hand are not seen. A library made elsewhere comes in by import, which copies it into a new folder this copy owns (`services/transfer.ts`).
- Conflicts on `library.json` are resolved at file level (outside copy kept), not merged field by field.
- Firestore's local cache isn't persisted across reloads; offline *Drive* outages are fully supported, full offline use of the app is not.
- Firestore documents still store a full copy of notes (needed for instant search). Very large libraries may want notes moved to a separate collection later.
