import type { Folder, Paper, ResearchNote } from "../types";
import {
  LIBRARY_FORMAT_VERSION,
  LIBRARY_PATHS,
  defaultNotePath,
  libraryReadme,
  noteToMarkdown,
  parseLibrary,
  parseNoteMarkdown,
  parseResearchNoteMarkdown,
  researchNotePath,
  researchNoteToMarkdown,
  serializeLibrary,
  type PaperPaths
} from "./format";
import {
  StorageAuthError,
  StorageUnavailableError,
  type FileStore,
  type LibraryView,
  type StoredFile,
  type SyncState,
  type SyncStateStore,
  type SyncedFile
} from "./ports";

// Keeps the canonical library (files in the user's storage) in step with the fast materialized
// view the UI uses. The UI never waits on storage: edits land in the view immediately and the
// engine writes them out in the background.
//
// There is no separate write queue. Pending work is *derived*: whatever the view would serialize
// differently from what was last confirmed in storage (tracked by content hashes in SyncState).
// So edits made while storage is unreachable — even across reloads — are never lost; they are
// written as soon as a sync succeeds. Files changed outside Bibliograph are detected by version
// and pulled in, or kept side by side as conflict copies; nothing is silently overwritten.

/** Fast, stable, non-cryptographic content hash (cyrb53). */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type SyncPhase = "disconnected" | "idle" | "saving" | "saved" | "offline" | "needs-auth" | "error" | "conflict";

export interface SyncStatus {
  phase: SyncPhase;
  /** Items whose current content isn't yet confirmed in storage. */
  pending: number;
  lastSyncedAt?: string;
  message?: string;
  conflicts: string[];
}

export interface SyncEngineOptions {
  files: FileStore;
  view: LibraryView;
  state: SyncStateStore;
  /** Cross-tab mutual exclusion (Web Locks in browsers). Defaults to running directly. */
  lock?: <T>(task: () => Promise<T>) => Promise<T>;
  now?: () => string;
  debounceMs?: number;
  generator?: string;
}

const emptyState = (): SyncState => ({ formatVersion: LIBRARY_FORMAT_VERSION, notes: {} });
const MD = "text/markdown";
const JSON_MIME = "application/json";

function pdfPath(paper: Paper) {
  return paper.pdf ? `${LIBRARY_PATHS.papersDir}/${paper.pdf.filename}` : undefined;
}

function pathsFrom(state: SyncState) {
  return (paper: Paper): PaperPaths => ({ note: state.notes[paper.id]?.path, pdf: pdfPath(paper) });
}

export class SyncEngine {
  private status: SyncStatus = { phase: "idle", pending: 0, conflicts: [] };
  private listeners = new Set<(status: SyncStatus) => void>();
  private cached: SyncState | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private rerun = false;
  private retryMs = 0;
  private disposed = false;
  private readonly lock: NonNullable<SyncEngineOptions["lock"]>;
  private readonly now: () => string;

  constructor(private readonly options: SyncEngineOptions) {
    this.lock = options.lock ?? ((task) => task());
    this.now = options.now ?? (() => new Date().toISOString());
  }

  onStatus(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus() {
    return this.status;
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener(this.status);
  }

  /** Count of items that differ from what storage last confirmed (no network). */
  pending(): number {
    if (!this.cached) return Number.NaN;
    const state = this.cached;
    const { papers, folders, researchNotes = [] } = this.options.view.snapshot();
    const out = serializeLibrary(papers, folders, pathsFrom(state), this.options.generator);
    let count = hashText(out.library) !== state.library?.hash || hashText(out.manifest) !== state.manifest?.hash ? 1 : 0;
    for (const paper of papers) {
      const entry = state.notes[paper.id];
      const body = paper.notesMarkdown ?? "";
      if (entry ? hashText(body) !== entry.hash : body.trim()) count += 1;
    }
    for (const note of researchNotes) {
      const entry = state.researchNotes?.[note.id];
      if (!entry || hashText(researchNoteToMarkdown(note)) !== entry.hash) count += 1;
    }
    return count;
  }

  /** Call after any change to the view; writes are coalesced. */
  schedule(delayMs = this.options.debounceMs ?? 1500) {
    if (this.disposed) return;
    if (this.cached) {
      const pending = this.pending();
      this.setStatus({ pending, phase: pending && !["offline", "needs-auth", "error"].includes(this.status.phase) ? "idle" : this.status.phase });
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), delayMs);
  }

