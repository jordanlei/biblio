import { normalizeArxivId, normalizeDoi, type Creator, type PaperCandidate, type PaperType } from "@bibliograph/core";

// Metadata lookup for "Add papers". Search goes straight to OpenAlex (CORS-enabled, no key, ~250M
// works). Identifier lookups go to Crossref (DOIs), DataCite (arXiv) and OpenAlex (PMID).

function splitName(name: string): Creator {
  const pieces = name.trim().split(/\s+/);
  if (pieces.length <= 1) return { literal: name.trim() };
  return { given: pieces.slice(0, -1).join(" "), family: pieces.at(-1) };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  if (!response.headers.get("content-type")?.includes("json")) throw new Error(`${new URL(url).hostname} did not return JSON`);
  return (await response.json()) as T;
}

// --- OpenAlex ---------------------------------------------------------------------------------
const OPENALEX = "https://api.openalex.org";

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  type?: string | null;
  cited_by_count?: number;
  ids?: { pmid?: string };
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null };
  primary_location?: { landing_page_url?: string | null; pdf_url?: string | null; source?: { display_name?: string | null } | null } | null;
  best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null } | null;
  locations?: Array<{ landing_page_url?: string | null; pdf_url?: string | null }>;
  authorships?: Array<{ author?: { display_name?: string } }>;
  abstract_inverted_index?: Record<string, number[]> | null;
}

const OPENALEX_SELECT =
  "id,doi,title,display_name,publication_year,publication_date,type,cited_by_count,ids,biblio,primary_location,best_oa_location,locations,authorships,abstract_inverted_index";

const OPENALEX_TYPES: Record<string, PaperType> = {
  article: "article",
  preprint: "preprint",
  book: "book",
  "book-chapter": "bookChapter",
  dissertation: "thesis",
  report: "report"
};

function abstractFromInvertedIndex(index?: Record<string, number[]> | null): string | undefined {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words[position] = word;
  return words.filter(Boolean).join(" ") || undefined;
}

/** Best direct PDF link for a work: arXiv first (always fetchable by ID), then any OA PDF location. */
export function bestPdfUrl(work: Pick<OpenAlexWork, "best_oa_location" | "primary_location" | "locations">, arxivId?: string): string | undefined {
  if (arxivId) return `https://arxiv.org/pdf/${arxivId}`;
  return work.best_oa_location?.pdf_url ?? work.primary_location?.pdf_url ?? work.locations?.find((l) => l.pdf_url)?.pdf_url ?? undefined;
}

function fromOpenAlex(work: OpenAlexWork): PaperCandidate {
  const arxivUrl = work.locations?.map((l) => l.landing_page_url).find((url) => url?.includes("arxiv.org/abs/"));
  const arxivId = arxivUrl ? normalizeArxivId(arxivUrl)?.replace(/v\d+$/, "") : undefined;
  const date = work.publication_date?.split("-").map(Number);
  const pages = [work.biblio?.first_page, work.biblio?.last_page].filter(Boolean).join("–");
  const venue = work.primary_location?.source?.display_name ?? undefined;
  return {
    title: work.title ?? work.display_name ?? "Untitled",
    type: OPENALEX_TYPES[work.type ?? ""] ?? "other",
    authors: (work.authorships ?? []).map((a) => splitName(a.author?.display_name ?? "Unknown")),
    issued: work.publication_year ? { year: work.publication_year, month: date?.[1] || undefined, day: date?.[2] || undefined } : undefined,
    containerTitle: venue,
    volume: work.biblio?.volume ?? undefined,
    issue: work.biblio?.issue ?? undefined,
    pages: pages || undefined,
    doi: normalizeDoi(work.doi ?? undefined),
    arxivId,
    pmid: work.ids?.pmid?.replace(/\D/g, "") || undefined,
    url: work.primary_location?.landing_page_url ?? work.doi ?? work.id,
    openAccessPdfUrl: bestPdfUrl(work, arxivId),
    abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
    source: "openalex"
  };
}

