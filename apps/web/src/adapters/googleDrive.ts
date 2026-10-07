import { StorageAuthError, StorageUnavailableError, type FileStore, type StoredFile } from "@bibliograph/core";
import { clearGoogleAccessToken, getGoogleAccessToken } from "../services/session";

// Google Drive adapter: every Drive REST detail lives here. The rest of the app talks to it
// through the core FileStore port (library files) or the few helpers below (folders, links).
// Scope is full Drive (see makeGoogleProvider): any copy of Bibliograph can open a library folder,
// whoever created its files. The app only reads and writes inside the chosen library folder.

// VITE_DRIVE_API_BASE points at the mock Drive server in local test mode.
export const MOCK_DRIVE_BASE = import.meta.env.VITE_DRIVE_API_BASE as string | undefined;
const BASE = MOCK_DRIVE_BASE ?? "https://www.googleapis.com";
const API = `${BASE}/drive/v3`;
const UPLOAD = `${BASE}/upload/drive/v3`;
export const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const FILE_FIELDS = "id,name,version,modifiedTime";

export class DriveFileMissingError extends Error {}

/**
 * fetch() against Drive with the cached Google token. Errors are mapped to the core's storage
 * errors so sync can tell "try again later" from "the user must reconnect".
 */
export async function driveRequest(url: string, init: RequestInit = {}, interactive = true): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = interactive ? await getGoogleAccessToken() : await getGoogleAccessToken({ interactive: false });
    if (!token) throw new StorageAuthError("Reconnect Google Drive to keep your library in sync.");
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    } catch {
      throw new StorageUnavailableError("Google Drive can't be reached right now.");
    }
    if (response.status === 401) {
      clearGoogleAccessToken();
      if (interactive && attempt === 0) continue;
      throw new StorageAuthError("Your Google Drive session expired. Reconnect to keep syncing.");
    }
    if (response.status === 403 && /insufficient|scope/i.test(await response.clone().text())) {
      // A token from before the full-Drive permission, or one where the Drive box was unticked
      // on Google's consent screen: ask again.
      clearGoogleAccessToken();
      if (interactive && attempt === 0) continue;
      throw new StorageAuthError("Bibliograph needs permission to your Google Drive. Reconnect and allow Drive access.");
    }
    if (response.status === 404) throw new DriveFileMissingError("That file is no longer in Google Drive.");
    if (response.status === 429 || response.status >= 500) throw new StorageUnavailableError(`Google Drive is temporarily unavailable (${response.status}).`);
    if (!response.ok) throw new Error(`Google Drive error ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return response;
  }
  throw new StorageAuthError("Google Drive rejected the access token.");
}

export async function createFolder(name: string, parentId?: string, interactive = true): Promise<{ id: string; name: string }> {
  const response = await driveRequest(
    `${API}/files?fields=id,name`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, ...(parentId ? { parents: [parentId] } : {}) }) },
    interactive
  );
  return (await response.json()) as { id: string; name: string };
}

export async function deleteFile(fileId: string) {
  try {
    await driveRequest(`${API}/files/${fileId}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof DriveFileMissingError)) throw error;
  }
}

/** Move a file (or folder, with its contents) to the Drive trash: recoverable for 30 days. */
export async function trashFile(fileId: string) {
  try {
    await driveRequest(`${API}/files/${fileId}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
  } catch (error) {
    if (!(error instanceof DriveFileMissingError)) throw error;
  }
}

/** Take a file back out of the trash (used by Undo). */
export async function untrashFile(fileId: string) {
  await driveRequest(`${API}/files/${fileId}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: false }) });
}

/** Quietly check whether a file exists, without prompting. `null` means unknown. */
export async function fileExists(fileId: string): Promise<boolean | null> {
  try {
    await driveRequest(`${API}/files/${fileId}?fields=id`, {}, false);
    return true;
  } catch (error) {
    return error instanceof DriveFileMissingError ? false : null;
  }
}

export function openUrl(fileId: string): string {
  return MOCK_DRIVE_BASE ? `${BASE}/view/${fileId}` : `https://drive.google.com/file/d/${fileId}/view`;
}

export function folderUrl(folderId: string): string {
  return MOCK_DRIVE_BASE ? `${BASE}/` : `https://drive.google.com/drive/folders/${folderId}`;
}

/** List folders the app can see (mock Drive only; real Drive uses the Picker). */
export async function listVisibleFolders(): Promise<Array<{ id: string; name: string }>> {
  const response = await driveRequest(`${API}/files?q=${encodeURIComponent(`mimeType='${FOLDER_MIME_TYPE}'`)}&fields=files(id,name,parents)`);
  const { files } = (await response.json()) as { files: Array<{ id: string; name: string; parents?: string[] }> };
  // Only top-level library folders, not their notes/ and papers/ subfolders.
  const ids = new Set(files.map((f) => f.id));
  return files.filter((f) => !(f.parents ?? []).some((p) => ids.has(p)));
}

/** The canonical library as a FileStore rooted at the user's library folder. */
export class GoogleDriveFileStore implements FileStore {
  /** Positive lookups only: "doesn't exist yet" is never cached, so another writer's new folder is found. */
  private dirIds = new Map<string, Promise<string[]>>();

