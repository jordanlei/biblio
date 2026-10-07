import { normalizeArxivId, normalizeDoi } from "./normalize";
import type { Creator, PaperCandidate, PaperType } from "./types";

export interface ParsedBibtexEntry {
  entryType: string;
  key: string;
  fields: Record<string, string>;
}

const TYPE_MAP: Record<string, PaperType> = {
  article: "article",
  inproceedings: "conferencePaper",
  conference: "conferencePaper",
  proceedings: "book",
  book: "book",
  inbook: "bookChapter",
  incollection: "bookChapter",
  phdthesis: "thesis",
  mastersthesis: "thesis",
  thesis: "thesis",
  techreport: "report",
  report: "report",
  online: "other",
  misc: "other",
  unpublished: "other"
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

const ACCENTS: Record<string, Record<string, string>> = {
  "'": { a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý", c: "ć", n: "ń", s: "ś", z: "ź", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", C: "Ć", S: "Ś", Z: "Ź" },
  "`": { a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù" },
  '"': { a: "ä", e: "ë", i: "ï", o: "ö", u: "ü", y: "ÿ", A: "Ä", E: "Ë", I: "Ï", O: "Ö", U: "Ü" },
  "^": { a: "â", e: "ê", i: "î", o: "ô", u: "û", A: "Â", E: "Ê", I: "Î", O: "Ô", U: "Û" },
  "~": { a: "ã", n: "ñ", o: "õ", A: "Ã", N: "Ñ", O: "Õ" },
  c: { c: "ç", C: "Ç", s: "ş", S: "Ş" },
  v: { c: "č", s: "š", z: "ž", r: "ř", e: "ě", n: "ň", C: "Č", S: "Š", Z: "Ž", R: "Ř" },
  u: { a: "ă", g: "ğ", A: "Ă", G: "Ğ" },
  H: { o: "ő", u: "ű", O: "Ő", U: "Ű" }
};

const SYMBOLS: Record<string, string> = {
  ss: "ß", o: "ø", O: "Ø", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", aa: "å", AA: "Å", l: "ł", L: "Ł", i: "ı",
  textbackslash: "\\", textendash: "–", textemdash: "—", textasciitilde: "~", textunderscore: "_"
};

/** Convert common LaTeX escapes and accent commands to Unicode and strip grouping braces. */
const FORMATTING = /\\(?:emph|textit|textbf|textsc|textrm|textsf|texttt|mathrm|mathit|text|uppercase|lowercase)\s*\{([^{}]*)\}/g;

export function latexToUnicode(value: string): string {
  return value
    // Zotero escapes literal LaTeX in abstracts: {\textbackslash}textit\{C. elegans\} means \textit{C. elegans}.
    .replace(/\{\\textbackslash\}(\w+)\\\{([^{}]*?)\\\}/g, "\\$1{$2}")
    // Formatting commands keep their content: \emph{word} → word.
    .replace(FORMATTING, "$1")
    .replace(FORMATTING, "$1")
    .replace(/\\([`'"^~cvuH])\s*\{?\\?([A-Za-z])\}?/g, (match, accent: string, letter: string) => ACCENTS[accent]?.[letter] ?? match)
    .replace(/\\([A-Za-z]+)(?:\{\}|\s+|(?=[^A-Za-z]))/g, (match, name: string) => SYMBOLS[name] ?? match)
    .replace(/\\\{/g, "\u0001")
    .replace(/\\\}/g, "\u0002")
    .replace(/\\([&%$#_])/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\u0001/g, "{")
    .replace(/\u0002/g, "}")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize BibTeX source into raw entries. Tolerates comments, @string/@preamble, and nested braces. */
export function parseBibtexEntries(source: string): ParsedBibtexEntry[] {
  const entries: ParsedBibtexEntry[] = [];
  const strings: Record<string, string> = {};
  let index = 0;

  while (index < source.length) {
    const at = source.indexOf("@", index);
    if (at === -1) break;
    const typeMatch = /^@\s*([A-Za-z]+)\s*([{(])/.exec(source.slice(at));
    if (!typeMatch) {
      index = at + 1;
      continue;
    }
    const entryType = typeMatch[1].toLowerCase();
    const close = typeMatch[2] === "{" ? "}" : ")";
    let cursor = at + typeMatch[0].length;
    const end = findClosing(source, cursor - 1, typeMatch[2], close);
    const body = source.slice(cursor, end === -1 ? source.length : end);
    index = end === -1 ? source.length : end + 1;

    if (entryType === "comment" || entryType === "preamble") continue;
    if (entryType === "string") {
      const fields = parseFields(body, strings);
      Object.assign(strings, fields);
      continue;
    }

    const comma = body.indexOf(",");
    const key = (comma === -1 ? body : body.slice(0, comma)).trim();
    const fields = comma === -1 ? {} : parseFields(body.slice(comma + 1), strings);
    entries.push({ entryType, key, fields });
  }
  return entries;
}

function findClosing(source: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseFields(body: string, strings: Record<string, string>): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    const nameMatch = /^[\s,]*([A-Za-z][\w:.+-]*)\s*=\s*/.exec(body.slice(i));
    if (!nameMatch) break;
    const name = nameMatch[1].toLowerCase();
    i += nameMatch[0].length;
    const parts: string[] = [];
    // A value is one or more pieces joined by '#': {braced}, "quoted", number, or @string macro.
    while (i < body.length) {
      const char = body[i];
      if (char === "{") {
        const end = findClosing(body, i, "{", "}");
        parts.push(body.slice(i + 1, end === -1 ? body.length : end));
        i = end === -1 ? body.length : end + 1;
      } else if (char === '"') {
        let j = i + 1;
        let depth = 0;
        while (j < body.length && !(body[j] === '"' && depth === 0 && body[j - 1] !== "\\")) {
          if (body[j] === "{") depth += 1;
          if (body[j] === "}") depth -= 1;
          j += 1;
        }
        parts.push(body.slice(i + 1, j));
        i = j + 1;
      } else {
        const bare = /^[^\s,#]+/.exec(body.slice(i));
        if (!bare) break;
        parts.push(strings[bare[0].toLowerCase()] ?? bare[0]);
        i += bare[0].length;
      }
      const joiner = /^\s*#\s*/.exec(body.slice(i));
      if (!joiner) break;
      i += joiner[0].length;
    }
    fields[name] = parts.join("");
  }
  return fields;
}

export function parseBibtexCreators(value: string): Creator[] {
  return splitTopLevel(value, /\s+and\s+/i)
    .map((name) => name.trim())
    // "and others" is BibTeX for "et al.", not an author.
    .filter((name) => name && name.toLowerCase() !== "others")
    .map((name) => {
      if (/^\{.*\}$/.test(name) && !name.slice(1, -1).includes("{")) return { literal: latexToUnicode(name) };
      const commaParts = splitTopLevel(name, /\s*,\s*/);
      if (commaParts.length >= 2) {
        return { family: latexToUnicode(commaParts[0]), given: latexToUnicode(commaParts.slice(-1)[0]) || undefined };
      }
      const words = splitTopLevel(name, /\s+/);
      if (words.length === 1) return { literal: latexToUnicode(words[0]) };
      return { given: latexToUnicode(words.slice(0, -1).join(" ")), family: latexToUnicode(words.at(-1) ?? "") };
    });
}

/** Split on a separator only where brace depth is zero. */
function splitTopLevel(value: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  const global = new RegExp(separator.source, separator.flags.includes("g") ? separator.flags : `${separator.flags}g`);
  let match: RegExpExecArray | null;
  let scanned = 0;
  while ((match = global.exec(value))) {
    for (; scanned < match.index; scanned += 1) {
      if (value[scanned] === "{") depth += 1;
      if (value[scanned] === "}") depth -= 1;
    }
    if (depth === 0) {
      parts.push(value.slice(start, match.index));
      start = match.index + match[0].length;
    }
    if (match[0].length === 0) global.lastIndex += 1;
  }
  parts.push(value.slice(start));
  return parts;
}

export function bibtexEntryToCandidate(entry: ParsedBibtexEntry): PaperCandidate {
  const f = entry.fields;
  const text = (name: string) => (f[name] ? latexToUnicode(f[name]) || undefined : undefined);
  const archive = (f.archiveprefix ?? f.eprinttype ?? "").toLowerCase();
  const arxivId = normalizeArxivId(f.arxiv ?? (archive === "arxiv" ? f.eprint : undefined) ?? arxivFromUrl(f.url));
  let type = TYPE_MAP[entry.entryType] ?? "other";
  if (type === "other" && arxivId) type = "preprint";
  const year = Number.parseInt(f.year ?? f.date ?? "", 10);
  const monthRaw = (f.month ?? "").trim().toLowerCase();
  const month = MONTHS[monthRaw.slice(0, 3)] ?? (Number.parseInt(monthRaw, 10) || undefined);

  return {
    type,
    citationKey: entry.key || undefined,
    title: text("title") ?? "Untitled",
    authors: f.author ? parseBibtexCreators(f.author) : [],
    editors: f.editor ? parseBibtexCreators(f.editor) : undefined,
    issued: Number.isFinite(year) ? { year, month } : undefined,
    containerTitle: text("journal") ?? text("journaltitle") ?? text("booktitle") ?? (type === "thesis" ? text("school") : undefined),
    volume: text("volume"),
    issue: text("number") ?? text("issue"),
    pages: text("pages"),
    publisher: text("publisher") ?? text("institution"),
    publisherPlace: text("address") ?? text("location"),
    isbn: f.isbn ? [latexToUnicode(f.isbn)] : undefined,
    doi: normalizeDoi(f.doi ? latexToUnicode(f.doi) : undefined),
    arxivId,
    pmid: text("pmid"),
    url: f.url ? latexToUnicode(f.url) : undefined,
    abstract: text("abstract"),
    tags: (text("keywords") ?? "")
      .split(/[,;]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    source: "bibtex"
  };
}

function arxivFromUrl(url?: string): string | undefined {
  return url ? /arxiv\.org\/(?:abs|pdf)\/([^\s?#]+)/i.exec(url)?.[1] : undefined;
}

export function parseBibtex(source: string): PaperCandidate[] {
  return parseBibtexEntries(source).map(bibtexEntryToCandidate);
}
