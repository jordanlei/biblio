import { normalizeCreatorName } from "./normalize";
import type { Creator, Paper, PaperType } from "./types";

const TYPE_MAP: Record<PaperType, string> = {
  article: "article",
  conferencePaper: "inproceedings",
  preprint: "misc",
  book: "book",
  bookChapter: "incollection",
  thesis: "phdthesis",
  report: "techreport",
  other: "misc"
};

function escapeBibtex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (char) => `\\${char}`)
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCreators(creators: Creator[]): string | undefined {
  if (!creators.length) return undefined;
  return creators
    .map((creator) => {
      if (creator.literal) return `{${escapeBibtex(creator.literal)}}`;
      if (creator.family && creator.given) return `${escapeBibtex(creator.family)}, ${escapeBibtex(creator.given)}`;
      return escapeBibtex(normalizeCreatorName(creator));
    })
    .join(" and ");
}

function field(name: string, value?: string | number | string[], { escaped = false } = {}): string | undefined {
  if (value === undefined || value === null) return undefined;
  const stringValue = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value);
  if (!stringValue.trim()) return undefined;
  return `  ${name} = {${escaped ? stringValue : escapeBibtex(stringValue)}},`;
}

export function paperToBibtex(paper: Paper): string {
  const fields = [
    field("title", paper.title),
    // Creator lists are escaped per name by formatCreators; escaping again would break {Organization} braces.
    field("author", formatCreators(paper.authors), { escaped: true }),
    field("editor", paper.editors ? formatCreators(paper.editors) : undefined, { escaped: true }),
    field("year", paper.issued?.year),
    field("month", paper.issued?.month),
    field("journal", paper.type === "article" ? paper.containerTitle : undefined),
    field("booktitle", paper.type === "conferencePaper" || paper.type === "bookChapter" ? paper.containerTitle : undefined),
    field("school", paper.type === "thesis" ? paper.containerTitle : undefined),
    field("publisher", paper.publisher),
    field("address", paper.publisherPlace),
    field("volume", paper.volume),
    field("number", paper.issue),
    field("pages", paper.pages),
    field("doi", paper.doi),
    field("eprint", paper.arxivId),
    field("archiveprefix", paper.arxivId ? "arXiv" : undefined),
    field("pmid", paper.pmid),
    field("isbn", paper.isbn),
    field("url", paper.url),
    field("abstract", paper.abstract),
    field("keywords", paper.tags)
  ].filter(Boolean);

  return `@${TYPE_MAP[paper.type]}{${paper.citationKey},\n${fields.join("\n")}\n}`;
}

export function exportBibtex(papers: Paper[]): string {
  return `${papers.map(paperToBibtex).join("\n\n")}\n`;
}
