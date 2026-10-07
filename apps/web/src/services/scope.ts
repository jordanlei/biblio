import type { Paper, ReadingStatus } from "@biblio/core";
import type { LocationQuery } from "vue-router";
import { folderDescendants, useLibrary } from "./library";

export type SmartView = "all" | "recent";

export const smartViews: Array<{ id: SmartView; label: string; icon: string }> = [
  { id: "all", label: "All papers", icon: "library" },
  { id: "recent", label: "Recently added", icon: "clock" }
];

/** Toolbar filters that combine with any view, folder, or tag (`?pdf=has|missing&notes=1&untagged=1`). */
export interface ListFilters {
  pdf: "" | "has" | "missing";
  notes: boolean;
  untagged: boolean;
  status: "" | ReadingStatus;
}

/** The three shelves. Anything more specific is a tag. */
export const readingStatuses: Array<{ id: ReadingStatus; label: string; key: string }> = [
  { id: "toRead", label: "To read", key: "1" },
  { id: "skimming", label: "Skimming", key: "2" },
  { id: "read", label: "Read", key: "3" }
];

/** Older statuses map onto the three; a library written before the change still reads cleanly. */
const legacyReadingStatus: Partial<Record<ReadingStatus, ReadingStatus | undefined>> = {
  inbox: "toRead",
  readNext: "toRead",
  tbr: "toRead",
  reading: "skimming",
  skimmed: "skimming",
  reference: undefined,
  parked: undefined
};

/** The shelf a stored value belongs to now (undefined = no shelf). */
export function normalizeReadingStatus(status?: ReadingStatus): ReadingStatus | undefined {
  if (!status) return undefined;
  return readingStatuses.some((r) => r.id === status) ? status : legacyReadingStatus[status];
}

export function readingStatusLabel(status?: ReadingStatus) {
  return readingStatuses.find((r) => r.id === normalizeReadingStatus(status))?.label;
}

export function filtersFromQuery(query: LocationQuery): ListFilters {
  const pdf = query.pdf === "has" || query.pdf === "missing" ? query.pdf : "";
  const status = readingStatuses.find((r) => r.id === query.status)?.id ?? "";
  return { pdf, notes: query.notes === "1", untagged: query.untagged === "1", status };
}

export function matchesFilters(paper: Paper, f: ListFilters): boolean {
  if (f.pdf === "has" && !paper.pdf) return false;
  if (f.pdf === "missing" && paper.pdf) return false;
  if (f.notes && !paper.notesMarkdown?.trim()) return false;
  if (f.untagged && paper.tags.length) return false;
  if (f.status && normalizeReadingStatus(paper.readingStatus) !== f.status) return false;
  return true;
}

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

export interface Scope {
  kind: "view" | "folder" | "tag";
  id: string;
  label: string;
  matches: (paper: Paper) => boolean;
}

/** Turn `/library?folder=…|tag=…|view=…` into a label and a paper predicate. Folders include subfolders. */
export function scopeFromQuery(query: LocationQuery): Scope {
  const { folders } = useLibrary();
  if (typeof query.folder === "string") {
    const folderId = query.folder;
    const ids = new Set(folderDescendants(folderId));
    const name = folders.value.find((f) => f.id === folderId)?.name ?? "Folder";
    return { kind: "folder", id: folderId, label: name, matches: (p) => p.folderIds.some((id) => ids.has(id)) };
  }
  if (typeof query.tag === "string") {
    const tag = query.tag;
    return { kind: "tag", id: tag, label: `#${tag}`, matches: (p) => p.tags.includes(tag) };
  }
  const view = (smartViews.find((v) => v.id === query.view)?.id ?? "all") as SmartView;
  const label = smartViews.find((v) => v.id === view)!.label;
  const since = Date.now() - RECENT_MS;
  const predicates: Record<SmartView, (p: Paper) => boolean> = {
    all: () => true,
    recent: (p) => Date.parse(p.createdAt) >= since
  };
  return { kind: "view", id: view, label, matches: predicates[view] };
}
