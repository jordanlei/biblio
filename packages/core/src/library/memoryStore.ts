import { StorageUnavailableError, type FileStore, type StoredFile } from "./ports";

/** In-memory FileStore: the reference adapter, used in tests. `offline = true` simulates an outage. */
export class MemoryFileStore implements FileStore {
  offline = false;
  writes = 0;
  readonly files = new Map<string, { file: StoredFile; content: string | Blob }>();
  private nextId = 1;

  private check() {
    if (this.offline) throw new StorageUnavailableError("Storage is offline");
  }

  private dirOf(path: string) {
    return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  }

  async list(dir: string) {
    this.check();
    return [...this.files.values()].filter((e) => this.dirOf(e.file.path) === dir).map((e) => ({ ...e.file }));
  }

  async readText(file: StoredFile) {
    this.check();
    const entry = [...this.files.values()].find((e) => e.file.id === file.id);
    if (!entry) throw new Error(`No file ${file.id}`);
    return typeof entry.content === "string" ? entry.content : await entry.content.text();
  }

  async readBlob(file: StoredFile) {
    this.check();
    const entry = [...this.files.values()].find((e) => e.file.id === file.id);
    if (!entry) throw new Error(`No file ${file.id}`);
    return typeof entry.content === "string" ? new Blob([entry.content]) : entry.content;
  }

  private put(path: string, content: string | Blob, existing?: StoredFile): StoredFile {
    this.check();
    this.writes += 1;
    const current = (existing && [...this.files.values()].find((e) => e.file.id === existing.id)) ?? this.files.get(path);
    if (current) this.files.delete(current.file.path);
    const file: StoredFile = {
      id: current?.file.id ?? `f${this.nextId++}`,
      path, // updating a file under a new name renames it
      version: String(Number(current?.file.version ?? 0) + 1)
    };
    this.files.set(file.path, { file, content });
    return { ...file };
  }

  async writeText(path: string, content: string, _mime: string, existing?: StoredFile) {
    return this.put(path, content, existing);
  }

  async writeBlob(path: string, content: Blob, _mime: string, existing?: StoredFile) {
    return this.put(path, content, existing);
  }

  async moveInto(fileId: string, dir: string) {
    this.check();
    const entry = [...this.files.values()].find((e) => e.file.id === fileId);
    if (!entry) throw new Error(`No file ${fileId}`);
    this.files.delete(entry.file.path);
    entry.file = { ...entry.file, path: `${dir}/${entry.file.path.split("/").pop()}` };
    this.files.set(entry.file.path, entry);
    return { ...entry.file };
  }

  async remove(fileId: string) {
    this.check();
    for (const [path, entry] of this.files) if (entry.file.id === fileId) this.files.delete(path);
  }

  /** Simulate someone editing a file outside Biblio. */
  editOutside(path: string, content: string) {
    const entry = this.files.get(path);
    if (!entry) throw new Error(`No file at ${path}`);
    entry.content = content;
    entry.file = { ...entry.file, version: String(Number(entry.file.version) + 1) };
  }

  text(path: string) {
    const content = this.files.get(path)?.content;
    return typeof content === "string" ? content : undefined;
  }
}
