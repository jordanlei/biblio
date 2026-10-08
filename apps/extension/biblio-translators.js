// Bundled Biblio Translate translators. Translator code copied or adapted from open-source
// projects should be ported to this Biblio-native interface before it lands here.
(() => {
  const meta = (doc, ...names) =>
    names
      .flatMap((name) => Array.from(doc.querySelectorAll(`meta[name="${name}" i], meta[property="${name}" i]`)).map((node) => node.content?.trim()))
      .filter(Boolean)[0] || "";

  const authorsFromMeta = (doc) => Array.from(doc.querySelectorAll('meta[name="citation_author" i]')).map((node) => node.content);

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
