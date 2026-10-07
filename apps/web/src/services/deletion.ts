import type { Paper, ResearchNote } from "@bibliograph/core";
import { trashFile, untrashFile } from "../adapters/googleDrive";
import { syncedNoteFileId, syncedResearchNoteFileId } from "../sync/librarySync";
import { deletePapers, deleteResearchNote } from "./library";
import { useSession } from "./session";

// Deleting from the library deletes from Drive too, so the two never drift apart. Files go to
// Drive's trash (recoverable for 30 days) and Undo takes them back out.

/** Delete papers with their PDFs and note files. All-or-nothing: if Drive fails, nothing is deleted. */
export async function deletePapersEverywhere(papers: Paper[]): Promise<{ trashedFiles: number }> {
  const connected = Boolean(useSession().profile.value?.driveRootFolderId);
  const fileIds = connected
    ? papers.flatMap((p) => [p.pdf?.driveFileId, syncedNoteFileId(p.id)]).filter((id): id is string => Boolean(id))
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
