export type PaperType =
  | "article"
  | "conferencePaper"
  | "preprint"
  | "book"
  | "bookChapter"
  | "thesis"
  | "report"
  | "other";

export type ReadingStatus = "inbox" | "readNext" | "skimming" | "reading" | "read" | "reference" | "parked" | "tbr" | "skimmed";

export interface Creator {
  given?: string;
  family?: string;
  literal?: string;
  orcid?: string;
}

export interface PartialDate {
  year?: number;
  month?: number;
  day?: number;
  raw?: string;
}

export interface PaperPdf {
  driveFileId: string;
  filename: string;
  mimeType: "application/pdf";
  sourceUrl?: string;
  addedAt: string;
}

export interface Paper {
  id: string;
  citationKey: string;
  type: PaperType;
  title: string;
  authors: Creator[];
  editors?: Creator[];
  issued?: PartialDate;
  containerTitle?: string;
  shortContainerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  publisherPlace?: string;
  edition?: string;
  doi?: string;
  arxivId?: string;
  pmid?: string;
  semanticScholarId?: string;
  issn?: string[];
  isbn?: string[];
  url?: string;
  /** Open-access PDF location reported by a metadata source; not a stored copy. */
  openAccessPdfUrl?: string;
  abstract?: string;
  language?: string;
  tags: string[];
  folderIds: string[];
  notesMarkdown: string;
  readingStatus?: ReadingStatus;
  savedBecause?: string;
  pdf?: PaperPdf;
  source: "extension" | "semantic-scholar" | "openalex" | "bibtex" | "zotero" | "manual";
  sourceIdentifiers?: {
    zoteroKey?: string;
    semanticScholarId?: string;
  };
  rawImportData?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A freeform Markdown note that isn't about one paper: a question, a project, a related-work
 * draft. Papers are connected by `@[citationKey]` links in the text. Stored as
 * `research-notes/<title>.md` in the library.
 */
export interface ResearchNote {
  id: string;
  title: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaperCandidate {
  type?: PaperType;
  /** Preferred citation key (e.g. from a BibTeX import); collisions still get a suffix. */
  citationKey?: string;
  title: string;
  authors?: Creator[];
  editors?: Creator[];
  issued?: PartialDate;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  publisherPlace?: string;
  isbn?: string[];
  doi?: string;
  arxivId?: string;
  pmid?: string;
  semanticScholarId?: string;
  url?: string;
  openAccessPdfUrl?: string;
  abstract?: string;
  tags?: string[];
  folderIds?: string[];
  notesMarkdown?: string;
  readingStatus?: ReadingStatus;
  savedBecause?: string;
  source?: Paper["source"];
}

export interface DuplicateResult {
  kind: "none" | "exact" | "probable";
  paper?: Paper;
  reason?: string;
}
