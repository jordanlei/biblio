import { defaultPdfPath, type Paper, type ResearchNote } from "@biblio/core";
import { trashFile, untrashFile } from "../../adapters/googleDrive";
import { syncedNoteFileId, syncedResearchNoteFileId } from "../../sync/librarySync";
import { libraryFiles } from "../drive";
import { deletePapers, deleteResearchNote, useLibrary } from "./library";
import { useSession } from "../session";

// Deleting from the library deletes from Drive too, so the two never drift apart. Files go to
// Drive's trash (recoverable for 30 days) and Undo takes them back out.

/** Delete papers with their PDFs and note files. All-or-nothing: if Drive fails, nothing is deleted. */
export async function deletePapersEverywhere(papers: Paper[]): Promise<{ trashedFiles: number }> {
  const connected = Boolean(useSession().profile.value?.driveRootFolderId);
  const fileIds = connected
    ? [...new Set([...papers.flatMap((p) => [p.pdf?.driveFileId, syncedNoteFileId(p.id)]), ...(await strayPdfIds(papers))])].filter((id): id is string => Boolean(id))
    : [];
  const trashed: string[] = [];
  try {
    for (const id of fileIds) {
      await trashFile(id);
      trashed.push(id);
    }
  } catch (error) {
    await Promise.allSettled(trashed.map(untrashFile));
    throw error;
  }
  await deletePapers(
    papers.map((p) => p.id),
    trashed.length ? async () => void (await Promise.all(trashed.map(untrashFile))) : undefined
  );
  return { trashedFiles: trashed.length };
}

/**
 * PDFs in papers/ that carry a deleted paper's name but that its record doesn't point to (an
 * upload that never got linked, a copy dropped in by hand). Files another paper uses are kept.
 */
async function strayPdfIds(papers: Paper[]): Promise<string[]> {
  const deleting = new Set(papers.map((p) => p.id));
  const names = new Set(papers.flatMap((p) => [defaultPdfPath(p), p.pdf && `papers/${p.pdf.filename}`]).filter(Boolean));
  const keep = new Set(useLibrary().papers.value.filter((p) => !deleting.has(p.id)).flatMap((p) => [p.pdf?.driveFileId, p.pdf && `papers/${p.pdf.filename}`]));
  try {
    const files = await libraryFiles().list("papers");
    return files.filter((f) => names.has(f.path) && !keep.has(f.id) && !keep.has(f.path)).map((f) => f.id);
  } catch {
    return []; // Listing is a sweep for leftovers; the linked PDF is still trashed.
  }
}

/** Delete a research note and move its Markdown file to Drive's trash. */
export async function deleteResearchNoteEverywhere(note: ResearchNote): Promise<void> {
  const connected = Boolean(useSession().profile.value?.driveRootFolderId);
  const fileId = connected ? syncedResearchNoteFileId(note.id) : undefined;
  if (fileId) await trashFile(fileId);
  try {
    await deleteResearchNote(note.id);
  } catch (error) {
    if (fileId) await untrashFile(fileId).catch(() => {});
    throw error;
  }
}
