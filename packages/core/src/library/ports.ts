import type { Folder, Paper, ResearchNote } from "../types";

// Ports: the small interfaces the library/sync core depends on. Providers (Google Drive,
// Firestore, a local folder, S3…) implement them as adapters; the core never imports an SDK.

/** A file in the canonical library, addressed by a library-relative path ("notes/x.md"). */
export interface StoredFile {
  id: string;
  path: string;
  /** Changes whenever the content changes (Drive's `version`). Used to detect outside edits. */
  version: string;
  modifiedTime?: string;
}

/** Canonical storage: a folder of plain files owned by the user. */
export interface FileStore {
  /** Files directly inside a directory ("" is the root). */
  list(dir: string): Promise<StoredFile[]>;
  readText(file: StoredFile): Promise<string>;
  /** Raw contents (PDFs), e.g. for exporting the library. */
  readBlob(file: StoredFile): Promise<Blob>;
  /** Create or overwrite the file at `path`, or update the given file (renaming it to `path` if that differs). */
  writeText(path: string, content: string, mimeType: string, existing?: StoredFile): Promise<StoredFile>;
  writeBlob(path: string, content: Blob, mimeType: string, existing?: StoredFile): Promise<StoredFile>;
  /** Move an existing file (by id) into `dir`, e.g. legacy PDFs into papers/. */
  moveInto(fileId: string, dir: string): Promise<StoredFile>;
  remove(fileId: string): Promise<void>;
}

/** The fast, disposable materialized view the UI reads (Firestore today). */
export interface LibraryView {
  snapshot(): { papers: Paper[]; folders: Folder[]; researchNotes?: ResearchNote[] };
  /** Adopt a note edited outside Bibliograph. */
  applyNote(paperId: string, markdown: string): Promise<void>;
  /** Adopt a research note created or edited outside Bibliograph (insert or replace by id). */
  applyResearchNote(note: ResearchNote): Promise<void>;
  /** Replace the whole view with the canonical library (rebuild / external library edit). */
  replaceAll(papers: Paper[], folders: Folder[], researchNotes?: ResearchNote[]): Promise<void>;
  /** Record where a paper's PDF lives (provider file id) after a move or rebuild. */
  setPdfLocation(paperId: string, pdf: Paper["pdf"]): Promise<void>;
}

/** Last-synced bookkeeping (derived; losing it only costs a full re-sync). */
export interface SyncedFile {
  fileId: string;
  path: string;
  version: string;
  hash: string;
}

export interface SyncState {
  formatVersion: number;
  library?: SyncedFile;
  /** Paper count in the last library.json we wrote; used to catch accidental mass deletion. */
  paperCount?: number;
  manifest?: SyncedFile;
  bibtex?: SyncedFile;
  readme?: SyncedFile;
  /** Keyed by paper id. */
  notes: Record<string, SyncedFile>;
  /** Keyed by research note id. `title` is the title last written, so a retitle renames the file. */
  researchNotes?: Record<string, SyncedFile & { title?: string }>;
}

export interface SyncStateStore {
  load(): Promise<SyncState | null>;
  save(state: SyncState): Promise<void>;
}

/** Thrown by adapters when storage can't be reached (offline, 5xx, timeouts): retry later. */
export class StorageUnavailableError extends Error {}
/** Thrown when the user must re-authorize (expired token) before syncing can continue. */
export class StorageAuthError extends Error {}
