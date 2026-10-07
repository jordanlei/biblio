import { exportLibraryFiles, importLibraryFiles, inspectLibrary, libraryEntries, type LibraryEntry } from "@biblio/core";
import { unzip, zip, type Unzipped } from "fflate";
import { GoogleDriveFileStore } from "../adapters/googleDrive";
import { connectLibraryFolder, syncNow } from "../sync/librarySync";
import { createDriveFolder, DEFAULT_FOLDER_NAME, libraryFiles } from "./drive";

// Moving a library in and out of this copy. Each copy can only open Drive files it created
// (drive.file), so a library comes in by copying its files into a new folder this copy creates.
// Sources: a .zip from "Download library", Google Drive's own folder download (also a .zip), or
// an unzipped library folder chosen on disk.

/** Download the whole library folder as a .zip (the same files, readable anywhere). */
export async function downloadLibraryZip(): Promise<number> {
  await syncNow(); // so the files include the latest edits
  const entries = await exportLibraryFiles(libraryFiles());
  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) files[`${DEFAULT_FOLDER_NAME}/${entry.path}`] = new Uint8Array(await entry.data.arrayBuffer());
  const zipped = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data))));
  const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `biblio-library-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return entries.length;
}

function unzipFile(file: File): Promise<Unzipped> {
  return file.arrayBuffer().then(
    (buffer) => new Promise((resolve, reject) => unzip(new Uint8Array(buffer), (error, data) => (error ? reject(error) : resolve(data))))
  );
}

/** Chosen files → archive entries: .zip files are opened; files from a folder keep their paths. */
export async function readLibrarySource(chosen: File[]): Promise<LibraryEntry[]> {
  const entries: LibraryEntry[] = [];
  for (const file of chosen) {
    if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
      // Google Drive splits big folders into several .zips; they're merged here.
      for (const [path, data] of Object.entries(await unzipFile(file))) {
        if (!path.endsWith("/")) entries.push({ path, data: new Blob([data as BlobPart]) });
      }
    } else {
      entries.push({ path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, data: file });
    }
  }
  return libraryEntries(entries);
}

/**
 * Import a library into a new Drive folder that this copy owns, then switch to it. The folder
 * Biblio was using (if any) is left untouched in Drive.
 */
export async function importLibrary(entries: LibraryEntry[], onProgress?: (done: number, total: number) => void): Promise<{ papers: number; folderName: string }> {
  const folderName = `${DEFAULT_FOLDER_NAME} (imported ${new Date().toISOString().slice(0, 10)})`;
  const folder = await createDriveFolder(folderName);
  const files = new GoogleDriveFileStore(folder.id, true);
  const { papers } = await importLibraryFiles(files, entries, onProgress);
  if (!(await inspectLibrary(files))) throw new Error("The library didn't arrive in Drive completely. Try importing again.");
  await connectLibraryFolder(folder, () => true);
  return { papers, folderName };
}
