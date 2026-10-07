import { normalizeArxivId, normalizeDoi, type Paper } from "@biblio/core";
import { auth } from "../firebase";
import { extensionFetch, extensionAvailable } from "./extensionBridge";

// Finding and downloading open-access PDFs. Sources, best first: arXiv by ID, the link saved at
// import, then every OA location OpenAlex knows for the DOI. Each URL is tried directly (works for
// CORS-friendly hosts like arXiv), then through the Biblio extension (works for any host the
// browser can reach), then through the optional `fetchPdf` Cloud Function.

export interface PdfSource {
  url: string;
  host: string;
  label: string;
}

const MAX_BYTES = 80 * 1024 * 1024;

function source(url: string, label?: string): PdfSource {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return { url, host, label: label ?? host };
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
export async function findPdfSources(paper: Paper): Promise<PdfSource[]> {
  const urls: PdfSource[] = [];
  const add = (url?: string | null, label?: string) => {
    if (!url || !/^https?:/i.test(url) || urls.some((s) => s.url === url)) return;
    urls.push(source(url, label));
  };
  let arxivId = normalizeArxivId(paper.arxivId);
  if (arxivId) add(`https://arxiv.org/pdf/${arxivId}`, "arXiv");
  add(paper.openAccessPdfUrl);
  add(pdfFromLandingPage(paper.url));

  const work = await openAlexWork(paper);
  if (work) {
    const arxivPage = work.locations?.map((l) => l.landing_page_url).find((u) => u?.includes("arxiv.org/abs/"));
    if (!arxivId && arxivPage) {
      arxivId = normalizeArxivId(arxivPage)?.replace(/v\d+$/, "");
      if (arxivId) urls.unshift(source(`https://arxiv.org/pdf/${arxivId}`, "arXiv"));
    }
    add(work.best_oa_location?.pdf_url);
    add(work.primary_location?.pdf_url);
    for (const location of work.locations ?? []) add(location.pdf_url);
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
    const attempts = [() => direct(candidate.url), ...(hasExtension ? [() => extensionFetch(candidate.url)] : []), () => viaFunction(candidate.url)];
    for (const attempt of attempts) {
      const blob = await attempt();
      if (blob && blob.size <= MAX_BYTES && (await isPdf(blob))) return { blob, source: candidate };
    }
  }
  if (!sources.length) throw new Error("No open-access copy is known for this paper.");
  throw new Error(
    hasExtension
      ? "Found open-access links, but none returned a PDF. Open one, save the PDF, and drop it here."
      : "This publisher blocks downloads from web pages. Install the Biblio extension to grab it, or open the link and drop the PDF here."
  );
}
