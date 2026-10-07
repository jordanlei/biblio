import { exportBibtex } from "../bibtex";
import type { Creator, Folder, Paper, PaperType, PartialDate, ReadingStatus, ResearchNote } from "../types";

// The Biblio library format (v1): how a user's library is laid out in their own storage.
// Everything a user deliberately creates lives here, in open formats, so the library is usable
// without Biblio. Specified in docs/LIBRARY_FORMAT.md; this module is the reference reader/writer.
//
//   <library root>/
//     README.md          what this folder is, in plain words
//     biblio.json   manifest: format + version, collections (folders), Research Notes
//     library.json       every paper as CSL-JSON (readable by pandoc, Zotero, citeproc)
//     references.bib     the same library as BibTeX (convenience copy, regenerated)
//     notes/             Markdown notes: <citationKey>.md for a paper, <title>.md for a free note
//     papers/<key>.pdf   PDFs

export const LIBRARY_FORMAT = "biblio-library";
export const LIBRARY_FORMAT_VERSION = 1;

export const LIBRARY_PATHS = {
  readme: "README.md",
  manifest: "biblio.json",
  library: "library.json",
  bibtex: "references.bib",
  notesDir: "notes",
  papersDir: "papers"
} as const;

export interface LibraryManifest {
  format: typeof LIBRARY_FORMAT;
  version: number;
  generator: string;
  /** Folders ("collections"). Papers reference them by id in library.json. */
  collections: Array<{ id: string; name: string; parent: string | null }>;
  /** Research notes as early v1 libraries stored them; read for migration, no longer written. */
  researchNotes?: LegacyResearchNote[];
}

/** Biblio's own fields, kept under CSL-JSON's `custom` object so CSL tools ignore them. */
export interface BiblioFields {
  id: string;
  type: PaperType;
  tags: string[];
  collections: string[];
  readingStatus?: ReadingStatus;
  savedBecause?: string;
  addedAt: string;
  /** Library-relative paths. */
  note?: string;
  pdf?: string;
  arxivId?: string;
  semanticScholarId?: string;
  openAccessPdfUrl?: string;
  source: Paper["source"];
  sourceIdentifiers?: Paper["sourceIdentifiers"];
}

/** A CSL-JSON item (https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html). */
export interface CslItem {
  id: string;
  type: string;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  issued?: { "date-parts"?: number[][]; raw?: string };
  "container-title"?: string;
  "container-title-short"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  "publisher-place"?: string;
  edition?: string;
  DOI?: string;
  URL?: string;
  ISBN?: string;
  ISSN?: string;
  PMID?: string;
  abstract?: string;
  language?: string;
  keyword?: string;
  custom?: { biblio?: BiblioFields } & Record<string, unknown>;
}

type CslName = { family?: string; given?: string; literal?: string };

const CSL_TYPES: Record<PaperType, string> = {
  article: "article-journal",
  conferencePaper: "paper-conference",
  preprint: "article",
  book: "book",
  bookChapter: "chapter",
  thesis: "thesis",
  report: "report",
  other: "document"
};

const FROM_CSL: Record<string, PaperType> = {
  "article-journal": "article",
  "article-magazine": "article",
  "article-newspaper": "article",
  "paper-conference": "conferencePaper",
  article: "preprint",
  book: "book",
  chapter: "bookChapter",
  thesis: "thesis",
  report: "report"
};

const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))) as T;

const names = (list?: Creator[]): CslName[] | undefined => (list?.length ? list.map((c) => compact({ family: c.family, given: c.given, literal: c.literal })) : undefined);

function issued(date?: PartialDate): CslItem["issued"] {
  if (!date) return undefined;
  if (date.year) return { "date-parts": [[date.year, date.month, date.day].filter((n): n is number => Boolean(n))] };
  return date.raw ? { raw: date.raw } : undefined;
}

export function defaultNotePath(paper: Pick<Paper, "citationKey">) {
  return `${LIBRARY_PATHS.notesDir}/${safeFileName(paper.citationKey)}.md`;
}

export function defaultPdfPath(paper: Pick<Paper, "citationKey">) {
  return `${LIBRARY_PATHS.papersDir}/${safeFileName(paper.citationKey)}.pdf`;
}

/** Citation keys are ASCII already; this only guards against path separators and oddities. */
export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 120) || "untitled";
}