export interface SearchHit {
  id: string;
  candidate: PaperCandidate;
  citedBy: number;
}

export interface AuthorHit {
  id: string;
  name: string;
  works: number;
  citedBy: number;
  institution?: string;
  topics: string[];
}

export type SearchSort = "relevance" | "cited" | "newest";

export interface WorkQuery {
  text: string;
  /** Restrict to one author (an OpenAlex author ID). */
  authorId?: string;
  titleOnly?: boolean;
  yearFrom?: number;
  yearTo?: number;
  sort: SearchSort;
  page?: number;
}

/**
 * Pull `author:"…"` / `author:name` and `year:2015`, `year:2015-2020`, `2015-` qualifiers out of a
 * query so they don't pollute the keyword search.
 */
export function parseQualifiers(raw: string): { text: string; author?: string; yearFrom?: number; yearTo?: number } {
  let text = raw;
  let author: string | undefined;
  let yearFrom: number | undefined;
  let yearTo: number | undefined;
  text = text.replace(/\bauthor:(?:"([^"]+)"|(\S+))/i, (_, quoted: string, bare: string) => {
    author = (quoted ?? bare).trim();
    return " ";
  });
  const setYears = (from?: string, to?: string) => {
    yearFrom = from ? Number(from) : undefined;
    yearTo = to ? Number(to) : undefined;
    return " ";
  };
  // year:2015, year:2015-2020, year:2015- ; or a bare 2015-2020 range.
  text = text.replace(/\byear:((?:19|20)\d{2})(\s*[-–]\s*((?:19|20)\d{2})?)?/i, (_, from: string, range?: string, to?: string) =>
    setYears(from, range ? to : from)
  );
  text = text.replace(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/, (_, from: string, to: string) => setYears(from, to));
  return { text: text.replace(/\s+/g, " ").trim(), author, yearFrom, yearTo };
}

