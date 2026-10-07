import { defaultPdfPath, type Paper, type StoredFile } from "@bibliograph/core";
import {
  GoogleDriveFileStore,
  MOCK_DRIVE_BASE,
  createFolder,
  deleteFile,
  fileExists,
  trashFile,
  untrashFile,
  folderUrl,
  listVisibleFolders,
  openUrl
} from "../adapters/googleDrive";
import { firebaseConfig, pickerApiKey } from "../firebase";
import { updatePaper } from "./library";
import { downloadPdf, findPdfSources } from "./pdfFetch";
import { getGoogleAccessToken, hasGoogleAccessToken, updateProfile, useSession } from "./session";

// App-level Drive actions (connect a library folder, attach/find/remove PDFs). Provider details
// live in adapters/googleDrive.ts; the library's text files are written by the sync engine.

export const DEFAULT_FOLDER_NAME = "Bibliograph Library";
export { DriveFileMissingError } from "../adapters/googleDrive";

export interface DriveFolderSelection {
  id: string;
  name: string;
}

declare global {
  interface Window {
    gapi?: { load: (api: string, callback: () => void) => void };
    google?: { picker?: any };
  }
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

let pickerLoader: Promise<void> | null = null;
function loadPickerApi(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  pickerLoader ??= new Promise((resolve, reject) => {
    const finish = () => window.gapi?.load("picker", () => resolve());
    if (window.gapi) return finish();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("Google Picker could not be loaded."));
    document.head.appendChild(script);
  });
  return pickerLoader;
}

/** Let the user choose an existing Drive folder (Google Picker; a simple list against the mock Drive). */
export async function pickDriveFolder(): Promise<DriveFolderSelection | null> {
  if (MOCK_DRIVE_BASE) {
    const folders = await listVisibleFolders();
    if (!folders.length) throw new Error("The mock Drive has no folders yet. Create one instead.");
    const answer = prompt(`Mock Drive folders:\n${folders.map((f, i) => `${i + 1}. ${f.name} [${f.id}]`).join("\n")}\n\nEnter a number:`, "1");
    return (answer ? folders[Number(answer) - 1] : undefined) ?? null;
  }

  if (!pickerApiKey) throw new Error("Choosing an existing folder needs a Google Picker key, which this copy doesn't have yet. Run `npm run setup` again to create one.");
  const token = await getGoogleAccessToken();
  await loadPickerApi();
  const picker = window.google?.picker;
  if (!picker) throw new Error("Google Picker is unavailable.");
  return new Promise((resolve, reject) => {
    try {
      const view = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder")
        .setMode(picker.DocsViewMode.LIST);
      new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.NAV_HIDDEN)
        .setOAuthToken(token)
        .setDeveloperKey(pickerApiKey)
        .setAppId(firebaseConfig.messagingSenderId)
        .setCallback((data: Record<string, any>) => {
          const action = data[picker.Response.ACTION];
          if (action === picker.Action.CANCEL) return resolve(null);
          if (action !== picker.Action.PICKED) return;
          const [doc] = data[picker.Response.DOCUMENTS] ?? [];
          if (!doc?.[picker.Document.ID]) return reject(new Error("No folder was selected."));
          resolve({ id: doc[picker.Document.ID], name: doc[picker.Document.NAME] ?? "Selected folder" });
        })
        .build()
        .setVisible(true);
    } catch (error) {
      reject(error);
    }
  });
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
