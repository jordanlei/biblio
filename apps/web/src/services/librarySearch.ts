import type { Paper } from "@biblio/core";

// Client-side library search: fielded, accent-insensitive, relevance-ranked.
//   deep learning            → every word must match somewhere; title/author hits rank highest
//   "working memory"         → exact phrase
//   author:botvinick  au:…   → author names only (so a name never matches title words)
//   title:control  tag:rl  #rl  key:mnih  year:2015  year:2010-2018

export function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface LocalQuery {
  terms: string[];
  phrases: string[];
  author: string[];
  title: string[];
  tag: string[];
  key: string[];
  yearFrom?: number;
  yearTo?: number;
}

export function parseLocalQuery(raw: string): LocalQuery {
  const q: LocalQuery = { terms: [], phrases: [], author: [], title: [], tag: [], key: [] };
  const pattern = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|#(\S+)|(\S+)/g;
  for (const m of raw.matchAll(pattern)) {
    const field = (m[1] ?? m[3])?.toLowerCase();
    const value = fold(m[2] ?? m[4] ?? "");
    if (field) {
      if (field === "author" || field === "au" || field === "by") q.author.push(value);
      else if (field === "title" || field === "ti") q.title.push(value);
      else if (field === "tag") q.tag.push(value);
      else if (field === "key") q.key.push(value);
      else if (field === "year" || field === "y") {
        const [from, to] = value.split(/[-–]/);
        q.yearFrom = Number(from) || undefined;
        q.yearTo = to === undefined ? q.yearFrom : Number(to) || undefined;
      } else q.terms.push(fold(m[0]));
    } else if (m[5]) q.phrases.push(fold(m[5]));
    else if (m[6]) q.tag.push(fold(m[6]));
    else if (m[7]) q.terms.push(fold(m[7]));
  }
  return q;
}

export function isEmptyQuery(q: LocalQuery) {
  return !q.terms.length && !q.phrases.length && !q.author.length && !q.title.length && !q.tag.length && !q.key.length && !q.yearFrom && !q.yearTo;
}

interface Indexed {
  title: string;
  authors: string;
  families: string[];
  venue: string;
  tags: string[];
  key: string;
  abstract: string;
  notes: string;
  savedBecause: string;
  ids: string;
}

// Paper objects are replaced on every change, so a WeakMap keyed by object never goes stale.
const cache = new WeakMap<Paper, Indexed>();
function index(paper: Paper): Indexed {
  let entry = cache.get(paper);
  if (!entry) {
    const names = paper.authors.map((a) => fold(a.literal ?? [a.given, a.family].filter(Boolean).join(" ")));
    entry = {
      title: fold(paper.title),
      authors: names.join(" · "),
      families: paper.authors.map((a) => fold(a.family ?? a.literal ?? a.given ?? "")),
      venue: fold(paper.containerTitle ?? ""),
      tags: paper.tags.map(fold),
      key: fold(paper.citationKey),
      abstract: fold(paper.abstract ?? ""),
      notes: fold(paper.notesMarkdown ?? ""),
      savedBecause: fold(paper.savedBecause ?? ""),
      ids: fold([paper.doi, paper.arxivId, paper.pmid].filter(Boolean).join(" "))
    };
    cache.set(paper, entry);
  }
  return entry;
}

const wordStart = (haystack: string, term: string) => {
  const at = haystack.indexOf(term);
  if (at === -1) return 0;
  if (at === 0 || /[^a-z0-9]/.test(haystack[at - 1])) return 2;
  // A later occurrence might start a word even if the first one doesn't.
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack) ? 2 : 1;
};

/** Relevance score, or -1 when the paper doesn't match. */
export function scorePaper(paper: Paper, q: LocalQuery): number {
  const x = index(paper);
  const year = paper.issued?.year;
  if (q.yearFrom && (!year || year < q.yearFrom)) return -1;
  if (q.yearTo && (!year || year > q.yearTo)) return -1;
  if (!q.author.every((a) => x.authors.includes(a))) return -1;
  if (!q.title.every((t) => x.title.includes(t))) return -1;
  if (!q.tag.every((t) => x.tags.some((tag) => tag.includes(t)))) return -1;
  if (!q.key.every((k) => x.key.includes(k))) return -1;

  let score = 0;
  for (const term of q.terms) {
    const title = wordStart(x.title, term);
    const family = x.families.some((f) => f.startsWith(term)) ? 2 : x.authors.includes(term) ? 1 : 0;
    const tag = x.tags.some((t) => t.startsWith(term)) ? 1 : 0;
    const fields =
      title * 6 +
      family * 5 +
      tag * 4 +
      (x.key.includes(term) ? 3 : 0) +
      (x.venue.includes(term) ? 2 : 0) +
      (x.abstract.includes(term) ? 1.5 : 0) +
      (x.notes.includes(term) ? 1.5 : 0) +
      (x.savedBecause.includes(term) ? 1.5 : 0) +
      (x.ids.includes(term) ? 3 : 0);
    if (!fields) return -1;
    score += fields;
  }
  for (const phrase of q.phrases) {
    const where =
      (x.title.includes(phrase) ? 12 : 0) +
      (x.abstract.includes(phrase) ? 3 : 0) +
      (x.notes.includes(phrase) ? 3 : 0) +
      (x.savedBecause.includes(phrase) ? 3 : 0) +
      (x.authors.includes(phrase) ? 8 : 0);
    if (!where) return -1;
    score += where;
  }
  // All free words together in the title is the strongest signal.
  if (q.terms.length > 1 && x.title.includes(q.terms.join(" "))) score += 10;
  return score + 0.01;
}

export interface Segment {
  text: string;
  hit: boolean;
}

/** Split text into highlighted/plain segments for the query's words (rendered without v-html). */
export function highlight(text: string, q: LocalQuery | null, fields: Array<"title" | "author"> = ["title"]): Segment[] {
  if (!q) return [{ text, hit: false }];
  const words = [...q.terms, ...q.phrases, ...(fields.includes("title") ? q.title : []), ...(fields.includes("author") ? q.author : [])].filter((w) => w.length > 1);
  if (!words.length) return [{ text, hit: false }];
  const folded = fold(text);
  const marks = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    let at = folded.indexOf(word);
    while (at !== -1) {
      // fold() keeps length for Latin text (combining marks removed after NFKD of precomposed chars).
      for (let i = at; i < at + word.length && i < marks.length; i += 1) marks[i] = true;
      at = folded.indexOf(word, at + word.length);
    }
  }
  const segments: Segment[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const last = segments.at(-1);
    if (last && last.hit === marks[i]) last.text += text[i];
    else segments.push({ text: text[i], hit: marks[i] });
  }
  return segments;
}
