import type { PaperCandidate } from "./types";

// The browser extension hands a page's metadata to the app in a URL hash. Anyone can craft such a
// link, so the payload is validated rather than trusted: a bad link should show an error, never
// throw, and never smuggle a value into somewhere that fetches or renders it.

export interface CapturedPaper {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  doi?: string;
  arxivId?: string;
  pmid?: string;
  abstract?: string;
  pdfUrl?: string;
  url?: string;
}

const MAX_TEXT = 6000;
const MAX_AUTHORS = 200;

/** Validate a decoded capture payload. Throws if it isn't usable as a paper. */
export function parseCapturedPaper(raw: unknown): CapturedPaper {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not a capture");
  const value = raw as Record<string, unknown>;
  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string).slice(0, MAX_TEXT) : undefined);

  const title = text("title");
  if (!title?.trim()) throw new Error("no title");

  // Only http(s) links: a javascript: or data: URL here would later be handed to a fetch or a link.
  const link = (key: string) => {
    const href = text(key);
    return href && /^https?:\/\//i.test(href) ? href : undefined;
  };

  const year = Number(value.year);
  return {
    title,
    authors: Array.isArray(value.authors) ? value.authors.filter((a): a is string => typeof a === "string").slice(0, MAX_AUTHORS) : [],
    year: Number.isInteger(year) && year > 1000 && year < 3000 ? year : undefined,
    venue: text("venue"),
    volume: text("volume"),
    issue: text("issue"),
    pages: text("pages"),
    publisher: text("publisher"),
    doi: text("doi"),
    arxivId: text("arxivId"),
    pmid: text("pmid"),
    abstract: text("abstract"),
    pdfUrl: link("pdfUrl"),
    url: link("url")
  };
}

/** Decode and validate the extension's base64url hash payload. */
export function decodeCaptureHash(hash: string): CapturedPaper {
  const base64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return parseCapturedPaper(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
}

export type { PaperCandidate };
