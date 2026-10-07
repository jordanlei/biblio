import { allocateCitationKey, generateCitationKey } from "./citationKey";
import { normalizeArxivId, normalizeDoi, normalizeIdentifier, normalizeTitle } from "./normalize";
import type { Paper, PaperCandidate } from "./types";

/**
 * The single path from an ingestion candidate (manual, search, identifier lookup, BibTeX import,
 * extension) to a canonical Paper. Allocates a citation key that is unique among `existingKeys`.
 */
export function buildPaper(candidate: PaperCandidate, options: { id: string; existingKeys: Iterable<string>; now: string }): Paper {
  const citationKey = candidate.citationKey?.trim()
    ? allocateCitationKey(candidate.citationKey.trim(), options.existingKeys)
    : generateCitationKey({
        title: candidate.title,
        authors: candidate.authors,
        year: candidate.issued?.year,
        existingKeys: options.existingKeys
      });
  const paper: Paper = {
    id: options.id,
    citationKey,
    type: candidate.type ?? "article",
    title: normalizeTitle(candidate.title) || "Untitled",
    authors: candidate.authors ?? [],
    editors: candidate.editors?.length ? candidate.editors : undefined,
    issued: candidate.issued,
    containerTitle: candidate.containerTitle,
    volume: candidate.volume,
    issue: candidate.issue,
    pages: candidate.pages,
    publisher: candidate.publisher,
    publisherPlace: candidate.publisherPlace,
    isbn: candidate.isbn,
    doi: normalizeDoi(candidate.doi),
    arxivId: normalizeArxivId(candidate.arxivId),
    pmid: normalizeIdentifier(candidate.pmid),
    semanticScholarId: normalizeIdentifier(candidate.semanticScholarId),
    url: candidate.url,
    openAccessPdfUrl: candidate.openAccessPdfUrl,
    abstract: candidate.abstract,
    tags: candidate.tags ?? [],
    folderIds: candidate.folderIds ?? [],
    notesMarkdown: candidate.notesMarkdown ?? "",
    readingStatus: candidate.readingStatus,
    savedBecause: candidate.savedBecause?.trim() || undefined,
    source: candidate.source ?? "manual",
    createdAt: options.now,
    updatedAt: options.now
  };
  // Firestore rejects undefined values; drop them so records stay clean.
  return Object.fromEntries(Object.entries(paper).filter(([, value]) => value !== undefined)) as Paper;
}
