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