export interface PaperPaths {
  note?: string;
  pdf?: string;
}

export function paperToCsl(paper: Paper, paths: PaperPaths = {}): CslItem {
  return compact({
    id: paper.citationKey,
    type: CSL_TYPES[paper.type] ?? "document",
    title: paper.title,
    author: names(paper.authors),
    editor: names(paper.editors),
    issued: issued(paper.issued),
    "container-title": paper.containerTitle,
    "container-title-short": paper.shortContainerTitle,
    volume: paper.volume,
    issue: paper.issue,
    page: paper.pages,
    publisher: paper.publisher,
    "publisher-place": paper.publisherPlace,
    edition: paper.edition,
    DOI: paper.doi,
    URL: paper.url,
    ISBN: paper.isbn?.join(", "),
    ISSN: paper.issn?.join(", "),
    PMID: paper.pmid,
    abstract: paper.abstract,
    language: paper.language,
    keyword: paper.tags.length ? paper.tags.join(", ") : undefined,
    custom: {
      biblio: compact({
        id: paper.id,
        type: paper.type,
        tags: paper.tags,
        collections: paper.folderIds,
        readingStatus: paper.readingStatus,
        savedBecause: paper.savedBecause,
        addedAt: paper.createdAt,
        note: paths.note,
        pdf: paths.pdf,
        arxivId: paper.arxivId,
        semanticScholarId: paper.semanticScholarId,
        openAccessPdfUrl: paper.openAccessPdfUrl,
        source: paper.source,
        sourceIdentifiers: paper.sourceIdentifiers
      }) as BiblioFields
    }
  });
}

const fromNames = (list?: CslName[]): Creator[] => (list ?? []).map((n) => compact({ family: n.family, given: n.given, literal: n.literal }));

/**
 * CSL-JSON item → Paper. Works for any CSL-JSON (e.g. exported from Zotero); Biblio's own
 * `custom.biblio` fields, when present, restore identity and organization exactly.
 */
export function cslToPaper(item: CslItem, now: string): { paper: Paper; paths: PaperPaths } {
  const b = item.custom?.biblio;
  const parts = item.issued?.["date-parts"]?.[0];
  const tags = b?.tags ?? (item.keyword ? item.keyword.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : []);
  const paper: Paper = compact({
    id: b?.id ?? `csl-${item.id}`,
    citationKey: item.id,
    type: b?.type ?? FROM_CSL[item.type] ?? "other",
    title: item.title ?? "Untitled",
    authors: fromNames(item.author),
    editors: item.editor ? fromNames(item.editor) : undefined,
    issued: parts?.length ? compact({ year: parts[0], month: parts[1], day: parts[2] }) : item.issued?.raw ? { raw: item.issued.raw } : undefined,
    containerTitle: item["container-title"],
    shortContainerTitle: item["container-title-short"],
    volume: item.volume,
    issue: item.issue,
    pages: item.page,
    publisher: item.publisher,
    publisherPlace: item["publisher-place"],
    edition: item.edition,
    doi: item.DOI,
    arxivId: b?.arxivId,
    pmid: item.PMID,
    semanticScholarId: b?.semanticScholarId,
    isbn: item.ISBN ? item.ISBN.split(/,\s*/) : undefined,
    issn: item.ISSN ? item.ISSN.split(/,\s*/) : undefined,
    url: item.URL,
    openAccessPdfUrl: b?.openAccessPdfUrl,
    abstract: item.abstract,
    language: item.language,
    tags,
    folderIds: b?.collections ?? [],
    notesMarkdown: "",
    readingStatus: b?.readingStatus,
    savedBecause: b?.savedBecause,
    source: b?.source ?? "manual",
    sourceIdentifiers: b?.sourceIdentifiers,
    createdAt: b?.addedAt ?? now,
    updatedAt: now
  }) as Paper;
  // compact() drops empty values; these are required.
  paper.notesMarkdown ??= "";
  paper.tags ??= [];
  paper.folderIds ??= [];
  paper.authors ??= [];
  return { paper, paths: { note: b?.note, pdf: b?.pdf } };
}

// --- Notes ------------------------------------------------------------------------------------

