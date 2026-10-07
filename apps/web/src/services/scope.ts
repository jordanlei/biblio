import type { Paper, ReadingStatus } from "@bibliograph/core";
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

export const readingStatuses: Array<{ id: ReadingStatus; label: string; key: string; quiet?: boolean }> = [
  { id: "inbox", label: "Inbox", key: "1" },
  { id: "readNext", label: "Read next", key: "2" },
  { id: "skimming", label: "Skimming", key: "3" },
  { id: "reading", label: "Reading", key: "4" },
  { id: "read", label: "Read", key: "5" },
  { id: "reference", label: "Reference", key: "6", quiet: true },
  { id: "parked", label: "Parked", key: "7", quiet: true }
];

export const legacyReadingStatusLabels: Partial<Record<ReadingStatus, string>> = {
  tbr: "To read",
  skimmed: "Skimmed"
};

export function readingStatusLabel(status?: ReadingStatus) {
  return readingStatuses.find((r) => r.id === status)?.label ?? (status ? legacyReadingStatusLabels[status] : undefined);
}

export function isQuietShelf(status?: ReadingStatus) {
  return status === "reference" || status === "parked";
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
  if (f.status && paper.readingStatus !== f.status) return false;
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