  constructor(
    private readonly rootId: string,
    private readonly interactive = false
  ) {
    this.dirIds.set("", Promise.resolve([rootId]));
  }

  private request(url: string, init?: RequestInit) {
    return driveRequest(url, init, this.interactive);
  }

  /**
   * All folders with this name under the library root. Drive allows duplicate names (two devices
   * can race to create papers/), so readers merge them rather than trusting the first.
   */
  private async dirIdsFor(dir: string): Promise<string[]> {
    const known = this.dirIds.get(dir);
    if (known) return known;
    const q = `'${this.rootId}' in parents and name = '${dir.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`;
    const response = await this.request(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)`);
    const ids = ((await response.json()) as { files: Array<{ id: string }> }).files.map((f) => f.id);
    if (ids.length) this.dirIds.set(dir, Promise.resolve(ids));
    return ids;
  }

  /** The folder to write into, created on first use. */
  private async dirId(dir: string): Promise<string> {
    const existing = await this.dirIdsFor(dir);
    if (existing.length) return existing[0];
    const pending = this.dirIds.get(dir);
    if (pending) return (await pending)[0];
    const creating = createFolder(dir, this.rootId, this.interactive).then((created) => [created.id]);
    this.dirIds.set(dir, creating);
    creating.catch(() => this.dirIds.delete(dir));
    return (await creating)[0];
  }

  private stored(dir: string, file: { id: string; name: string; version?: string; modifiedTime?: string }): StoredFile {
    return { id: file.id, path: dir ? `${dir}/${file.name}` : file.name, version: String(file.version ?? ""), modifiedTime: file.modifiedTime };
  }

  async list(dir: string): Promise<StoredFile[]> {
    const out: StoredFile[] = [];
    for (const id of await this.dirIdsFor(dir)) {
      let pageToken = "";
      do {
        const q = `'${id}' in parents and trashed = false and mimeType != '${FOLDER_MIME_TYPE}'`;
        const url = `${API}/files?q=${encodeURIComponent(q)}&pageSize=1000&fields=nextPageToken,files(${FILE_FIELDS})${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const data = (await (await this.request(url)).json()) as { nextPageToken?: string; files: Array<{ id: string; name: string; version?: string; modifiedTime?: string }> };
        out.push(...data.files.map((f) => this.stored(dir, f)));
        pageToken = data.nextPageToken ?? "";
      } while (pageToken);
    }
    return out;
  }

  async readText(file: StoredFile): Promise<string> {
    return (await this.request(`${API}/files/${file.id}?alt=media`)).text();
  }

  private async upload(path: string, content: Blob, mimeType: string, existing?: StoredFile): Promise<StoredFile> {
    const slash = path.lastIndexOf("/");
    const dir = slash === -1 ? "" : path.slice(0, slash);
    const name = path.slice(slash + 1);
    const form = new FormData();
    const parentId = existing ? null : await this.dirId(dir);
    // Updating under a different name renames the file (research notes follow their titles).
    const renamed = existing && existing.path.slice(existing.path.lastIndexOf("/") + 1) !== name;
    const metadata = existing ? { mimeType, ...(renamed ? { name } : {}) } : { name, mimeType, parents: [parentId] };
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", content);
    const url = existing
      ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&fields=${FILE_FIELDS}`
      : `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`;
    try {
      const response = await this.request(url, { method: existing ? "PATCH" : "POST", body: form });
      return this.stored(dir, (await response.json()) as { id: string; name: string; version?: string });
    } catch (error) {
      // The file we meant to update was deleted in Drive: create it afresh.
      if (existing && error instanceof DriveFileMissingError) return this.upload(path, content, mimeType);
      throw error;
    }
  }

  writeText(path: string, content: string, mimeType: string, existing?: StoredFile) {
    return this.upload(path, new Blob([content], { type: mimeType }), mimeType, existing);
  }

  writeBlob(path: string, content: Blob, mimeType: string, existing?: StoredFile) {
    return this.upload(path, content, mimeType, existing);
  }

  async moveInto(fileId: string, dir: string): Promise<StoredFile> {
    const all = await this.dirIdsFor(dir);
    const target = all[0] ?? (await this.dirId(dir));
    const current = (await (await this.request(`${API}/files/${fileId}?fields=parents`)).json()) as { parents?: string[] };
    if ((current.parents ?? []).some((p) => all.includes(p))) {
      const meta = (await (await this.request(`${API}/files/${fileId}?fields=${FILE_FIELDS}`)).json()) as { id: string; name: string; version?: string };
      return this.stored(dir, meta); // already in (a copy of) this folder
    }
    const remove = (current.parents ?? []).filter((p) => p !== target).join(",");
    const url = `${API}/files/${fileId}?addParents=${target}${remove ? `&removeParents=${remove}` : ""}&fields=${FILE_FIELDS}`;
    const moved = (await (await this.request(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })).json()) as {
      id: string;
      name: string;
      version?: string;
    };
    return this.stored(dir, moved);
  }

  async remove(fileId: string) {
    await deleteFile(fileId);
  }
}