/** A note file: a small YAML header naming the paper, then the user's Markdown verbatim. */
export function noteToMarkdown(paper: Pick<Paper, "citationKey" | "title" | "id">, body: string): string {
  return `---\nkey: ${paper.citationKey}\ntitle: ${JSON.stringify(paper.title)}\nid: ${paper.id}\n---\n\n${body}`;
}

/** Read a note file. Files without a header (written by hand) are treated as all body. */
export function parseNoteMarkdown(text: string): { key?: string; id?: string; body: string } {
  const { header, body } = splitHeader(text);
  return header ? { key: header.key, id: header.id, body } : { body };
}

function splitHeader(text: string): { header?: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { body: text };
  const header = Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => /^(\w+):\s*(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => [m[1], m[2].trim()])
  );
  return { header, body: text.slice(match[0].length).replace(/^\r?\n/, "") };
}

// --- Research notes ---------------------------------------------------------------------------

/** How research notes looked before they became freeform Markdown files. */
export interface LegacyResearchNote {
  id: string;
  title: string;
  question?: string;
  description?: string;
  query?: string;
  paperRoles?: Array<{ paperId: string; role: string; note?: string }>;
  bodyMarkdown?: string;
  createdAt: string;
  updatedAt: string;
}

const LEGACY_ROLE_LABELS: Record<string, string> = { readNext: "read next" };

/**
 * Fold an old structured research note (question, saved search, papers with roles) into plain
 * Markdown, so nothing the user wrote is lost. Notes already in the new shape pass through.
 */
export function migrateResearchNote(note: LegacyResearchNote | ResearchNote, keyForPaperId: (id: string) => string | undefined): ResearchNote {
  const legacy = note as LegacyResearchNote;
  const parts: string[] = [];
  if (legacy.question?.trim()) parts.push(legacy.question.trim());
  if (legacy.description?.trim()) parts.push(legacy.description.trim());
  if (legacy.query?.trim()) parts.push(`Search: \`${legacy.query.trim()}\``);
  const papers = (legacy.paperRoles ?? [])
    .map((entry) => {
      const key = keyForPaperId(entry.paperId);
      if (!key) return null;
      const role = LEGACY_ROLE_LABELS[entry.role] ?? entry.role;
      return `- @[${key}] (${role})${entry.note?.trim() ? `: ${entry.note.trim()}` : ""}`;
    })
    .filter((line): line is string => Boolean(line));
  if (papers.length) parts.push(papers.join("\n"));
  const body = legacy.bodyMarkdown ?? "";
  if (!parts.length) return { id: note.id, title: note.title, bodyMarkdown: body, createdAt: note.createdAt, updatedAt: note.updatedAt };
  if (body.trim()) parts.push(body.trim());
  return { id: note.id, title: note.title, bodyMarkdown: `${parts.join("\n\n")}\n`, createdAt: note.createdAt, updatedAt: note.updatedAt };
}

/** True when a stored note still has the old structured fields. */
export function isLegacyResearchNote(note: object): boolean {
  return ["question", "description", "query", "paperRoles"].some((field) => field in note);
}

/** A research note file: a short header (id, title), then the user's Markdown verbatim. */
export function researchNoteToMarkdown(note: Pick<ResearchNote, "id" | "title" | "bodyMarkdown">): string {
  return `---\nid: ${note.id}\ntitle: ${JSON.stringify(note.title)}\n---\n\n${note.bodyMarkdown}`;
}

/**
 * Read a research note file. Files written by hand need no header: the title falls back to the
 * first "# heading", then to the file name.
 */
export function parseResearchNoteMarkdown(text: string, fileName: string): { id?: string; title: string; body: string } {
  const { header, body } = splitHeader(text);
  const id = header?.id;
  const title = header?.title;
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  return { id, title: unquote(title) || heading || fileName.replace(/\.md$/i, ""), body };
}

