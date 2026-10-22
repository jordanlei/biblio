import { normalizeArxivId, normalizeDoi, type Paper } from "@biblio/core";
import { extensionAvailable, extensionFetch, extensionPublisherPdf } from "./extensionBridge";

// Finding and downloading PDFs. The publisher's version always wins: the PDF the Zotero translator
// found on the page, then the publisher's PDF via the DOI (through the extension, with the
// browser's institutional session), then published open-access copies and PMC, accepted
// manuscripts, and only last preprints (arXiv, OSF, bioRxiv…). Each URL is tried directly, then
// through the Biblio extension when it is trusted.

export interface PdfSource {
  url: string;
  host: string;
  label: string;
  /**
   * True when Biblio worked this URL out itself (arXiv from a verified id, or a location OpenAlex
   * returned). A captured translator URL is trusted only when its short-lived extension token is
   * present; ordinary paper/import URLs are never fetched with the user's cookies attached.
   */
  trusted?: boolean;
  /** Short-lived capability from the extension for the captured translator URL. */
  captureToken?: string;
  /** Publisher landing page for this DOI: fetched only through the extension's DOI resolver. */
  publisherDoi?: string;
}

const MAX_BYTES = 80 * 1024 * 1024;

function source(url: string, label?: string, trusted = false, captureToken?: string): PdfSource {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return { url, host, label: label ?? host, trusted, captureToken };
}

interface OpenAlexLocation {
  pdf_url?: string | null;
  landing_page_url?: string | null;
  /** publishedVersion (version of record), acceptedVersion (author manuscript), submittedVersion (preprint). */
  version?: string | null;
}

interface OpenAlexLocations {
  best_oa_location?: OpenAlexLocation | null;
  primary_location?: OpenAlexLocation | null;
  locations?: OpenAlexLocation[];
}

