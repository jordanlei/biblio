import { defaultPdfPath, inspectLibrary, type Paper, type StoredFile } from "@biblio/core";
import {
  GoogleDriveFileStore,
  createFolder,
  deleteFile,
  fileExists,
  trashFile,
  untrashFile,
  folderUrl,
  listVisibleFolders,
  openUrl
} from "../adapters/googleDrive";
import { updatePaper } from "./library";
import { downloadPdf, findPdfSources } from "./pdfFetch";
import { hasGoogleAccessToken, updateProfile, useSession } from "./session";

// App-level Drive actions (connect a library folder, attach/find/remove PDFs). Provider details
// live in adapters/googleDrive.ts; the library's text files are written by the sync engine.

export const DEFAULT_FOLDER_NAME = "Biblio Library";
export { DriveFileMissingError } from "../adapters/googleDrive";

export interface DriveFolderSelection {
  id: string;
  name: string;
}

export async function createDriveFolder(name = DEFAULT_FOLDER_NAME): Promise<DriveFolderSelection> {
  return createFolder(name);
}

export async function connectDriveFolder(folder: DriveFolderSelection) {
  await updateProfile({ driveConnected: true, driveRootFolderId: folder.id, driveRootFolderName: folder.name });
}

export async function disconnectDriveFolder() {
  await updateProfile({ driveConnected: false, driveRootFolderId: null, driveRootFolderName: null });
}

/**
 * Library folders this copy created earlier (e.g. before its index was reset), newest first.
 * drive.file only lets a copy see its own folders, so this never lists anyone else's files.
 */
export interface OwnLibrary extends DriveFolderSelection {
  /** How many papers it holds, so several same-named folders can be told apart. */
  papers: number;
}

/**
 * Library folders this copy created earlier, newest first. Several can accumulate — a reset index,
 * a few imports — and they often share a name, so each carries its paper count.
 */
export async function findOwnLibraries(interactive = true, limit = 4): Promise<OwnLibrary[]> {
  const folders = await listVisibleFolders(interactive);
  const found: OwnLibrary[] = [];
  // Newest first: the most recently created folder is the one most likely to be wanted.
  for (const folder of [...folders].reverse()) {
    const library = await inspectLibrary(new GoogleDriveFileStore(folder.id, interactive));
    if (library) found.push({ ...folder, papers: library.papers });
    if (found.length >= limit) break;
  }
  return found;
}

/** The connected library folder as a FileStore, for user-initiated actions (may prompt). */
export function libraryFiles(): GoogleDriveFileStore {
  const rootId = useSession().profile.value?.driveRootFolderId;
  if (!rootId) throw new Error("Connect a Google Drive folder first.");
  return new GoogleDriveFileStore(rootId, true);
}

function isPdf(file: File) {
  return file.type === "application/pdf" || (!file.type && file.name.toLowerCase().endsWith(".pdf"));
}

/**
 * Upload a PDF to the library's papers/ folder and record it on the paper. Replacing reuses the
 * existing file (keeps its ID and sharing) when it still exists.
 */
export async function attachPdf(paper: Paper, file: File, sourceUrl?: string) {
  if (!isPdf(file)) throw new Error("That file isn't a PDF.");
  const path = paper.pdf ? `papers/${paper.pdf.filename}` : defaultPdfPath(paper);
  const existing: StoredFile | undefined = paper.pdf ? { id: paper.pdf.driveFileId, path, version: "" } : undefined;
  const stored = await libraryFiles().writeBlob(path, file, "application/pdf", existing);
  await updatePaper(paper.id, {
    pdf: {
      driveFileId: stored.id,
      filename: stored.path.split("/").pop() ?? stored.path,
      mimeType: "application/pdf",
      addedAt: new Date().toISOString(),
      ...(sourceUrl ? { sourceUrl } : {})
    }
  });
}

/**
 * Find an open-access copy of the paper and save it to Drive. `onStep` reports progress
 * ("Looking for an open-access copy…", "Downloading from arXiv…", "Saving to Drive…").
 */
export async function grabPdf(paper: Paper, onStep: (message: string) => void = () => undefined) {
  onStep("Looking for an open-access copy…");
  const sources = await findPdfSources(paper);
  const { blob, source } = await downloadPdf(sources, onStep);
  onStep("Saving to your Drive…");
  await attachPdf(paper, new File([blob], `${paper.citationKey}.pdf`, { type: "application/pdf" }), source.url);
  return source;
}

/** Remove a paper's PDF: the file moves to the Drive trash, and Undo brings it back. */
export async function removePdf(paper: Paper) {
  if (!paper.pdf) return;
  const fileId = paper.pdf.driveFileId;
  await trashFile(fileId);
  await updatePaper(paper.id, { pdf: undefined }, { label: "Remove PDF", restore: () => untrashFile(fileId) });
}

export const deleteDriveFile = deleteFile;

/** Move the whole library folder to the Drive trash (account deletion, when the user asks). */
export async function trashLibraryFolder() {
  const rootId = useSession().profile.value?.driveRootFolderId;
  if (rootId) await trashFile(rootId);
}

/** Quietly check whether a PDF still exists, without prompting for consent. `null` means unknown. */
export async function driveFileExists(fileId: string): Promise<boolean | null> {
  return hasGoogleAccessToken() ? fileExists(fileId) : null;
}

export const driveOpenUrl = openUrl;
export const driveFolderUrl = folderUrl;
