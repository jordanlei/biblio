import { findDuplicateGroups, mergePaperPatch, replaceCitationKey, type DuplicateGroup, type Paper } from "@biblio/core";
import { computed } from "vue";
import { deletePapersEverywhere } from "./deletion";
import { rewriteCitationLinks, updatePaper, useLibrary } from "./library";

const { papers } = useLibrary();

/** Live duplicate groups across the library (best record first in each). */
export const duplicateGroups = computed<DuplicateGroup[]>(() => findDuplicateGroups(papers.value));

/** The group a paper belongs to, if any. */
export function duplicateGroupOf(paperId: string): DuplicateGroup | undefined {
  return duplicateGroups.value.find((g) => g.papers.some((p) => p.id === paperId));
}

/**
 * Fold `drops` into `keep`: fill its empty fields, combine tags, folders and notes, point every
 * `@[dropKey]` link at it, then delete the others (their note files go to Drive's trash; a PDF
 * that moved to `keep` is spared).
 */
export async function mergeInto(keep: Paper, drops: Paper[]) {
  let current = keep;
  let patch: Partial<Paper> = {};
  for (const drop of drops) {
    const next = mergePaperPatch(current, drop);
    patch = { ...patch, ...next };
    current = { ...current, ...next };
  }
  if (patch.notesMarkdown) for (const drop of drops) patch.notesMarkdown = replaceCitationKey(patch.notesMarkdown, drop.citationKey, keep.citationKey);
  if (Object.keys(patch).length) await updatePaper(keep.id, patch, "Merge duplicates");
  for (const drop of drops) await rewriteCitationLinks(drop.citationKey, keep.citationKey);
  const movedPdf = current.pdf?.driveFileId;
  await deletePapersEverywhere(drops, { spareFileIds: movedPdf ? [movedPdf] : [] });
}
