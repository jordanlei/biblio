// Injected into the current tab (chrome.scripting.executeScript({ files: ["extract.js"] })).
// A small translator-shaped capture layer: run Biblio Translate first, then native site
// translators, then generic metadata translators. It keeps the extension small while leaving a
// path to vendored open-source translator files.
// The last expression is the result returned to the popup/background script.
(() => {
  const metas = (names) =>
    names.flatMap((name) => Array.from(document.querySelectorAll(`meta[name="${name}" i], meta[property="${name}" i]`)).map((m) => m.content?.trim())).filter(Boolean);
  const meta = (...names) => metas(names)[0] || "";
  const url = location.href;
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const absolute = (href) => {
    try {
      return href ? new URL(href, location.href).href : "";
    } catch {
      return "";
    }
  };

  function compact(item, translator) {
    const title = clean(item.title);
    const authors = (item.authors || []).map(clean).filter(Boolean);
    const doi = clean(item.doi).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:)/i, "");
    const arxivId = clean(item.arxivId).replace(/^arxiv:/i, "");
    return {
      title,
      authors,
      year: Number(item.year) || undefined,
      venue: clean(item.venue),
      volume: clean(item.volume),
      issue: clean(item.issue),
      pages: clean(item.pages),
      publisher: clean(item.publisher),
      doi,
      arxivId,
      pmid: clean(item.pmid),
      abstract: clean(item.abstract).slice(0, 6000),
      pdfUrl: absolute(item.pdfUrl),
      url: absolute(item.url) || url,
      isPaper: Boolean(title && (authors.length || doi || arxivId || item.isPaper)),
      translator
    };
  }

  function jsonLdArticle() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "null");
        const items = [data, ...(Array.isArray(data) ? data : []), ...(data?.["@graph"] ?? [])].flat();
        const hit = items.find((item) => /ScholarlyArticle|Article|Report|Thesis|Chapter|Book/.test(String(item?.["@type"])));
        if (hit) return hit;
      } catch {
        // ignore malformed JSON-LD
      }
    }
    return {};
  }

  const translated = globalThis.BiblioTranslate?.run?.(document, url);
  if (translated?.isPaper && translated.title) return translated;

  const translators = [
    {
      label: "arXiv",
      detect: () => /(^|\.)arxiv\.org$/i.test(location.hostname) && /\/(?:abs|pdf|html)\//i.test(location.pathname),
      extract: () => {
        const arxivId = (url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#\s]+?)(?:v\d+)?(?:\.pdf)?(?:[?#]|$)/i) || [])[1] || meta("citation_arxiv_id");
        return compact(
          {
            title: meta("citation_title") || document.querySelector("h1.title")?.textContent?.replace(/^Title:\s*/i, "") || document.title,
            authors: metas(["citation_author"]).length
              ? metas(["citation_author"])
              : Array.from(document.querySelectorAll(".authors a")).map((a) => a.textContent),
            year: Number((meta("citation_date") || document.querySelector(".dateline")?.textContent || "").match(/(1[89]|20)\d{2}/)?.[0]),
            abstract: meta("citation_abstract") || document.querySelector("blockquote.abstract")?.textContent?.replace(/^Abstract:\s*/i, ""),
            arxivId,
            pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : meta("citation_pdf_url"),
            url,
            isPaper: true
          },
          "arXiv"
        );
      }
    },
    {
      label: "PubMed",
      detect: () => /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i.test(location.hostname) && /\/\d+\/?$/i.test(location.pathname),
      extract: () =>
        compact(
          {
            title: meta("citation_title") || document.querySelector("h1.heading-title")?.textContent,
            authors: metas(["citation_author"]).length
              ? metas(["citation_author"])
              : Array.from(document.querySelectorAll(".authors-list .full-name")).map((a) => a.textContent),
            year: Number((meta("citation_publication_date") || document.querySelector(".cit")?.textContent || "").match(/(1[89]|20)\d{2}/)?.[0]),
            venue: meta("citation_journal_title"),
            volume: meta("citation_volume"),
            issue: meta("citation_issue"),
            pages: meta("citation_firstpage"),
            doi: meta("citation_doi"),
            pmid: location.pathname.match(/\/(\d+)\/?$/)?.[1],
            abstract: meta("citation_abstract") || document.querySelector("#enc-abstract, .abstract")?.textContent,
            pdfUrl: meta("citation_pdf_url"),
            url,
            isPaper: true
          },
          "PubMed"
        )
    },
    {
      label: "OpenReview",
      detect: () => /(^|\.)openreview\.net$/i.test(location.hostname) && /[?&]id=/.test(location.search),
      extract: () =>
        compact(
          {
            title: meta("citation_title") || meta("og:title") || document.querySelector("h2, h1")?.textContent,
            authors: metas(["citation_author"]),
            year: Number((meta("citation_publication_date") || document.body.textContent || "").match(/(1[89]|20)\d{2}/)?.[0]),
            venue: meta("citation_conference_title") || meta("citation_journal_title"),
            doi: meta("citation_doi"),
            abstract: meta("citation_abstract", "description", "og:description"),
            pdfUrl: absolute(document.querySelector('a[href*="/pdf?id="]')?.getAttribute("href")) || meta("citation_pdf_url"),
            url,
            isPaper: true
          },
          "OpenReview"
        )
    },
    {
      label: "DOI page",
      detect: () => Boolean((url.match(/(?:doi\.org\/|\/doi\/(?:abs\/|full\/|pdf\/)?)(10\.\d{4,9}\/[^?#\s]+)/i) || [])[1]),
      extract: () =>
        compact(
          {
            title: meta("citation_title", "dc.title", "eprints.title", "og:title") || document.title,
            authors: metas(["citation_author"]).length ? metas(["citation_author"]) : metas(["dc.creator", "dc.contributor"]),
            year: Number((meta("citation_publication_date", "citation_date", "dc.date", "prism.publicationdate") || "").match(/(1[89]|20)\d{2}/)?.[0]),
            venue: meta("citation_journal_title", "citation_conference_title", "citation_book_title", "prism.publicationname", "dc.source"),
            volume: meta("citation_volume", "prism.volume"),
            issue: meta("citation_issue", "prism.number"),
            pages: meta("citation_firstpage"),
            publisher: meta("citation_publisher", "dc.publisher"),
            doi: (url.match(/(?:doi\.org\/|\/doi\/(?:abs\/|full\/|pdf\/)?)(10\.\d{4,9}\/[^?#\s]+)/i) || [])[1] || meta("citation_doi"),
            abstract: meta("citation_abstract", "dc.description", "description", "og:description"),
            pdfUrl: meta("citation_pdf_url"),
            url,
            isPaper: true
          },
          "DOI page"
        )
    },
    {
      label: "Generic scholarly metadata",
      detect: () => true,
      extract: () => {
        const ld = jsonLdArticle();
        const ldAuthors = []
          .concat(ld.author ?? [])
          .map((a) => (typeof a === "string" ? a : a?.name))
          .filter(Boolean);

        const isPdf = document.contentType === "application/pdf" || /\.pdf($|[?#])/i.test(location.pathname);
        const arxivId =
          meta("citation_arxiv_id") ||
          (url.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?#\s]+?)(?:v\d+)?(?:\.pdf)?(?:[?#]|$)/i) || [])[1] ||
          "";
        const doiFromUrl = (url.match(/(?:doi\.org\/|\/doi\/(?:abs\/|full\/|pdf\/)?)(10\.\d{4,9}\/[^?#\s]+)/i) || [])[1] || "";
        const first = meta("citation_firstpage");
        const last = meta("citation_lastpage");
        return compact(
          {
            title:
              meta("citation_title", "dc.title", "eprints.title") ||
              ld.headline ||
              ld.name ||
              (isPdf ? "" : meta("og:title")) ||
              (isPdf ? decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.pdf$/i, "") : document.title),
            authors: metas(["citation_author"]).length ? metas(["citation_author"]) : metas(["dc.creator", "dc.contributor"]).length ? metas(["dc.creator", "dc.contributor"]) : ldAuthors,
            year: Number((meta("citation_publication_date", "citation_date", "citation_online_date", "dc.date", "prism.publicationdate") || ld.datePublished || "").match(/(1[89]|20)\d{2}/)?.[0]),
            venue: meta("citation_journal_title", "citation_conference_title", "citation_book_title", "prism.publicationname", "dc.source") || ld.isPartOf?.name,
            volume: meta("citation_volume", "prism.volume"),
            issue: meta("citation_issue", "prism.number"),
            pages: first ? (last ? `${first}-${last}` : first) : "",
            publisher: meta("citation_publisher", "dc.publisher") || ld.publisher?.name,
            doi: meta("citation_doi", "dc.identifier", "prism.doi", "doi") || ld.doi || doiFromUrl,
            arxivId,
            pmid: meta("citation_pmid"),
            abstract: meta("citation_abstract", "dc.description", "description", "og:description"),
            pdfUrl: isPdf ? url : meta("citation_pdf_url") || (arxivId ? `https://arxiv.org/pdf/${arxivId}` : ""),
            url,
            isPaper: Boolean(meta("citation_title") || doiFromUrl || arxivId || ld.headline || isPdf)
          },
          "Generic scholarly metadata"
        );
      }
    }
  ];

  for (const translator of translators) {
    try {
      if (!translator.detect()) continue;
      const result = translator.extract();
      if (result?.isPaper && result.title) return result;
    } catch {
      // A broken page-specific translator should not prevent generic capture.
    }
  }

  return { title: "", authors: [], url, isPaper: false, translator: "None" };
})();