function worksUrl(params: Record<string, string>) {
  const url = new URL(`${OPENALEX}/works`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("select", OPENALEX_SELECT);
  return url.toString();
}

function filters(query: WorkQuery, extra: string[] = []) {
  const list = [...extra];
  if (query.authorId) list.push(`authorships.author.id:${query.authorId}`);
  if (query.yearFrom || query.yearTo) list.push(`publication_year:${query.yearFrom ?? ""}-${query.yearTo ?? ""}`);
  return list;
}

const PER_PAGE = 20;

/**
 * Search works. "Relevance" blends OpenAlex's text relevance with a citation-sorted title/abstract
 * match, so a topic query ("deep learning") surfaces both close title matches and the field's
 * landmark papers instead of a page of same-named items.
 */
export async function searchWorks(query: WorkQuery, signal?: AbortSignal): Promise<{ hits: SearchHit[]; total: number }> {
  const text = query.text.trim();
  const page = String(query.page ?? 1);
  const per = String(PER_PAGE);
  const field = query.titleOnly ? "title.search" : "title_and_abstract.search";
  const run = async (params: Record<string, string>) => getJson<{ meta: { count: number }; results: OpenAlexWork[] }>(worksUrl(params), signal);

  let lists: OpenAlexWork[][];
  let total: number;
  if (!text) {
    // Author or year browsing with no keywords.
    const sort = query.sort === "newest" ? "publication_date:desc" : "cited_by_count:desc";
    const data = await run({ filter: filters(query).join(","), sort, "per-page": per, page });
    lists = [data.results];
    total = data.meta.count;
  } else if (query.sort === "relevance") {
    const textFilter = `${field}:${text}`;
    const [byRelevance, byCitations] = await Promise.all([
      query.titleOnly
        ? run({ filter: filters(query, [textFilter]).join(","), sort: "relevance_score:desc", "per-page": per, page })
        : run({ search: text, ...(filters(query).length ? { filter: filters(query).join(",") } : {}), "per-page": per, page }),
      run({ filter: filters(query, [textFilter]).join(","), sort: "cited_by_count:desc", "per-page": per, page })
    ]);
    lists = [byRelevance.results, byCitations.results];
    total = Math.max(byRelevance.meta.count, byCitations.meta.count);
  } else {
    const sort = query.sort === "cited" ? "cited_by_count:desc" : "publication_date:desc";
    const data = await run({ filter: filters(query, [`${field}:${text}`]).join(","), sort, "per-page": per, page });
    lists = [data.results];
    total = data.meta.count;
  }

  // Reciprocal-rank fusion across the lists, plus a nudge for titles containing every query term.
  const terms = text.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = new Map<string, { work: OpenAlexWork; score: number }>();
  lists.forEach((list, which) =>
    list.forEach((work, rank) => {
      const entry = scored.get(work.id) ?? { work, score: 0 };
      entry.score += (which === 0 ? 1 : 0.9) / (rank + 4);
      scored.set(work.id, entry);
    })
  );
  for (const entry of scored.values()) {
    const title = (entry.work.display_name ?? "").toLowerCase();
    if (terms.length && terms.every((t) => title.includes(t))) entry.score += 0.04;
    if (!entry.work.display_name) entry.score -= 1;
  }
  const ordered = lists.length > 1 ? [...scored.values()].sort((a, b) => b.score - a.score) : [...scored.values()];
  return {
    hits: ordered.map(({ work }) => ({ id: work.id, candidate: fromOpenAlex(work), citedBy: work.cited_by_count ?? 0 })),
    total
  };
}

/** People matching a name, most-cited first. */
export async function searchAuthors(name: string, signal?: AbortSignal): Promise<AuthorHit[]> {
  const url = new URL(`${OPENALEX}/authors`);
  url.searchParams.set("search", name);
  url.searchParams.set("per-page", "8");
  url.searchParams.set("select", "id,display_name,works_count,cited_by_count,last_known_institutions,topics");
  const data = await getJson<{
    results: Array<{
      id: string;
      display_name: string;
      works_count: number;
      cited_by_count: number;
      last_known_institutions?: Array<{ display_name: string }>;
      topics?: Array<{ display_name: string }>;
    }>;
  }>(url.toString(), signal);
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  return data.results
    .map((a) => ({
      id: a.id.replace("https://openalex.org/", ""),
      name: a.display_name,
      works: a.works_count,
      citedBy: a.cited_by_count,
      institution: a.last_known_institutions?.[0]?.display_name,
      topics: (a.topics ?? []).slice(0, 3).map((t) => t.display_name)
    }))
    // Names that contain every typed token first (OpenAlex's author search is fuzzy), then by citations.
    .sort((a, b) => {
      const match = (h: AuthorHit) => Number(tokens.every((t) => h.name.toLowerCase().includes(t)));
      return match(b) - match(a) || b.citedBy - a.citedBy;
    });
}

// --- Identifiers ------------------------------------------------------------------------------
export type Identifier = { kind: "doi" | "arxiv" | "pmid"; value: string };

/** Recognize a DOI, arXiv ID, PMID, or a URL containing one. Returns null for free text. */
export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (!value) return null;
  const arxiv =
    /arxiv\.org\/(?:abs|pdf)\/([^\s?#]+?)(?:v\d+)?(?:\.pdf)?$/i.exec(value)?.[1] ??
    /^(?:arxiv:\s*)?(\d{4}\.\d{4,5})(?:v\d+)?$/i.exec(value)?.[1] ??
    /^(?:arxiv:\s*)?([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i.exec(value)?.[1] ??
    /10\.48550\/arxiv\.(\S+)/i.exec(value)?.[1];
  if (arxiv) return { kind: "arxiv", value: arxiv };
  const doi = /(10\.\d{4,9}\/[^\s"<>]+)/.exec(value)?.[1];
  if (doi) return { kind: "doi", value: doi.replace(/[.,;]$/, "") };
  const pmid = /(?:pubmed\.ncbi\.nlm\.nih\.gov\/|^pmid:?\s*)(\d{1,9})/i.exec(value)?.[1];
  if (pmid) return { kind: "pmid", value: pmid };
  return null;
}

interface CrossrefWork {
  DOI: string;
  type?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string; name?: string; ORCID?: string }>;
  editor?: Array<{ given?: string; family?: string; name?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  URL?: string;
  abstract?: string;
  ISBN?: string[];
}

const CROSSREF_TYPES: Record<string, PaperType> = {
  "journal-article": "article",
  "proceedings-article": "conferencePaper",
  "posted-content": "preprint",
  book: "book",
  monograph: "book",
  "edited-book": "book",
  "book-chapter": "bookChapter",
  dissertation: "thesis",
  report: "report"
};

function crossrefCreators(list?: CrossrefWork["author"]): Creator[] {
  return (list ?? []).map((c) => (c.family ? { family: c.family, given: c.given } : { literal: c.name ?? c.given ?? "" }));
}

async function lookupDoi(doi: string): Promise<PaperCandidate> {
  const { message: work } = await getJson<{ message: CrossrefWork }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const [year, month, day] = work.issued?.["date-parts"]?.[0] ?? [];
  return {
    title: work.title?.[0] ?? "Untitled",
    type: CROSSREF_TYPES[work.type ?? ""] ?? "other",
    authors: crossrefCreators(work.author),
    editors: work.editor?.length ? crossrefCreators(work.editor) : undefined,
    issued: year ? { year, month, day } : undefined,
    containerTitle: work["container-title"]?.[0],
    volume: work.volume,
    issue: work.issue,
    pages: work.page?.replace("-", "–"),
    publisher: work.publisher,
    isbn: work.ISBN,
    doi: work.DOI,
    url: work.URL,
    abstract: work.abstract?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined,
    source: "manual"
  };
}

interface DataCiteDoi {
  data: {
    attributes: {
      titles?: Array<{ title: string }>;
      creators?: Array<{ name?: string; givenName?: string; familyName?: string; nameType?: string }>;
      publicationYear?: number;
      descriptions?: Array<{ description: string; descriptionType?: string }>;
      url?: string;
      publisher?: string | { name?: string };
    };
  };
}

async function lookupArxiv(id: string): Promise<PaperCandidate> {
  const { data } = await getJson<DataCiteDoi>(`https://api.datacite.org/dois/10.48550/arXiv.${encodeURIComponent(id)}`);
  const a = data.attributes;
  return {
    title: a.titles?.[0]?.title ?? "Untitled",
    type: "preprint",
    authors: (a.creators ?? []).map((c) =>
      c.familyName ? { family: c.familyName, given: c.givenName } : c.nameType === "Organizational" ? { literal: c.name ?? "" } : splitName(c.name ?? "")
    ),
    issued: a.publicationYear ? { year: a.publicationYear } : undefined,
    containerTitle: "arXiv",
    arxivId: id,
    url: `https://arxiv.org/abs/${id}`,
    openAccessPdfUrl: `https://arxiv.org/pdf/${id}`,
    abstract: a.descriptions?.find((d) => d.descriptionType === "Abstract")?.description?.replace(/\s+/g, " ").trim(),
    source: "manual"
  };
}

async function lookupPmid(pmid: string): Promise<PaperCandidate> {
  const work = await getJson<OpenAlexWork>(`https://api.openalex.org/works/pmid:${pmid}?select=${OPENALEX_SELECT}`);
  return { ...fromOpenAlex(work), pmid };
}

export async function lookupIdentifier(identifier: Identifier): Promise<PaperCandidate> {
  try {
    if (identifier.kind === "arxiv") return await lookupArxiv(identifier.value);
    if (identifier.kind === "pmid") return await lookupPmid(identifier.value);
    return await lookupDoi(identifier.value);
  } catch (error) {
    const label = identifier.kind === "doi" ? "DOI" : identifier.kind === "arxiv" ? "arXiv ID" : "PMID";
    throw new Error(`Couldn't find ${label} ${identifier.value}${error instanceof Error ? ` (${error.message})` : ""}.`);
  }
}
