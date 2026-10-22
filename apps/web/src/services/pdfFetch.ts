import { normalizeArxivId, normalizeDoi, type Paper } from "@biblio/core";
import { auth } from "../firebase";
import { extensionAvailable, extensionFetch, extensionPublisherPdf } from "./extensionBridge";

// Finding and downloading PDFs, in Zotero's order: the PDF the Zotero translator found on the
// page, then the publisher's own PDF via the DOI (through the extension, with the browser's
// institutional session), and only then open-access copies (PMC, arXiv, OpenAlex). Each URL is tried directly, then through the Biblio
// extension when it is trusted, then through the optional `fetchPdf` Cloud Function.

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

interface OpenAlexLocations {
  best_oa_location?: { pdf_url?: string | null } | null;
  primary_location?: { pdf_url?: string | null; landing_page_url?: string | null } | null;
  locations?: Array<{ pdf_url?: string | null; landing_page_url?: string | null }>;
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

/** Every plausible open-access PDF URL for a paper, best first, de-duplicated. */
export async function findPdfSources(paper: Paper, captureToken?: string): Promise<PdfSource[]> {
  const urls: PdfSource[] = [];
  const add = (url?: string | null, label?: string, trusted = false, token?: string) => {
    if (!url || !/^https?:/i.test(url) || urls.some((s) => s.url === url)) return undefined;
    const added = source(url, label, trusted, token);
    urls.push(added);
    return added;
  };
  let arxivId = normalizeArxivId(paper.arxivId);
  // Keep the translator-provided URL first. The capture token lets the extension fetch that exact
  // URL with the browser's cookies when a publisher requires an institutional session.
  add(paper.openAccessPdfUrl, undefined, Boolean(captureToken), captureToken);
  const doi = normalizeDoi(paper.doi);
  const publisher = doi ? add(`https://doi.org/${doi}`, "Publisher") : undefined;
  if (publisher) publisher.publisherDoi = doi;
  add(pdfFromLandingPage(paper.url));
  add(pmcPdfUrl(paper.pmcid), "PubMed Central", true);
  if (arxivId) add(`https://arxiv.org/pdf/${arxivId}`, "arXiv", true);
  // Not downloadable as a PDF, but available to open manually after a failed search.
  if (paper.pmid) add(`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`, "PubMed");

  const work = await openAlexWork(paper);
  if (work) {
    const arxivPage = work.locations?.map((l) => l.landing_page_url).find((u) => u?.includes("arxiv.org/abs/"));
    if (!arxivId && arxivPage) {
      arxivId = normalizeArxivId(arxivPage)?.replace(/v\d+$/, "");
      if (arxivId) add(`https://arxiv.org/pdf/${arxivId}`, "arXiv", true);
    }
    add(work.best_oa_location?.pdf_url, undefined, true);
    add(work.primary_location?.pdf_url, undefined, true);
    for (const location of work.locations ?? []) add(location.pdf_url, undefined, true);
  }
  return urls;
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

async function viaFunction(url: string): Promise<Blob | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/fetch-pdf?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok || !response.headers.get("content-type")?.includes("pdf")) return null;
    return await response.blob();
  } catch {
    return null;
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
    const attempts = publisherDoi ? (hasExtension ? [() => extensionPublisherPdf(publisherDoi)] : []) : [() => direct(candidate.url), ...(privileged ? [() => extensionFetch(candidate.url, candidate.captureToken)] : []), ...(candidate.trusted ? [() => viaFunction(candidate.url)] : [])];
    for (const attempt of attempts) {
      const blob = await attempt();
      if (blob && blob.size <= MAX_BYTES && (await isPdf(blob))) return { blob, source: candidate };
    }
  }
  throw new Error(sources.length ? "No downloadable PDF was found in the available sources." : "No PDF was found for this paper.");
}
