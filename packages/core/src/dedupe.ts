import {
  firstCreatorFamily,
  normalizeArxivId,
  normalizeDoi,
  normalizeIdentifier,
  normalizeTitleKey
} from "./normalize";
import type { DuplicateResult, Paper, PaperCandidate } from "./types";

export function findExistingPaper(candidate: PaperCandidate, papers: Paper[]): DuplicateResult {
  const candidateDoi = normalizeDoi(candidate.doi);
  const candidateSemanticScholar = normalizeIdentifier(candidate.semanticScholarId);
  const candidateArxiv = normalizeArxivId(candidate.arxivId);
  const candidatePmid = normalizeIdentifier(candidate.pmid);

  for (const paper of papers) {
    if (candidateDoi && normalizeDoi(paper.doi) === candidateDoi) {
      return { kind: "exact", paper, reason: "DOI match" };
    }
    if (candidateSemanticScholar && paper.semanticScholarId === candidateSemanticScholar) {
      return { kind: "exact", paper, reason: "Semantic Scholar ID match" };
    }
    if (candidateArxiv && normalizeArxivId(paper.arxivId) === candidateArxiv) {
      return { kind: "exact", paper, reason: "arXiv ID match" };
    }
    if (candidatePmid && paper.pmid === candidatePmid) {
      return { kind: "exact", paper, reason: "PMID match" };
    }
  }

  const candidateTitle = normalizeTitleKey(candidate.title);
  const candidateYear = candidate.issued?.year;
  const candidateAuthor = firstCreatorFamily(candidate.authors ?? []).toLowerCase();

  if (candidateTitle && candidateYear && candidateAuthor) {
    const probable = papers.find((paper) => {
      return (
        normalizeTitleKey(paper.title) === candidateTitle &&
        paper.issued?.year === candidateYear &&
        firstCreatorFamily(paper.authors).toLowerCase() === candidateAuthor
      );
    });
    if (probable) return { kind: "probable", paper: probable, reason: "title, year, and first author match" };
  }

  return { kind: "none" };
}

// --- Duplicates already in the library -------------------------------------------------------

export interface DuplicateGroup {
  /** Best record first: the one to keep. */
  papers: Paper[];
  reason: string;
}

const isArxivDoi = (doi?: string) => Boolean(doi && /^10\.48550\/arxiv\./i.test(doi));

/** Rank for which record survives a merge: the published version, then the better-filled one. */
function keepScore(paper: Paper): number {
  const published = paper.type !== "preprint" && paper.doi && !isArxivDoi(normalizeDoi(paper.doi)) ? 8 : 0;
  return published + (paper.pdf ? 4 : 0) + (paper.notesMarkdown?.trim() ? 2 : 0) + (paper.containerTitle ? 1 : 0);
}

/**
 * Papers that are the same work: a shared DOI, arXiv ID or PMID, or the same title and first
 * author in any year (a preprint and its published version). Each group lists the record to keep first.
 */
export function findDuplicateGroups(papers: Paper[]): DuplicateGroup[] {
  const parent = new Map(papers.map((p) => [p.id, p.id]));
  const reasons = new Map<string, string>();
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  const join = (keys: Map<string, Paper>, key: string | undefined, paper: Paper, reason: string) => {
    if (!key) return;
    const other = keys.get(key);
    if (!other) return void keys.set(key, paper);
    const [a, b] = [find(other.id), find(paper.id)];
    if (a === b) return;
    parent.set(b, a);
    if (!reasons.has(a)) reasons.set(a, reason);
  };
  const byDoi = new Map<string, Paper>();
  const byArxiv = new Map<string, Paper>();
  const byPmid = new Map<string, Paper>();
  const byTitle = new Map<string, Paper>();
  for (const paper of papers) {
    join(byDoi, normalizeDoi(paper.doi), paper, "Same DOI");
    join(byArxiv, normalizeArxivId(paper.arxivId), paper, "Same arXiv ID");
    join(byPmid, normalizeIdentifier(paper.pmid), paper, "Same PubMed ID");
    const title = normalizeTitleKey(paper.title);
    const author = firstCreatorFamily(paper.authors).toLowerCase();
    if (title.length >= 12 && author) join(byTitle, `${title}|${author}`, paper, "Same title and first author");
  }
  const groups = new Map<string, Paper[]>();
  for (const paper of papers) {
    const root = find(paper.id);
    groups.set(root, [...(groups.get(root) ?? []), paper]);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([root, members]) => ({
      papers: [...members].sort((a, b) => keepScore(b) - keepScore(a) || a.createdAt.localeCompare(b.createdAt)),
      reason: reasons.get(root) ?? "Same work"
    }));
}

const FILL_FIELDS = [
  "editors", "issued", "containerTitle", "shortContainerTitle", "volume", "issue", "pages", "publisher", "publisherPlace",
  "edition", "doi", "arxivId", "pmid", "pmcid", "semanticScholarId", "isbn", "issn", "url", "openAccessPdfUrl", "abstract", "language", "pdf"
] as const;

/**
 * The changes that fold `drop` into `keep`: empty fields filled from `drop`, tags and folders
 * combined, notes appended, the earlier added date and any shelf kept. `@[dropKey]` links are
 * the caller's to rewrite (they can live in any note).
 */
export function mergePaperPatch(keep: Paper, drop: Paper): Partial<Paper> {
  const patch: Partial<Paper> = {};
  const fill = patch as Record<string, unknown>;
  for (const field of FILL_FIELDS) if (keep[field] === undefined && drop[field] !== undefined) fill[field] = drop[field];
  if (!keep.authors.length && drop.authors.length) patch.authors = drop.authors;
  const tags = [...new Set([...keep.tags, ...drop.tags])];
  if (tags.length !== keep.tags.length) patch.tags = tags;
  const folderIds = [...new Set([...keep.folderIds, ...drop.folderIds])];
  if (folderIds.length !== keep.folderIds.length) patch.folderIds = folderIds;
  const mine = keep.notesMarkdown?.trim() ?? "";
  const theirs = drop.notesMarkdown?.trim() ?? "";
  if (theirs && !mine.includes(theirs)) patch.notesMarkdown = mine ? `${mine}\n\n${theirs}` : theirs;
  if (!keep.readingStatus && drop.readingStatus) patch.readingStatus = drop.readingStatus;
  if (keep.inbox && !drop.inbox) patch.inbox = undefined;
  const reasons = [...new Set([keep.savedBecause, drop.savedBecause].filter((r): r is string => Boolean(r?.trim())))];
  if (reasons.length > 1) patch.savedBecause = reasons.join("; ");
  else if (!keep.savedBecause && reasons.length) patch.savedBecause = reasons[0];
  if (drop.createdAt < keep.createdAt) patch.createdAt = drop.createdAt;
  return patch;
}
