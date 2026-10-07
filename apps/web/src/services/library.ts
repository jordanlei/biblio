import {
  CITATION_LINK_PATTERN,
  buildPaper,
  exportBibtex,
  extractCitationLinkContexts,
  findExistingPaper,
  isLegacyResearchNote,
  migrateResearchNote,
  normalizeCreatorName,
  replaceCitationKey,
  type Creator,
  type DuplicateResult,
  type Folder,
  type Paper,
  type PaperCandidate,
  type PaperType,
  type LegacyResearchNote,
  type ResearchNote
} from "@biblio/core";
import { deleteDoc, deleteField, doc, onSnapshot, setDoc, updateDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import { computed, ref, watch } from "vue";
import { db } from "../firebase";
import { foldersCollection, papersCollection, researchNotesCollection, userDoc } from "./paths";
import { requireUid, useSession } from "./session";

// --- Live library state ----------------------------------------------------------------------
// One Firestore subscription per signed-in user, shared by every view. Local writes show up
// immediately through latency compensation, so views never need to "refresh".
const papers = ref<Paper[]>([]);
const folders = ref<Folder[]>([]);
// Stored research notes; ones saved before notes became freeform Markdown are folded into plain
// Markdown on read (see migrateResearchNote) and rewritten in the new shape on their next edit.
const storedResearchNotes = ref<Array<ResearchNote | LegacyResearchNote>>([]);
const loaded = ref(false);
const confirmed = ref(false);
const loadError = ref("");
let unsubscribers: Unsubscribe[] = [];

const session = useSession();
watch(
  session.uid,
  (uid) => {
    unsubscribers.forEach((stop) => stop());
    unsubscribers = [];
    papers.value = [];
    folders.value = [];
    storedResearchNotes.value = [];
    loaded.value = false;
    confirmed.value = false;
    loadError.value = "";
    if (!uid) return;
    // The first snapshot may come from the on-disk cache (instant render). `confirmed` turns true
    // once both listeners have heard from the server; sync waits for it so a stale cache is never
    // written over the library in Drive.
    const seen = new Set<string>();
    const fromServer = new Set<string>();
    const settle = (name: string, cached: boolean) => {
      seen.add(name);
      if (!cached) fromServer.add(name);
      if (seen.size === 3) loaded.value = true;
      if (fromServer.size === 3) confirmed.value = true;
    };
    const fail = (error: Error) => {
      loadError.value = error.message;
      loaded.value = true;
    };
    unsubscribers.push(
      onSnapshot(
        papersCollection(uid),
        { includeMetadataChanges: true },
        (snapshot) => {
          // Metadata-only events (cache → server confirmation) don't change the data.
          if (!seen.has("papers") || snapshot.docChanges().length) papers.value = snapshot.docs.map((d) => d.data() as Paper);
          settle("papers", snapshot.metadata.fromCache);
        },
        fail
      ),
      onSnapshot(
        foldersCollection(uid),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!seen.has("folders") || snapshot.docChanges().length) {
            folders.value = snapshot.docs.map((d) => d.data() as Folder).sort((x, y) => x.name.localeCompare(y.name));
          }
          settle("folders", snapshot.metadata.fromCache);
        },
        fail
      ),
      onSnapshot(
        researchNotesCollection(uid),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!seen.has("researchNotes") || snapshot.docChanges().length) {
            storedResearchNotes.value = snapshot.docs.map((d) => d.data() as ResearchNote | LegacyResearchNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          }
          settle("researchNotes", snapshot.metadata.fromCache);
        },
        fail
      )
    );
  },
  { immediate: true }
);

const paperById = computed(() => new Map(papers.value.map((paper) => [paper.id, paper])));
const paperByKey = computed(() => new Map(papers.value.map((paper) => [paper.citationKey, paper])));
const researchNotes = computed<ResearchNote[]>(() =>
  storedResearchNotes.value.map((note) => (isLegacyResearchNote(note) ? migrateResearchNote(note, (id) => paperById.value.get(id)?.citationKey) : (note as ResearchNote)))
);

const tagCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const paper of papers.value) for (const tag of paper.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
});

/** Papers whose notes mention `@[key]`, keyed by the mentioned citation key. */
const backlinks = computed(() => {
  const map = new Map<string, Paper[]>();
  for (const paper of papers.value) {
    for (const match of paper.notesMarkdown?.matchAll(CITATION_LINK_PATTERN) ?? []) {
      const list = map.get(match[1]) ?? [];
      if (!list.includes(paper)) list.push(paper);
      map.set(match[1], list);
    }
  }
  return map;
});

/** Where a paper is mentioned: another paper's notes, or a research note. */
export interface BacklinkContext {
  source: { kind: "paper"; paper: Paper } | { kind: "note"; note: ResearchNote };
  sourceId: string;
  snippet: string;
}

const backlinkContexts = computed(() => {
  const map = new Map<string, BacklinkContext[]>();
  const add = (source: BacklinkContext["source"], sourceId: string, markdown: string) => {
    for (const context of extractCitationLinkContexts(markdown)) {
      const list = map.get(context.key) ?? [];
      if (!list.some((entry) => entry.sourceId === sourceId && entry.snippet === context.snippet)) list.push({ source, sourceId, snippet: context.snippet });
      map.set(context.key, list);
    }
  };
  for (const note of researchNotes.value) add({ kind: "note", note }, `note:${note.id}`, note.bodyMarkdown);
  for (const paper of papers.value) add({ kind: "paper", paper }, paper.id, paper.notesMarkdown ?? "");
  return map;
});

export function useLibrary() {
  return { papers, folders, researchNotes, loaded, confirmed, loadError, paperById, paperByKey, tagCounts, backlinks, backlinkContexts };
}

// --- Display helpers -------------------------------------------------------------------------
export function creatorsToText(creators: Creator[]): string {
  return creators.map(normalizeCreatorName).join("; ");
}

export function familyName(creator: Creator): string {
  return creator.family ?? creator.literal ?? creator.given ?? "";
}

/** "Vaswani", "Vaswani & Shazeer", "Vaswani et al." */
export function shortAuthors(creators: Creator[]): string {
  if (!creators.length) return "Unknown author";
  if (creators.length === 1) return familyName(creators[0]);
  if (creators.length === 2) return `${familyName(creators[0])} & ${familyName(creators[1])}`;
  return `${familyName(creators[0])} et al.`;
}