/** Landing pages whose PDF lives at a predictable address. */
export function pdfFromLandingPage(url?: string): string | undefined {
  if (!url) return undefined;
  const rules: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/proceedings\.neurips\.cc\/paper(?:_files\/paper)?\/(\d{4})\/hash\/([0-9a-f]+)-Abstract(?:-Conference)?\.html/i, (m) => `https://proceedings.neurips.cc/paper/${m[1]}/file/${m[2]}-Paper.pdf`],
    [/openreview\.net\/forum\?id=([\w-]+)/i, (m) => `https://openreview.net/pdf?id=${m[1]}`],
    [/aclanthology\.org\/([\w.-]+?)\/?$/i, (m) => `https://aclanthology.org/${m[1]}.pdf`],
    [/proceedings\.mlr\.press\/(v\d+)\/([\w-]+)\.html/i, (m) => `https://proceedings.mlr.press/${m[1]}/${m[2]}/${m[2]}.pdf`],
    [/(biorxiv|medrxiv)\.org\/content\/(10\.1101\/[\w.]+v\d+)(?:[?#].*)?$/i, (m) => `https://www.${m[1]}.org/content/${m[2]}.full.pdf`]
  ];
  for (const [pattern, build] of rules) {
    const match = url.match(pattern);
    if (match) return build(match);
  }
  return undefined;
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function normalizePmcId(value?: string) {
  const match = String(value ?? "").trim().match(/^PMC(\d+)$/i);
  return match ? `PMC${match[1]}` : undefined;
}

/** PMC redirects this stable article endpoint to the article's actual PDF when one exists. */
function pmcPdfUrl(pmcid?: string) {
  const id = normalizePmcId(pmcid);
  return id ? `https://pmc.ncbi.nlm.nih.gov/articles/${id}/pdf/` : undefined;
}

/** The paper's OpenAlex record: by DOI, or failing that by exact title (and year) match. */
async function openAlexWork(paper: Paper): Promise<OpenAlexLocations | null> {
  const select = "select=display_name,publication_year,best_oa_location,primary_location,locations";
  try {
    const doi = normalizeDoi(paper.doi);
    if (doi) {
      const response = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?${select}`);
      if (response.ok) return (await response.json()) as OpenAlexLocations;
    }
    const title = paper.title.replace(/[:,|"]/g, " ").trim();
    if (title.length < 12) return null;
    const response = await fetch(`https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title)}&per-page=5&${select}`);
    if (!response.ok) return null;
    const { results } = (await response.json()) as { results: Array<OpenAlexLocations & { display_name?: string; publication_year?: number }> };
    const year = paper.issued?.year;
    return (
      results.find((w) => squash(w.display_name ?? "") === squash(paper.title) && (!year || !w.publication_year || Math.abs(w.publication_year - year) <= 1)) ??
      null
    );
  } catch {
    return null; // Offline or rate-limited: fall back to what we already know.
  }
}

// Preprint servers: a copy from one of these is never preferred over the publisher's version.
const PREPRINT_HOSTS = /(^|\.)(arxiv\.org|biorxiv\.org|medrxiv\.org|osf\.io|psyarxiv\.com|ssrn\.com|researchsquare\.com|preprints\.org|chemrxiv\.org|zenodo\.org|europepmc\.org\/article\/PPR)$/i;

/** Lower is better: the publisher's version of record, then PMC, accepted manuscripts, preprints. */
const RANK = { publisher: 0, published: 1, pmc: 2, accepted: 3, unknown: 4, preprint: 5, link: 6 } as const;

export function isPreprint(url: string) {
  try {
    return PREPRINT_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function openAlexRank(location: OpenAlexLocation): number {
  if (location.pdf_url && isPreprint(location.pdf_url)) return RANK.preprint;
  if (location.version === "publishedVersion") return RANK.published;
  if (location.version === "acceptedVersion") return RANK.accepted;
  if (location.version === "submittedVersion") return RANK.preprint;
  return RANK.unknown;
}

/** Every plausible PDF URL for a paper, publisher's version first and preprints last, de-duplicated. */
export async function findPdfSources(paper: Paper, captureToken?: string): Promise<PdfSource[]> {
  const ranked: Array<{ rank: number; source: PdfSource }> = [];
  const add = (rank: number, url?: string | null, label?: string, trusted = false, token?: string) => {
    if (!url || !/^https?:/i.test(url)) return undefined;
    const seen = ranked.find((r) => r.source.url === url);
    if (seen) {
      seen.rank = Math.min(seen.rank, rank);
      return seen.source;
    }
    const added = source(url, label, trusted, token);
    ranked.push({ rank, source: added });
    return added;
  };
  // The PDF the Zotero translator found on the page. The capture token lets the extension fetch
  // that exact URL with the browser's cookies when a publisher requires an institutional session.
  const translatorUrl = paper.openAccessPdfUrl;
  if (translatorUrl) add(isPreprint(translatorUrl) ? RANK.preprint : RANK.publisher, translatorUrl, undefined, Boolean(captureToken), captureToken);
  const doi = normalizeDoi(paper.doi);
  const publisher = doi ? add(RANK.publisher, `https://doi.org/${doi}`, "Publisher") : undefined;
  if (publisher) publisher.publisherDoi = doi;
  const landing = pdfFromLandingPage(paper.url);
  if (landing) add(isPreprint(landing) ? RANK.preprint : RANK.publisher, landing);
  add(RANK.pmc, pmcPdfUrl(paper.pmcid), "PubMed Central", true);
  let arxivId = normalizeArxivId(paper.arxivId);
  if (arxivId) add(RANK.preprint, `https://arxiv.org/pdf/${arxivId}`, "arXiv", true);
  // Not downloadable as a PDF, but available to open manually after a failed search.
  if (paper.pmid) add(RANK.link, `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`, "PubMed");

  const work = await openAlexWork(paper);
  if (work) {
    const arxivPage = work.locations?.map((l) => l.landing_page_url).find((u) => u?.includes("arxiv.org/abs/"));
    if (!arxivId && arxivPage) {
      arxivId = normalizeArxivId(arxivPage)?.replace(/v\d+$/, "");
      if (arxivId) add(RANK.preprint, `https://arxiv.org/pdf/${arxivId}`, "arXiv", true);
    }
    for (const location of [work.best_oa_location, work.primary_location, ...(work.locations ?? [])]) {
      if (location?.pdf_url) add(openAlexRank(location), location.pdf_url, undefined, true);
    }
  }
  // Stable sort: within a rank, the order above (translator, DOI, PMC, OpenAlex's best) holds.
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.source);
}

async function isPdf(blob: Blob) {
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  // "%PDF-" may be preceded by a few junk bytes in the wild.
  return new TextDecoder("latin1").decode(head).includes("%PDF-");
}

async function direct(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null; // Usually CORS.
  }
}

export type FetchStep = (message: string) => void;

/** Download the first source that yields a real PDF. Throws with a helpful message when none do. */
export async function downloadPdf(sources: PdfSource[], onStep: FetchStep = () => undefined): Promise<{ blob: Blob; source: PdfSource }> {
  const hasExtension = await extensionAvailable();
  for (const candidate of sources) {
    onStep(`Downloading from ${candidate.label}…`);
    // The extension fetch sends the user's cookies, so ordinary paper-record URLs are excluded;
    // a translator URL may opt in with its short-lived capture token.
    const privileged = hasExtension && candidate.trusted;
    const publisherDoi = candidate.publisherDoi;
    const attempts = publisherDoi
      ? hasExtension ? [() => extensionPublisherPdf(publisherDoi)] : []
      : [() => direct(candidate.url), ...(privileged ? [() => extensionFetch(candidate.url, candidate.captureToken)] : [])];
    for (const attempt of attempts) {
      const blob = await attempt();
      if (blob && blob.size <= MAX_BYTES && (await isPdf(blob))) return { blob, source: candidate };
    }
  }
  throw new Error(sources.length ? "No downloadable PDF was found in the available sources." : "No PDF was found for this paper.");
}
