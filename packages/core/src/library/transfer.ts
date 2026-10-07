import { LIBRARY_PATHS, parseLibrary } from "./format";
import type { FileStore, StoredFile } from "./ports";

// Moving a library between copies of Biblio (or in from a backup): the whole library folder
// as a set of files, e.g. a .zip. Each copy only has access to Drive files it created itself, so a
// library is moved by copying its files into a new folder, never by pointing at someone else's.

export interface LibraryEntry {
  /** Library-relative path, e.g. "notes/vaswaniAttentionNeed2017.md". */
  path: string;
  data: Blob;
}

const DIRS = [LIBRARY_PATHS.notesDir, LIBRARY_PATHS.papersDir];

/** Is this one of the library's own files (not a stray .DS_Store, or a file in some other folder)? */
export function isLibraryPath(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((part) => !part || part.startsWith("."))) return false;
  if (parts.length === 1) return /\.(json|md|bib)$/i.test(path);
  if (parts.length !== 2 || !DIRS.includes(parts[0] as (typeof DIRS)[number])) return false;
  return parts[0] === LIBRARY_PATHS.papersDir ? /\.pdf$/i.test(path) : /\.md$/i.test(path);
}

/**
 * Where the library starts inside an archive: the folder holding library.json ("" for the top).
 * Google Drive's "Download" wraps a folder in another folder, so the root can be a level or two down.
 */
export function findLibraryRoot(paths: string[]): string | null {
  const roots = paths
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => p === LIBRARY_PATHS.library || p.endsWith(`/${LIBRARY_PATHS.library}`))
    .map((p) => p.slice(0, -LIBRARY_PATHS.library.length));
  if (!roots.length) return null;
  return roots.sort((a, b) => a.length - b.length)[0];
}

/** Archive entries → the library's own files, relative to its root. Throws if there's no library. */
export function libraryEntries(entries: LibraryEntry[]): LibraryEntry[] {
  const root = findLibraryRoot(entries.map((e) => e.path));
  if (root === null) throw new Error("This doesn't contain a Biblio library: there's no library.json in it.");
  return entries
    .map((e) => ({ ...e, path: e.path.replace(/\\/g, "/") }))
    .filter((e) => e.path.startsWith(root))
    .map((e) => ({ ...e, path: e.path.slice(root.length) }))
    .filter((e) => isLibraryPath(e.path));
}

/** Every file in the library folder, for a download. */
export async function exportLibraryFiles(files: FileStore): Promise<LibraryEntry[]> {
  const listed: StoredFile[] = (await Promise.all(["", ...DIRS].map((dir) => files.list(dir)))).flat();
  const out: LibraryEntry[] = [];
  for (const file of listed.filter((f) => isLibraryPath(f.path))) out.push({ path: file.path, data: await files.readBlob(file) });
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const MIME: Record<string, string> = { json: "application/json", md: "text/markdown", bib: "application/x-bibtex", pdf: "application/pdf" };

/**
 * Write a library's files into an (empty) folder. Checks library.json first so a wrong archive
 * fails before anything is written. Returns how many papers the library holds.
 */
export async function importLibraryFiles(files: FileStore, entries: LibraryEntry[], onProgress?: (done: number, total: number) => void): Promise<{ papers: number; files: number }> {
  const library = entries.find((e) => e.path === LIBRARY_PATHS.library);
  const manifest = entries.find((e) => e.path === LIBRARY_PATHS.manifest);
  if (!library) throw new Error("This doesn't contain a Biblio library: there's no library.json in it.");
  const parsed = parseLibrary(manifest ? await manifest.data.text() : null, await library.data.text(), new Date().toISOString());

  const write = async (entry: LibraryEntry) => {
    const mime = MIME[entry.path.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
    if (mime === "application/pdf") await files.writeBlob(entry.path, entry.data, mime);
    else await files.writeText(entry.path, await entry.data.text(), mime);
    onProgress?.(++done, entries.length);
  };
  let done = 0;
  const rest = entries.filter((e) => e !== library);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, rest.length) }, async () => {
    while (next < rest.length) await write(rest[next++]);
  }));
  // library.json last: until it exists, a half-finished import isn't mistaken for a library.
  await write(library);
  return { papers: parsed.papers.length, files: entries.length };
}