  /** Sync immediately (or right after the sync already in flight). */
  async syncNow(): Promise<void> {
    if (this.disposed) return;
    clearTimeout(this.timer);
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerun = false;
        await this.attempt(() => this.flush());
      } while (this.rerun && !this.disposed);
    })().finally(() => (this.running = null));
    return this.running;
  }

  private async attempt(task: () => Promise<void>) {
    this.setStatus({ phase: "saving", message: undefined });
    try {
      await this.lock(task);
      this.retryMs = 0;
      const pending = this.pending();
      this.setStatus({
        phase: this.status.conflicts.length ? "conflict" : "saved",
        pending: Number.isNaN(pending) ? 0 : pending,
        lastSyncedAt: this.now()
      });
      if (pending > 0) this.schedule(); // edits arrived mid-sync
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const pending = this.pending();
      if (error instanceof StorageAuthError) {
        // Needs a user gesture to re-authorize; don't loop.
        this.setStatus({ phase: "needs-auth", message, pending });
        return;
      }
      this.retryMs = Math.min(60_000, Math.max(2_000, this.retryMs * 2));
      this.setStatus({ phase: error instanceof StorageUnavailableError ? "offline" : "error", message, pending });
      this.schedule(this.retryMs);
    }
  }

  /** The note file last synced for a paper (to trash it alongside the paper). */
  syncedNote(paperId: string): SyncedFile | undefined {
    return this.cached?.notes[paperId];
  }

  /** The file last synced for a research note (to trash it when the note is deleted). */
  syncedResearchNote(noteId: string): SyncedFile | undefined {
    return this.cached?.researchNotes?.[noteId];
  }

  dismissConflicts() {
    this.setStatus({ conflicts: [], phase: this.status.phase === "conflict" ? "saved" : this.status.phase });
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  // --- The sync pass ------------------------------------------------------------------------

  private async flush() {
    const { files, view } = this.options;
    const state = (await this.options.state.load()) ?? emptyState();
    this.cached = state;
    const stamp = this.now().replace(/[:.]/g, "-");
    const conflicts: string[] = [];

    const [rootFiles, noteFiles, paperFiles, researchFiles] = await Promise.all([
      files.list(""),
      files.list(LIBRARY_PATHS.notesDir),
      files.list(LIBRARY_PATHS.papersDir),
      files.list(LIBRARY_PATHS.researchNotesDir)
    ]);
    const root = new Map(rootFiles.map((f) => [f.path, f]));
    const notesByPath = new Map(noteFiles.map((f) => [f.path, f]));
    const notesById = new Map(noteFiles.map((f) => [f.id, f]));

    // A library already in this folder that we've never synced (e.g. connecting an existing
    // library): adopt it if the view is empty, otherwise keep both versions.
    const remoteLibrary = root.get(LIBRARY_PATHS.library);
    let snap = view.snapshot();
    if (remoteLibrary && !state.library) {
      if (!snap.papers.length && !snap.folders.length) {
        await this.adopt(state);
        return;
      }
      const copy = `library.conflict-${stamp}.json`;
      await files.writeText(copy, await files.readText(remoteLibrary), JSON_MIME);
      conflicts.push(`This folder already had a library; it was kept as ${copy}.`);
    } else if (remoteLibrary && state.library && remoteLibrary.version !== state.library.version) {
      // library.json changed outside Bibliograph.
      const local = serializeLibrary(snap.papers, snap.folders, pathsFrom(state), this.options.generator);
      if (hashText(local.library) === state.library.hash && hashText(local.manifest) === state.manifest?.hash) {
        await this.adopt(state);
        return;
      }
      const copy = `library.conflict-${stamp}.json`;
      await files.writeText(copy, await files.readText(remoteLibrary), JSON_MIME);
      conflicts.push(`library.json was edited outside Bibliograph while you also made changes; the outside version is kept as ${copy}.`);
    }

    // 1. PDFs live in papers/. Move any older, top-level PDFs there.
    const inPapers = new Set(paperFiles.map((f) => f.id));
    for (const paper of snap.papers) {
      if (!paper.pdf || inPapers.has(paper.pdf.driveFileId)) continue;
      try {
        const moved = await files.moveInto(paper.pdf.driveFileId, LIBRARY_PATHS.papersDir);
        inPapers.add(moved.id);
      } catch (error) {
        if (error instanceof StorageUnavailableError || error instanceof StorageAuthError) throw error;
        // The file is gone or not ours to move; the paper page reports a missing PDF.
      }
    }

    // 2. Notes.
    for (const paper of snap.papers) {
      const entry = state.notes[paper.id];
      const body = paper.notesMarkdown ?? "";
      if (!entry && !body.trim()) continue;
      const path = entry?.path ?? defaultNotePath(paper);
      const remote = (entry && notesById.get(entry.fileId)) ?? notesByPath.get(path);
      const hash = hashText(body);
      const record = (file: StoredFile, h: string) => (state.notes[paper.id] = { fileId: file.id, path, version: file.version, hash: h });

      if (remote && (!entry || remote.version !== entry.version)) {
        // The file differs from what we last wrote: read it before deciding anything.
        const text = await files.readText(remote);
        const remoteBody = parseNoteMarkdown(text).body;
        const remoteHash = hashText(remoteBody);
        if (remoteHash === hash) {
          record(remote, hash);
          continue;
        }
        const unchangedHere = entry ? hash === entry.hash : !body.trim();
        if (unchangedHere) {
          await view.applyNote(paper.id, remoteBody);
          record(remote, remoteHash);
          continue;
        }
        const copy = path.replace(/\.md$/, `.conflict-${stamp}.md`);
        await files.writeText(copy, text, MD);
        conflicts.push(`Notes for ${paper.citationKey} changed in two places; the other version is kept as ${copy}.`);
      } else if (remote && entry && hash === entry.hash) {
        continue;
      }
      record(await files.writeText(path, noteToMarkdown(paper, body), MD, remote), hash);
    }

    // 2b. Research notes: research-notes/<title>.md, one file per note.
    await this.syncResearchNotes(state, researchFiles, stamp, conflicts);

    // 3. Library metadata, manifest, BibTeX, README.
    snap = view.snapshot();
    // Forget note bookkeeping for papers that no longer exist (their files were trashed or kept
    // deliberately; a restored paper re-adopts its file by path).
    const ids = new Set(snap.papers.map((p) => p.id));
    for (const id of Object.keys(state.notes)) if (!ids.has(id)) delete state.notes[id];
    const out = serializeLibrary(snap.papers, snap.folders, pathsFrom(state), this.options.generator);
    const put = async (key: "library" | "manifest" | "bibtex" | "readme", path: string, content: string, mime: string) => {
      const hash = hashText(content);
      const remote = root.get(path);
      const known = state[key];
      if (known && remote && known.hash === hash && remote.version === known.version) return;
      const file = await files.writeText(path, content, mime, remote);
      state[key] = { fileId: file.id, path, version: file.version, hash } satisfies SyncedFile;
    };
    // Safety net: if the library is about to shrink drastically (an emptied index, a bulk delete),
    // keep the previous library.json as a dated backup before overwriting it.
    const previous = state.paperCount ?? 0;
    const remoteLib = root.get(LIBRARY_PATHS.library);
    if (remoteLib && previous > 0 && (snap.papers.length === 0 || (previous >= 4 && snap.papers.length < previous / 2))) {
      const backup = `library.backup-${stamp}.json`;
      await files.writeText(backup, await files.readText(remoteLib), JSON_MIME);
      conflicts.push(`The library shrank from ${previous} to ${snap.papers.length} papers; the previous version is kept as ${backup}.`);
    }
    await put("library", LIBRARY_PATHS.library, out.library, JSON_MIME);
    state.paperCount = snap.papers.length;
    await put("manifest", LIBRARY_PATHS.manifest, out.manifest, JSON_MIME);
    await put("bibtex", LIBRARY_PATHS.bibtex, out.bibtex, "application/x-bibtex");
    await put("readme", LIBRARY_PATHS.readme, libraryReadme(), MD);

    state.formatVersion = LIBRARY_FORMAT_VERSION;
    await this.options.state.save(state);
    this.cached = state;
    if (conflicts.length) this.setStatus({ conflicts: [...this.status.conflicts, ...conflicts] });
  }

  private async syncResearchNotes(state: SyncState, remoteFiles: StoredFile[], stamp: string, conflicts: string[]) {
    const { files, view } = this.options;
    const known = (state.researchNotes ??= {});
    const byId = new Map(remoteFiles.map((f) => [f.id, f]));
    const knownFileIds = new Set(Object.values(known).map((e) => e.fileId));
    const notes = view.snapshot().researchNotes ?? [];
    const noteIds = new Set(notes.map((n) => n.id));

    // Files we don't track yet: written in another app, dropped in by hand, or ours from before
    // the bookkeeping was lost. Read them once; the header id says which note they are.
    const untracked = new Map<string, { file: StoredFile; text: string; parsed: ReturnType<typeof parseResearchNoteMarkdown> }>();
    for (const file of remoteFiles) {
      if (knownFileIds.has(file.id) || /\.conflict-/.test(file.path) || !/\.md$/i.test(file.path)) continue;
      const text = await files.readText(file);
      const parsed = parseResearchNoteMarkdown(text, file.path.split("/").pop() ?? file.path);
      // Its header id, unless that id is already spoken for (e.g. a copy of another note's file).
      const id = parsed.id && /^[\w-]{1,100}$/.test(parsed.id) && !known[parsed.id] && !untracked.has(parsed.id) ? parsed.id : `md-${file.id}`;
      untracked.set(id, { file, text, parsed });
    }

    const taken = new Set(remoteFiles.map((f) => f.path));
    const record = (id: string, file: StoredFile, hash: string, title: string) => (known[id] = { fileId: file.id, path: file.path, version: file.version, hash, title });

    for (const note of notes) {
      const entry = known[note.id];
      const match = untracked.get(note.id);
      untracked.delete(note.id);
      const remote = entry ? byId.get(entry.fileId) : match?.file;
      const content = researchNoteToMarkdown(note);
      const hash = hashText(content);
      // Files keep their name (even one chosen by hand) until the note is retitled here.
      if (remote) taken.delete(remote.path);
      const retitled = entry ? entry.title !== note.title : !remote;
      const path = remote && !retitled ? remote.path : researchNotePath(note.title, taken);
      taken.add(path);

      if (remote && (!entry || remote.version !== entry.version)) {
        const text = match?.text ?? (await files.readText(remote));
        const parsed = parseResearchNoteMarkdown(text, remote.path.split("/").pop() ?? remote.path);
        const theirs: ResearchNote = { ...note, title: parsed.title, bodyMarkdown: parsed.body };
        const theirHash = hashText(researchNoteToMarkdown(theirs));
        if (theirHash === hash && remote.path === path) {
          record(note.id, remote, hash, note.title);
          continue;
        }
        if (entry && hash === entry.hash) {
          // Only changed outside Bibliograph: take that version.
          await view.applyResearchNote({ ...theirs, updatedAt: this.now() });
          record(note.id, remote, theirHash, theirs.title);
          continue;
        }
        if (theirHash !== hash) {
          const copy = remote.path.replace(/\.md$/i, `.conflict-${stamp}.md`);
          await files.writeText(copy, text, MD);
          conflicts.push(`“${note.title}” changed in two places; the other version is kept as ${copy}.`);
        }
      } else if (remote && entry && hash === entry.hash && remote.path === path) {
        continue;
      }
      record(note.id, await files.writeText(path, content, MD, remote), hash, note.title);
    }

    // New files from outside become notes.
    for (const [id, { file, parsed }] of untracked) {
      const time = file.modifiedTime ?? this.now();
      const note: ResearchNote = { id, title: parsed.title, bodyMarkdown: parsed.body, createdAt: time, updatedAt: time };
      await view.applyResearchNote(note);
      record(note.id, file, hashText(researchNoteToMarkdown(note)), note.title);
    }

    // Forget notes deleted in Bibliograph (their files were trashed by the delete itself).
    const current = new Set([...noteIds, ...untracked.keys()]);
    for (const id of Object.keys(known)) if (!current.has(id)) delete known[id];
  }

  /** Replace the view with what's in storage (the library is canonical). */
  private async adopt(state: SyncState) {
    const read = await readLibrary(this.options.files, this.now());
    if (!read) return;
    await this.options.view.replaceAll(read.papers, read.folders, read.researchNotes);
    Object.assign(state, read.state);
    await this.options.state.save(state);
    this.cached = state;
  }

  /**
   * Rebuild the materialized view from canonical storage — the "Bibliograph can disappear"
   * path. Returns what was found, or null if the folder holds no library.
   */
  async rebuild(): Promise<{ papers: number; notes: number; pdfs: number } | null> {
    clearTimeout(this.timer);
    while (this.running) await this.running;
    let summary: { papers: number; notes: number; pdfs: number } | null = null;
    const task = this.attempt(async () => {
      const read = await readLibrary(this.options.files, this.now());
      if (!read) return;
      await this.options.view.replaceAll(read.papers, read.folders, read.researchNotes);
      await this.options.state.save(read.state);
      this.cached = read.state;
      summary = {
        papers: read.papers.length,
        notes: read.papers.filter((p) => p.notesMarkdown.trim()).length,
        pdfs: read.papers.filter((p) => p.pdf).length
      };
    });
    this.running = task.finally(() => (this.running = null));
    await this.running;
    return summary;
  }
}

