// Injected into the current tab (chrome.scripting.executeScript({ files: ["extract.js"] })).
// Reads scholarly metadata the way Zotero's generic translators do: Highwire/Google Scholar
// citation_* tags, Dublin Core, JSON-LD, then URL patterns. The last expression is the result.
(() => {
  const metas = (names) =>
    names.flatMap((name) => Array.from(document.querySelectorAll(`meta[name="${name}" i], meta[property="${name}" i]`)).map((m) => m.content?.trim())).filter(Boolean);
  const meta = (...names) => metas(names)[0] || "";
  const url = location.href;

  // JSON-LD (schema.org ScholarlyArticle and friends).
  let ld = {};
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || "null");
      const items = [data, ...(Array.isArray(data) ? data : []), ...(data?.["@graph"] ?? [])].flat();
      const hit = items.find((item) => /ScholarlyArticle|Article|Report|Thesis|Chapter|Book/.test(String(item?.["@type"])));
      if (hit) {
        ld = hit;
        break;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  const ldAuthors = [].concat(ld.author ?? []).map((a) => (typeof a === "string" ? a : a?.name)).filter(Boolean);

  const isPdf = document.contentType === "application/pdf" || /\.pdf($|[?#])/i.test(location.pathname);
  const arxivId =
    meta("citation_arxiv_id") ||
    (url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#\s]+?)(?:v\d+)?(?:\.pdf)?(?:[?#]|$)/i) || [])[1] ||
    "";
  const doiFromUrl = (url.match(/(?:doi\.org\/|\/doi\/(?:abs\/|full\/|pdf\/)?)(10\.\d{4,9}\/[^?#\s]+)/i) || [])[1] || "";
  const doi = (meta("citation_doi", "dc.identifier", "prism.doi", "doi") || ld.doi || doiFromUrl).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:)/i, "");

  const authors = metas(["citation_author"]);
  const title =
    meta("citation_title", "dc.title", "eprints.title") ||
    ld.headline ||
    ld.name ||
    (isPdf ? "" : meta("og:title")) ||
    (isPdf ? decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.pdf$/i, "") : document.title);

  const date = meta("citation_publication_date", "citation_date", "citation_online_date", "dc.date", "prism.publicationdate") || ld.datePublished || "";
  const year = Number((date.match(/(1[89]|20)\d{2}/) || [])[0]) || undefined;
  const first = meta("citation_firstpage");
  const last = meta("citation_lastpage");

  const result = {
    title: (title || "").replace(/\s+/g, " ").trim(),
    authors: authors.length ? authors : metas(["dc.creator", "dc.contributor"]).length ? metas(["dc.creator", "dc.contributor"]) : ldAuthors,
    year,
    venue: meta("citation_journal_title", "citation_conference_title", "citation_book_title", "prism.publicationname", "dc.source") || ld.isPartOf?.name || "",
    volume: meta("citation_volume", "prism.volume"),
    issue: meta("citation_issue", "prism.number"),
    pages: first ? (last ? `${first}–${last}` : first) : "",
    publisher: meta("citation_publisher", "dc.publisher") || ld.publisher?.name || "",
    doi,
    arxivId,
    pmid: meta("citation_pmid"),
    abstract: meta("citation_abstract", "dc.description", "description", "og:description").slice(0, 6000),
    pdfUrl: isPdf ? url : meta("citation_pdf_url") || (arxivId ? `https://arxiv.org/pdf/${arxivId}` : ""),
    url,
    isPaper: Boolean(meta("citation_title") || doi || arxivId || ld.headline || isPdf)
  };
  return result;
})();