function unquote(value?: string) {
  if (!value) return "";
  if (value.startsWith('"')) {
    try {
      return String(JSON.parse(value));
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * File name for a research note's title, unique among `taken` paths ("Title.md", "Title 2.md"…).
 * Research notes share notes/ with paper notes, so `taken` must include the paper-note names too.
 */
export function researchNotePath(title: string, taken: Set<string>): string {
  const base = title.replace(/[\\/:*?"<>|#]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Untitled note";
  for (let n = 1; ; n += 1) {
    const path = `${LIBRARY_PATHS.notesDir}/${n === 1 ? base : `${base} ${n}`}.md`;
    if (!taken.has(path)) return path;
  }
}

// --- Whole library ----------------------------------------------------------------------------

export interface SerializedLibrary {
  manifest: string;
  library: string;
  bibtex: string;
}

/**
 * Library → file contents. Output is deterministic (stable ordering, no timestamps), so the
 * same library always produces the same bytes and unchanged libraries are never rewritten.
 */
export function serializeLibrary(papers: Paper[], folders: Folder[], pathsFor: (paper: Paper) => PaperPaths, generator = "Biblio"): SerializedLibrary {
  const sorted = [...papers].sort((a, b) => a.citationKey.localeCompare(b.citationKey) || a.id.localeCompare(b.id));
  const manifest: LibraryManifest = {
    format: LIBRARY_FORMAT,
    version: LIBRARY_FORMAT_VERSION,
    generator,
    collections: [...folders]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((f) => ({ id: f.id, name: f.name, parent: f.parentId }))
  };
  return {
    manifest: `${JSON.stringify(manifest, null, 2)}\n`,
    library: `${JSON.stringify(sorted.map((p) => paperToCsl(p, pathsFor(p))), null, 2)}\n`,
    bibtex: exportBibtex(sorted)
  };
}

export interface ParsedLibrary {
  papers: Paper[];
  folders: Folder[];
  /** Only from older manifests; current libraries keep research notes as files. */
  researchNotes: ResearchNote[];
  paths: Map<string, PaperPaths>;
}

/** File contents → library. Notes are attached separately (they live in their own files). */
export function parseLibrary(manifestText: string | null, libraryText: string, now: string): ParsedLibrary {
  const manifest = manifestText ? (JSON.parse(manifestText) as Partial<LibraryManifest>) : null;
  if (manifest?.format && manifest.format !== LIBRARY_FORMAT) throw new Error(`Not a Biblio library (format “${manifest.format}”).`);
  if (manifest?.version && manifest.version > LIBRARY_FORMAT_VERSION) {
    throw new Error(`This library uses format v${manifest.version}; this version of Biblio reads up to v${LIBRARY_FORMAT_VERSION}.`);
  }
  const items = JSON.parse(libraryText) as CslItem[];
  if (!Array.isArray(items)) throw new Error("library.json must be a JSON array of CSL items.");
  const paths = new Map<string, PaperPaths>();
  const papers = items.map((item) => {
    const { paper, paths: p } = cslToPaper(item, now);
    paths.set(paper.id, p);
    return paper;
  });
  const folders: Folder[] = (manifest?.collections ?? []).map((c) => ({ id: c.id, name: c.name, parentId: c.parent ?? null, createdAt: now, updatedAt: now }));
  const keys = new Map(papers.map((p) => [p.id, p.citationKey]));
  const researchNotes = (manifest?.researchNotes ?? []).map((note) => migrateResearchNote(note, (id) => keys.get(id)));
  return { papers, folders, researchNotes, paths };
}

export function libraryReadme(): string {
  return `# Biblio library

This folder is your research library. Biblio (a web app) reads and writes it, but you own it:
everything here is plain files you can open, copy, back up, or use with other tools.

| Path | What it is |
| --- | --- |
| \`papers/\` | Your PDFs, named by citation key (e.g. \`vaswaniAttentionNeed2017.pdf\`). |
| \`notes/\` | Your notes, one Markdown file per paper. The short header names the paper. |
| \`research-notes/\` | Freeform notes (questions, projects, drafts), one Markdown file each. Add your own .md files here and they appear in Biblio. |
| \`library.json\` | Every paper's citation metadata as **CSL-JSON** (works with pandoc, Zotero, citeproc). Biblio's own fields — tags, folders, shelf/status, saved reason, which note and PDF belong to the paper — are under \`custom.biblio\`. |
| \`references.bib\` | The same library as BibTeX, regenerated automatically. |
| \`biblio.json\` | Format name and version, and folders (collections). |

Links to papers are written in any note as \`@[citationKey]\`.

Format version ${LIBRARY_FORMAT_VERSION}. Specification: https://github.com/jordanlei/biblio/blob/main/docs/LIBRARY_FORMAT.md
`;
}