/** Does this storage hold a Bibliograph library? Cheap: one listing, one small read. */
export async function inspectLibrary(files: FileStore): Promise<{ papers: number } | null> {
  const root = await files.list("");
  const library = root.find((f) => f.path === LIBRARY_PATHS.library);
  if (!library) return null;
  try {
    const items = JSON.parse(await files.readText(library)) as unknown[];
    return { papers: Array.isArray(items) ? items.length : 0 };
  } catch {
    return { papers: 0 };
  }
}

/** Read the whole canonical library: metadata, collections, notes, and PDF locations. */
export async function readLibrary(files: FileStore, now: string): Promise<{ papers: Paper[]; folders: Folder[]; researchNotes: ResearchNote[]; state: SyncState } | null> {
  const [rootFiles, noteFiles, paperFiles, researchFiles] = await Promise.all([
    files.list(""),
    files.list(LIBRARY_PATHS.notesDir),
    files.list(LIBRARY_PATHS.papersDir),
    files.list(LIBRARY_PATHS.researchNotesDir)
  ]);
  const root = new Map(rootFiles.map((f) => [f.path, f]));
  const libraryFile = root.get(LIBRARY_PATHS.library);
  if (!libraryFile) return null;
  const manifestFile = root.get(LIBRARY_PATHS.manifest);
  const [libraryText, manifestText] = await Promise.all([files.readText(libraryFile), manifestFile ? files.readText(manifestFile) : Promise.resolve(null)]);
  const parsed = parseLibrary(manifestText, libraryText, now);

  const state: SyncState = { formatVersion: LIBRARY_FORMAT_VERSION, notes: {}, paperCount: parsed.papers.length };
  state.library = { fileId: libraryFile.id, path: libraryFile.path, version: libraryFile.version, hash: hashText(libraryText) };
  if (manifestFile && manifestText !== null) state.manifest = { fileId: manifestFile.id, path: manifestFile.path, version: manifestFile.version, hash: hashText(manifestText) };

  // Notes: by the path recorded in library.json, else the conventional name.
  const notesByPath = new Map(noteFiles.map((f) => [f.path, f]));
  const jobs = parsed.papers.map((paper) => async () => {
    const path = parsed.paths.get(paper.id)?.note ?? defaultNotePath(paper);
    const file = notesByPath.get(path);
    if (!file) return;
    const body = parseNoteMarkdown(await files.readText(file)).body;
    paper.notesMarkdown = body;
    state.notes[paper.id] = { fileId: file.id, path, version: file.version, hash: hashText(body) };
  });
  await runLimited(jobs, 6);

  // PDFs: resolve each recorded path to the stored file.
  const pdfsByPath = new Map(paperFiles.map((f) => [f.path, f]));
  for (const paper of parsed.papers) {
    const path = parsed.paths.get(paper.id)?.pdf;
    const file = path ? pdfsByPath.get(path) : undefined;
    if (file) paper.pdf = { driveFileId: file.id, filename: file.path.split("/").pop() ?? file.path, mimeType: "application/pdf", addedAt: paper.createdAt };
  }
  // Research notes: one Markdown file each; notes from an older manifest fill in the rest.
  const researchNotes = new Map<string, ResearchNote>();
  state.researchNotes = {};
  const researchJobs = researchFiles
    .filter((f) => /\.md$/i.test(f.path) && !/\.conflict-/.test(f.path))
    .map((file) => async () => {
      const text = await files.readText(file);
      const parsed = parseResearchNoteMarkdown(text, file.path.split("/").pop() ?? file.path);
      const time = file.modifiedTime ?? now;
      const ownId = parsed.id && /^[\w-]{1,100}$/.test(parsed.id) && !researchNotes.has(parsed.id) ? parsed.id : undefined;
      const note: ResearchNote = { id: ownId ?? `md-${file.id}`, title: parsed.title, bodyMarkdown: parsed.body, createdAt: time, updatedAt: time };
      researchNotes.set(note.id, note);
      state.researchNotes![note.id] = { fileId: file.id, path: file.path, version: file.version, hash: hashText(researchNoteToMarkdown(note)), title: note.title };
    });
  await runLimited(researchJobs, 6);
  for (const note of parsed.researchNotes) if (!researchNotes.has(note.id)) researchNotes.set(note.id, note);

  return { papers: parsed.papers, folders: parsed.folders, researchNotes: [...researchNotes.values()], state };
}

async function runLimited(jobs: Array<() => Promise<void>>, limit: number) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]();
    })
  );
}