export function parseCreators(value: string): Creator[] {
  return value
    .split(/\s*(?:;|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => {
      if (name.includes(",")) {
        const [family, given] = name.split(",").map((piece) => piece.trim());
        return given ? { family, given } : { family };
      }
      const pieces = name.split(/\s+/);
      if (pieces.length === 1) return { literal: pieces[0] };
      return { given: pieces.slice(0, -1).join(" "), family: pieces.at(-1) };
    });
}

export const paperTypeLabels: Record<PaperType, string> = {
  article: "Journal article",
  conferencePaper: "Conference paper",
  preprint: "Preprint",
  book: "Book",
  bookChapter: "Book chapter",
  thesis: "Thesis",
  report: "Report",
  other: "Other"
};
export const paperTypes = Object.keys(paperTypeLabels) as PaperType[];

export function citeCommand(papers: Paper[]): string {
  return `\\cite{${papers.map((paper) => paper.citationKey).join(",")}}`;
}

// --- Undo ------------------------------------------------------------------------------------
// A short stack of reversible actions. Each entry snapshots the affected records before the change;
// undoing writes the snapshots back (and removes anything the action created).
interface UndoEntry {
  label: string;
  papers: Paper[];
  folders: Folder[];
  createdPaperIds: string[];
  /** Extra reversal outside Firestore, e.g. taking trashed Drive files back out of the trash. */
  restore?: () => Promise<void>;
}

export interface UndoOptions {
  label: string;
  restore?: () => Promise<void>;
}
const UNDO_LIMIT = 15;
const undoStack = ref<UndoEntry[]>([]);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function remember(label: string, paperIds: Iterable<string>, extra: { folders?: Folder[]; createdPaperIds?: string[]; restore?: () => Promise<void> } = {}) {
  const snapshot = [...new Set(paperIds)].map((id) => paperById.value.get(id)).filter((p): p is Paper => Boolean(p));
  undoStack.value = [
    ...undoStack.value,
    { label, papers: clone(snapshot), folders: clone(extra.folders ?? []), createdPaperIds: extra.createdPaperIds ?? [], restore: extra.restore }
  ].slice(-UNDO_LIMIT);
}

/** Revert the most recent recorded action. Returns its label, or null when there's nothing to undo. */
export async function undoLast(): Promise<string | null> {
  const entry = undoStack.value.at(-1);
  if (!entry) return null;
  const uid = requireUid();
  const batch = writeBatch(db);
  for (const paper of entry.papers) batch.set(doc(papersCollection(uid), paper.id), paper);
  for (const folder of entry.folders) batch.set(doc(foldersCollection(uid), folder.id), folder);
  for (const id of entry.createdPaperIds) batch.delete(doc(papersCollection(uid), id));
  await entry.restore?.();
  await batch.commit();
  undoStack.value = undoStack.value.slice(0, -1);
  return entry.label;
}

// --- Writes ----------------------------------------------------------------------------------
const now = () => new Date().toISOString();

export function checkDuplicate(candidate: PaperCandidate): DuplicateResult {
  return findExistingPaper(candidate, papers.value);
}

export async function addPaper(candidate: PaperCandidate): Promise<Paper> {
  const uid = requireUid();
  const paper = buildPaper(candidate, { id: crypto.randomUUID(), existingKeys: papers.value.map((p) => p.citationKey), now: now() });
  remember("Add paper", [], { createdPaperIds: [paper.id] });
  await setDoc(doc(papersCollection(uid), paper.id), paper);
  return paper;
}

/** Add many candidates in batched writes. Exact duplicates are skipped; returns the papers written. */
export async function importPapers(candidates: PaperCandidate[]): Promise<Paper[]> {
  const uid = requireUid();
  const keys = new Set(papers.value.map((p) => p.citationKey));
  const created: Paper[] = [];
  // Step timestamps back by 1 ms so "date added" (newest first) keeps the source's order.
  const base = Date.now();
  for (const [index, candidate] of candidates.entries()) {
    const paper = buildPaper(candidate, { id: crypto.randomUUID(), existingKeys: keys, now: new Date(base - index).toISOString() });
    keys.add(paper.citationKey);
    created.push(paper);
  }
  remember(`Import ${created.length} papers`, [], { createdPaperIds: created.map((p) => p.id) });
  for (let start = 0; start < created.length; start += 400) {
    const batch = writeBatch(db);
    for (const paper of created.slice(start, start + 400)) batch.set(doc(papersCollection(uid), paper.id), paper);
    await batch.commit();
  }
  return created;
}

/** Patch a paper. Pass `undo` for user-visible edits that should be undoable (not for autosave). */
export async function updatePaper(paperId: string, patch: Partial<Paper>, undo?: string | UndoOptions) {
  const uid = requireUid();
  if (undo) remember(typeof undo === "string" ? undo : undo.label, [paperId], typeof undo === "string" ? {} : { restore: undo.restore });
  const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
  await updateDoc(doc(papersCollection(uid), paperId), { ...clean, updatedAt: now() });
}

export async function deletePaper(paperId: string) {
  await deletePapers([paperId]);
}

/** Delete paper records, undoably. (Drive files are handled by services/deletion.ts.) */
export async function deletePapers(paperIds: string[], restore?: () => Promise<void>) {
  const uid = requireUid();
  remember(paperIds.length === 1 ? "Delete paper" : `Delete ${paperIds.length} papers`, paperIds, { restore });
  for (let start = 0; start < paperIds.length; start += 450) {
    const batch = writeBatch(db);
    paperIds.slice(start, start + 450).forEach((id) => batch.delete(doc(papersCollection(uid), id)));
    await batch.commit();
  }
}

/** Rename a citation key and, optionally, rewrite `@[old]` references in every note. */
export async function renameCitationKey(paper: Paper, newKey: string, updateReferences: boolean) {
  const uid = requireUid();
  const batch = writeBatch(db);
  batch.update(doc(papersCollection(uid), paper.id), { citationKey: newKey, updatedAt: now() });
  if (updateReferences) {
    for (const other of backlinks.value.get(paper.citationKey) ?? []) {
      const source = other.id === paper.id ? paper.notesMarkdown : other.notesMarkdown;
      batch.update(doc(papersCollection(uid), other.id), { notesMarkdown: replaceCitationKey(source, paper.citationKey, newKey), updatedAt: now() });
    }
    for (const note of researchNotes.value) {
      const body = replaceCitationKey(note.bodyMarkdown, paper.citationKey, newKey);
      if (body !== note.bodyMarkdown) await updateResearchNote(note.id, { bodyMarkdown: body }, batch);
    }
  }
  await batch.commit();
}

export async function setPaperFolders(paperIds: string[], folderId: string, member: boolean) {
  const uid = requireUid();
  remember(member ? "Add to folder" : "Remove from folder", paperIds);
  const batch = writeBatch(db);
  for (const id of paperIds) {
    const paper = paperById.value.get(id);
    if (!paper) continue;
    const folderIds = member ? [...new Set([...paper.folderIds, folderId])] : paper.folderIds.filter((f) => f !== folderId);
    batch.update(doc(papersCollection(uid), id), { folderIds, updatedAt: now() });
  }
  await batch.commit();
}

export async function setPaperTag(paperIds: string[], tag: string, member: boolean) {
  const uid = requireUid();
  remember(member ? `Tag #${tag}` : `Remove #${tag}`, paperIds);
  const batch = writeBatch(db);
  for (const id of paperIds) {
    const paper = paperById.value.get(id);
    if (!paper) continue;
    const tags = member ? [...new Set([...paper.tags, tag])] : paper.tags.filter((t) => t !== tag);
    batch.update(doc(papersCollection(uid), id), { tags, updatedAt: now() });
  }
  await batch.commit();
}

export async function createResearchNote(title = "Untitled note", bodyMarkdown = ""): Promise<ResearchNote> {
  const time = now();
  const note: ResearchNote = { id: crypto.randomUUID(), title: title.trim() || "Untitled note", bodyMarkdown, createdAt: time, updatedAt: time };
  await setDoc(doc(researchNotesCollection(requireUid()), note.id), note);
  return note;
}

/**
 * Save a note's title and/or text. Only the changed fields are written, so a title save and a text
 * save in flight together can't undo each other. A note still in the old structured shape is
 * rewritten whole, once, in the new shape.
 */
export async function updateResearchNote(noteId: string, patch: Partial<Pick<ResearchNote, "title" | "bodyMarkdown">>, batch?: ReturnType<typeof writeBatch>) {
  const ref = doc(researchNotesCollection(requireUid()), noteId);
  const stored = storedResearchNotes.value.find((n) => n.id === noteId);
  const note = researchNotes.value.find((n) => n.id === noteId);
  if (!stored || !note) return;
  if (isLegacyResearchNote(stored)) {
    const whole = { ...note, ...patch, updatedAt: now() };
    if (batch) batch.set(ref, whole);
    else await setDoc(ref, whole);
  } else if (batch) batch.update(ref, { ...patch, updatedAt: now() });
  else await updateDoc(ref, { ...patch, updatedAt: now() });
}

/** Insert or replace a note as read from storage (edited or created outside Biblio). */
export async function putResearchNote(note: ResearchNote) {
  await setDoc(doc(researchNotesCollection(requireUid()), note.id), note);
}

export async function deleteResearchNote(noteId: string) {
  await deleteDoc(doc(researchNotesCollection(requireUid()), noteId));
}

export async function createFolder(name: string, parentId: string | null = null): Promise<Folder> {
  const uid = requireUid();
  const folder: Folder = { id: crypto.randomUUID(), name: name.trim(), parentId, createdAt: now(), updatedAt: now() };
  await setDoc(doc(foldersCollection(uid), folder.id), folder);
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  await updateDoc(doc(foldersCollection(requireUid()), folderId), { name: name.trim(), updatedAt: now() });
}

export function folderDescendants(folderId: string): string[] {
  const ids = [folderId];
  for (let i = 0; i < ids.length; i += 1) {
    for (const folder of folders.value) if (folder.parentId === ids[i]) ids.push(folder.id);
  }
  return ids;
}

/** Delete a folder and its subfolders. Papers stay in the library; only their membership is removed. */
export async function deleteFolder(folderId: string) {
  const uid = requireUid();
  const removed = new Set(folderDescendants(folderId));
  remember(
    "Delete folder",
    papers.value.filter((p) => p.folderIds.some((id) => removed.has(id))).map((p) => p.id),
    { folders: folders.value.filter((f) => removed.has(f.id)) }
  );
  const batch = writeBatch(db);
  for (const id of removed) batch.delete(doc(foldersCollection(uid), id));
  for (const paper of papers.value) {
    if (paper.folderIds.some((id) => removed.has(id))) {
      batch.update(doc(papersCollection(uid), paper.id), { folderIds: paper.folderIds.filter((id) => !removed.has(id)), updatedAt: now() });
    }
  }
  await batch.commit();
}

/**
 * Replace the whole materialized view with a library read from canonical storage (rebuild,
 * connecting an existing library, or an edit made to library.json outside Biblio).
 */
export async function replaceLibrary(nextPapers: Paper[], nextFolders: Folder[], nextResearchNotes: ResearchNote[] = []) {
  const uid = requireUid();
  const keepPapers = new Set(nextPapers.map((p) => p.id));
  const keepFolders = new Set(nextFolders.map((f) => f.id));
  const keepResearchNotes = new Set(nextResearchNotes.map((n) => n.id));
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [
    ...papers.value.filter((p) => !keepPapers.has(p.id)).map((p) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(papersCollection(uid), p.id))),
    ...folders.value.filter((f) => !keepFolders.has(f.id)).map((f) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(foldersCollection(uid), f.id))),
    ...storedResearchNotes.value.filter((n) => !keepResearchNotes.has(n.id)).map((n) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(researchNotesCollection(uid), n.id))),
    ...nextPapers.map((p) => (b: ReturnType<typeof writeBatch>) => b.set(doc(papersCollection(uid), p.id), p)),
    ...nextFolders.map((f) => (b: ReturnType<typeof writeBatch>) => b.set(doc(foldersCollection(uid), f.id), f)),
    ...nextResearchNotes.map((n) => (b: ReturnType<typeof writeBatch>) => b.set(doc(researchNotesCollection(uid), n.id), n))
  ];
  for (let start = 0; start < ops.length; start += 450) {
    const batch = writeBatch(db);
    ops.slice(start, start + 450).forEach((op) => op(batch));
    await batch.commit();
  }
  undoStack.value = []; // snapshots refer to the replaced records
}

export async function deleteAllUserMetadata() {
  const uid = requireUid();
  const refs = [
    ...papers.value.map((p) => doc(papersCollection(uid), p.id)),
    ...folders.value.map((f) => doc(foldersCollection(uid), f.id)),
    ...storedResearchNotes.value.map((n) => doc(researchNotesCollection(uid), n.id))
  ];
  for (let start = 0; start < refs.length; start += 450) {
    const batch = writeBatch(db);
    refs.slice(start, start + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function deleteProfileDoc() {
  await deleteDoc(userDoc(requireUid()));
}

// --- Export ----------------------------------------------------------------------------------
export function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBibtex(selected: Paper[], filename = "references.bib") {
  downloadText(exportBibtex(selected), filename, "application/x-bibtex;charset=utf-8");
}
