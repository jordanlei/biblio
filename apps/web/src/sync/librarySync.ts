import { SyncEngine, inspectLibrary, readLibrary, type LibraryView, type SyncStatus } from "@biblio/core";
import { ref, watch } from "vue";
import { GoogleDriveFileStore } from "../adapters/googleDrive";
import { FirestoreSyncStateStore } from "../adapters/firestoreSyncState";
import { connectDriveFolder, type DriveFolderSelection } from "../services/drive";
import { putResearchNote, replaceLibrary, updatePaper, useLibrary } from "../services/library";
import { getGoogleAccessToken, useSession } from "../services/session";

// Composition root for the canonical library. Wires the provider-agnostic SyncEngine (core) to
// Google Drive (canonical files) and Firestore (the fast materialized view the UI reads).
//
// UI edits never wait on Drive: they land in Firestore (and on screen) immediately, and the
// engine writes the library files in the background. See docs/STORAGE.md.

const GENERATOR = "Biblio web";
export const syncStatus = ref<SyncStatus>({ phase: "disconnected", pending: 0, conflicts: [] });

const session = useSession();
const { papers, folders, researchNotes, loaded, confirmed, loadError } = useLibrary();
let engine: SyncEngine | null = null;
let unsubscribe: (() => void) | null = null;

// The Firestore-backed view the engine reads from and, for rebuilds and outside edits, writes to.
const view: LibraryView = {
  snapshot: () => ({ papers: papers.value, folders: folders.value, researchNotes: researchNotes.value }),
  applyNote: (paperId, markdown) => updatePaper(paperId, { notesMarkdown: markdown }),
  applyResearchNote: (note) => putResearchNote(note),
  replaceAll: (nextPapers, nextFolders, nextResearchNotes) => replaceLibrary(nextPapers, nextFolders, nextResearchNotes),
  setPdfLocation: (paperId, pdf) => updatePaper(paperId, { pdf })
};

/** One sync at a time across tabs (Web Locks); falls back to running directly. */
function webLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: { request: (name: string, cb: () => Promise<unknown>) => Promise<unknown> } }).locks;
  return locks ? (locks.request("biblio-library-sync", task) as Promise<T>) : task();
}

function start(uid: string | null, rootId: string | null | undefined) {
  unsubscribe?.();
  engine?.dispose();
  engine = null;
  if (!uid || !rootId) {
    syncStatus.value = { phase: "disconnected", pending: 0, conflicts: [] };
    return;
  }
  engine = new SyncEngine({
    files: new GoogleDriveFileStore(rootId, false),
    view,
    state: new FirestoreSyncStateStore(uid, rootId),
    lock: webLock,
    generator: GENERATOR
  });
  unsubscribe = engine.onStatus((status) => (syncStatus.value = status));
  if (ready()) void engine.syncNow();
}

watch(() => [session.uid.value, session.profile.value?.driveRootFolderId] as const, ([uid, rootId]) => start(uid, rootId), { immediate: true });

// First sync once the view has loaded; afterwards, every change schedules a (coalesced) write.
// Never sync from an index that failed to load (it would look empty) or that only reflects the
// local cache (it could be older than Drive).
const ready = () => loaded.value && confirmed.value && !loadError.value;
watch(confirmed, () => {
  if (ready()) void engine?.syncNow();
});
watch([papers, folders, researchNotes], () => {
  if (ready()) engine?.schedule();
});

// Come back online → flush queued changes. Return to the tab → pick up edits made elsewhere.
let lastFocusSync = 0;
window.addEventListener("online", () => void engine?.syncNow());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || Date.now() - lastFocusSync < 60_000) return;
  lastFocusSync = Date.now();
  void engine?.syncNow();
});
window.addEventListener("beforeunload", (event) => {
  // Edits are safe in Firestore either way; only warn while a write is mid-flight.
  if (syncStatus.value.phase === "saving") event.preventDefault();
});

/** Stop syncing (before deleting the index, e.g. account deletion, so Drive is left untouched). */
export function stopSync() {
  unsubscribe?.();
  engine?.dispose();
  engine = null;
  syncStatus.value = { phase: "disconnected", pending: 0, conflicts: [] };
}

export function syncNow() {
  return engine?.syncNow();
}

/** After "Reconnect": get a fresh Google token (needs a click), then flush the queue. */
export async function reconnectDrive() {
  await getGoogleAccessToken();
  await engine?.syncNow();
}

/** Drive file id of a paper's notes, if it has been synced. */
export function syncedNoteFileId(paperId: string): string | undefined {
  return engine?.syncedNote(paperId)?.fileId;
}

export function syncedResearchNoteFileId(noteId: string): string | undefined {
  return engine?.syncedResearchNote(noteId)?.fileId;
}

export function dismissConflicts() {
  engine?.dismissConflicts();
}

/** Rebuild Biblio's index from the Drive library (the canonical copy). */
export async function rebuildFromDrive() {
  if (!engine) throw new Error("Connect a Google Drive folder first.");
  await getGoogleAccessToken();
  const summary = await engine.rebuild();
  if (!summary && syncStatus.value.phase !== "saved") throw new Error(syncStatus.value.message ?? "Couldn't read the library from Drive.");
  return summary;
}

/**
 * Connect a Drive folder as the library. If it already holds a Biblio library, offer to
 * load it (that's how a library is recovered or moved between accounts); otherwise this
 * library is written into it.
 */
export async function connectLibraryFolder(folder: DriveFolderSelection, confirmLoad: (count: number) => boolean = (count) =>
  confirm(`“${folder.name}” already contains a Biblio library with ${count} paper${count === 1 ? "" : "s"}. Load it?\n\nWhat Biblio shows now will be replaced by the library in this folder.`)
): Promise<{ loaded: number | null }> {
  const files = new GoogleDriveFileStore(folder.id, true);
  const found = await inspectLibrary(files);
  if (found && papers.value.length && !confirmLoad(found.papers)) return { loaded: null };
  if (found) {
    // Load the library and its sync bookkeeping before switching folders, so the first sync
    // sees an index that already matches Drive instead of a competing library.
    const read = await readLibrary(files, new Date().toISOString());
    if (read) {
      await replaceLibrary(read.papers, read.folders);
      await new FirestoreSyncStateStore(session.uid.value!, folder.id).save(read.state);
    }
    await connectDriveFolder(folder);
    return { loaded: read?.papers.length ?? 0 };
  }
  await connectDriveFolder(folder);
  return { loaded: null };
}
