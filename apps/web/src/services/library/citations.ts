import { normalizeArxivId, normalizeDoi, normalizeTitleKey, type Paper } from "@biblio/core";
import { computed, ref } from "vue";
import { useLibrary } from "./library";

// Who cites whom inside the library, from OpenAlex's reference lists. Each paper is looked up by
// DOI (arXiv papers by their DataCite DOI) in batches of 50; papers without one, or whose DOI
// OpenAlex doesn't know, are tried by exact title. Answers are cached on this device: derived
// data, cheap to refetch, never written to Drive. Some papers simply aren't in OpenAlex.

interface Entry {
  /** OpenAlex work id ("W123…"), or null when OpenAlex doesn't know the DOI. */
  oa: string | null;
  refs: string[];
  citedBy: number;
  fetchedAt: number;
  /** Found (or not) by title rather than DOI. */
  byTitle?: boolean;
}

const STORAGE_KEY = "biblio.citations.v1";
const FRESH_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 50;

function load(): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Entry>;
  } catch {
    return {};
  }
}

const cache = ref<Record<string, Entry>>(load());
const loading = ref(false);
const failed = ref(false);

/** The DOI a paper is looked up by, lowercased. */
export function lookupDoi(paper: Pick<Paper, "doi" | "arxivId">): string | undefined {
  const doi = normalizeDoi(paper.doi);
  if (doi) return doi.toLowerCase();
  const arxiv = normalizeArxivId(paper.arxivId)?.replace(/v\d+$/, "");
  return arxiv ? `10.48550/arxiv.${arxiv}`.toLowerCase() : undefined;
}

/** Cache key for a paper: its DOI, else its normalized title. */
function cacheKey(paper: Pick<Paper, "doi" | "arxivId" | "title">): string | undefined {
  const doi = lookupDoi(paper);
  if (doi) return doi;
  const title = normalizeTitleKey(paper.title);
  return title.length >= 12 ? `title:${title}` : undefined;
}

/** Title lookups are one request each; spread a big first run over several visits. */
const TITLE_LOOKUPS_PER_RUN = 40;

const stale = (entry: Entry | undefined) => !entry || Date.now() - entry.fetchedAt > (entry.oa ? FRESH_MS : MISS_RETRY_MS);

let inflight: Promise<void> | null = null;

/** Fetch reference lists for library papers not yet cached (or stale). Safe to call often. */
export function refreshCitations(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { papers } = useLibrary();
    const missing = [...new Set(papers.value.map(lookupDoi).filter((doi): doi is string => Boolean(doi) && stale(cache.value[doi!])))];
    const needsTitle = () =>
      papers.value.filter((p) => {
        const key = cacheKey(p);
        if (!key) return false;
        const entry = cache.value[key];
        return key.startsWith("title:") ? stale(entry) : Boolean(entry && !entry.oa && !entry.byTitle);
      });
    if (!missing.length && !needsTitle().length) return;
    loading.value = true;
    failed.value = false;
    const next = { ...cache.value };
    try {
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        const url = new URL("https://api.openalex.org/works");
        url.searchParams.set("filter", `doi:${batch.join("|")}`);
        url.searchParams.set("per-page", String(BATCH));
        url.searchParams.set("select", "id,doi,referenced_works,cited_by_count");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`);
        const data = (await response.json()) as { results: Array<{ id: string; doi?: string | null; referenced_works?: string[]; cited_by_count?: number }> };
        const found = new Map(data.results.map((w) => [normalizeDoi(w.doi ?? undefined)?.toLowerCase(), w]));
        for (const doi of batch) {
          const work = found.get(doi);
          next[doi] = work
            ? { oa: shortId(work.id), refs: (work.referenced_works ?? []).map(shortId), citedBy: work.cited_by_count ?? 0, fetchedAt: Date.now() }
            : { oa: null, refs: [], citedBy: 0, fetchedAt: Date.now() };
        }
        cache.value = { ...next };
      }
      // Fallback: match by exact title (and year, when known).
      for (const paper of needsTitle().slice(0, TITLE_LOOKUPS_PER_RUN)) {
        const key = cacheKey(paper)!;
        const work = await findByTitle(paper);
        next[key] = work
          ? { oa: shortId(work.id), refs: (work.referenced_works ?? []).map(shortId), citedBy: work.cited_by_count ?? 0, fetchedAt: Date.now(), byTitle: true }
          : { oa: null, refs: [], citedBy: 0, fetchedAt: Date.now(), byTitle: true };
        cache.value = { ...next };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Citation lookup failed", error);
      failed.value = true;
    } finally {
      loading.value = false;
    }
  })().finally(() => (inflight = null));
  return inflight;
}

const shortId = (id: string) => id.replace("https://openalex.org/", "");

type Work = { id: string; display_name?: string | null; publication_year?: number | null; referenced_works?: string[]; cited_by_count?: number };

async function findByTitle(paper: Paper): Promise<Work | undefined> {
  const url = new URL("https://api.openalex.org/works");
  const year = paper.issued?.year;
  url.searchParams.set("filter", `title.search:${paper.title.replace(/[,|:]/g, " ")}${year ? `,publication_year:${year - 1}-${year + 1}` : ""}`);
  url.searchParams.set("per-page", "5");
  url.searchParams.set("select", "id,display_name,publication_year,referenced_works,cited_by_count");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`);
  const data = (await response.json()) as { results: Work[] };
  const want = normalizeTitleKey(paper.title);
  return data.results.find((w) => normalizeTitleKey(w.display_name ?? "") === want);
}

function entryFor(paper: Paper): Entry | undefined {
  const key = cacheKey(paper);
  return key ? cache.value[key] : undefined;
}

const graph = computed(() => {
  const { papers } = useLibrary();
  const byOa = new Map<string, Paper>();
  for (const paper of papers.value) {
    const oa = entryFor(paper)?.oa;
    if (oa) byOa.set(oa, paper);
  }
  const cites = new Map<string, Paper[]>();
  const citedBy = new Map<string, Paper[]>();
  for (const paper of papers.value) {
    const entry = entryFor(paper);
    if (!entry?.oa) continue;
    for (const ref of entry.refs) {
      const target = byOa.get(ref);
      if (!target || target.id === paper.id) continue;
      cites.set(paper.id, [...(cites.get(paper.id) ?? []), target]);
      citedBy.set(target.id, [...(citedBy.get(target.id) ?? []), paper]);
    }
  }
  return { cites, citedBy };
});

export interface CitationInfo {
  /** "none": nothing to look up by; "unknown": not in OpenAlex by DOI or title; "pending": not fetched yet. */
  state: "ready" | "none" | "unknown" | "pending";
  cites: Paper[];
  citedBy: Paper[];
  referenceCount: number;
  citedByCount: number;
}

export function citationInfo(paper: Paper): CitationInfo {
  const key = cacheKey(paper);
  const entry = key ? cache.value[key] : undefined;
  // A DOI miss isn't final until the title lookup has had its turn.
  const state = !key ? "none" : !entry ? "pending" : entry.oa ? "ready" : entry.byTitle ? "unknown" : "pending";
  return {
    state,
    cites: graph.value.cites.get(paper.id) ?? [],
    citedBy: graph.value.citedBy.get(paper.id) ?? [],
    referenceCount: entry?.refs.length ?? 0,
    citedByCount: entry?.citedBy ?? 0
  };
}

export const citationsLoading = loading;
export const citationsFailed = failed;
