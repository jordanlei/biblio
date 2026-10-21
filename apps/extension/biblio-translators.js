/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The PubMed translator below is adapted from Zotero's official PubMed.js translator:
 * https://github.com/zotero/translators/blob/master/PubMed.js
 * Copyright © 2015 Philipp Zumstein and contributors.
 * See apps/extension/THIRD_PARTY_NOTICES.md and apps/extension/LICENSE.
 */
(() => {
  const meta = (doc, ...names) =>
    names
      .flatMap((name) => Array.from(doc.querySelectorAll(`meta[name="${name}" i], meta[property="${name}" i]`)).map((node) => node.content?.trim()))
      .filter(Boolean)[0] || "";

  const authorsFromMeta = (doc) => Array.from(doc.querySelectorAll('meta[name="citation_author" i]')).map((node) => node.content);

  // PubMed's current HTML is intentionally treated as a first-class translator. Older records
  // (including PMID 6238127) do not expose citation_* meta tags, while the visible author list
  // remains available in the page markup. This is the same shape as a Zotero site translator:
  // identify the site, then read its structured page fields before generic metadata.
  BiblioTranslate.register({
    id: "pubmed",
    label: "PubMed",
    target: "https?://(?:www\\.)?pubmed\\.ncbi\\.nlm\\.nih\\.gov/",
    priority: 10,
    detect(doc, url) {
      return /pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/?(?:$|[?#])/i.test(url) && Boolean(
        doc.querySelector('meta[name="ncbi_uidlist" i], meta[name="ncbi_article_id" i], meta[name="uid" i], link[rel="canonical" i], input#absid, h1.heading-title, .article-details, .citation')
      );
    },
    extract(doc, url) {
      const pmid = url.match(/\/(\d+)\/?(?:$|[?#])/i)?.[1] || meta(doc, "citation_pmid");
      const authors = authorsFromMeta(doc);
      if (!authors.length) {
        for (const selector of [".authors-list .full-name", ".authors-list a", ".author-list .full-name", "a.docsum-author"] ) {
          for (const node of doc.querySelectorAll(selector)) {
            const name = node.textContent?.replace(/\s+/g, " ").trim();
            if (name && !authors.includes(name)) authors.push(name);
          }
          if (authors.length) break;
        }
      }
      const first = meta(doc, "citation_firstpage");
      const last = meta(doc, "citation_lastpage");
      return {
        title: meta(doc, "citation_title") || doc.querySelector("h1.heading-title")?.textContent,
        authors,
        year: Number((meta(doc, "citation_publication_date") || doc.querySelector(".cit")?.textContent || "").match(/(1[89]|20)\d{2}/)?.[0]),
        venue: meta(doc, "citation_journal_title"),
        volume: meta(doc, "citation_volume"),
        issue: meta(doc, "citation_issue"),
        pages: first ? (last ? `${first}-${last}` : first) : "",
        doi: meta(doc, "citation_doi"),
        pmid,
        abstract: meta(doc, "citation_abstract") || doc.querySelector("#enc-abstract, .abstract")?.textContent,
        pdfUrl: meta(doc, "citation_pdf_url") || BiblioTranslate.absolute(doc.querySelector('a[href*="/pdf/"]')?.getAttribute("href"), url),
        url,
        isPaper: true
      };
    }
  });

  BiblioTranslate.register({
    id: "biblio-embedded-metadata",
    label: "Embedded Metadata",
    target: "https?://",
    priority: 80,
    detect(doc) {
      return Boolean(doc.querySelector('meta[name="citation_title" i], meta[name="citation_doi" i]'));
    },
    extract(doc, url) {
      const first = meta(doc, "citation_firstpage");
      const last = meta(doc, "citation_lastpage");
      return {
        title: meta(doc, "citation_title", "dc.title", "og:title") || doc.title,
        authors: authorsFromMeta(doc),
        year: Number((meta(doc, "citation_publication_date", "citation_date", "citation_online_date", "dc.date", "prism.publicationdate") || "").match(/(1[89]|20)\d{2}/)?.[0]),
        venue: meta(doc, "citation_journal_title", "citation_conference_title", "citation_book_title", "prism.publicationname", "dc.source"),
        volume: meta(doc, "citation_volume", "prism.volume"),
        issue: meta(doc, "citation_issue", "prism.number"),
        pages: first ? (last ? `${first}-${last}` : first) : "",
        publisher: meta(doc, "citation_publisher", "dc.publisher"),
        doi: meta(doc, "citation_doi", "prism.doi", "doi"),
        pmid: meta(doc, "citation_pmid"),
        abstract: meta(doc, "citation_abstract", "dc.description", "description", "og:description"),
        pdfUrl: BiblioTranslate.absolute(meta(doc, "citation_pdf_url"), url),
        url,
        isPaper: true
      };
    }
  });
})();
