// Biblio Translate: a small local translator registry for scholarly pages.
//
// Translators are Biblio-owned modules with `detect(doc, url)` and `extract(doc, url)`.
// If translator logic is ported from open-source projects, adapt it to this interface first;
// the extension should not expose or depend on another application's runtime API.
(() => {
  const registry = [];

  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const absolute = (href, base = location.href) => {
    try {
      return href ? new URL(href, base).href : "";
    } catch {
      return "";
    }
  };

  function normalize(item, metadata) {
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
      url: absolute(item.url) || location.href,
      isPaper: Boolean(title && (authors.length || doi || arxivId || item.isPaper)),
      translator: `Biblio Translate: ${metadata.label || metadata.id || "translator"}`
    };
  }

  function run(doc = document, url = location.href) {
    const ordered = [...registry].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    for (const translator of ordered) {
      try {
        const target = translator.target ? new RegExp(translator.target, "i") : null;
        if (target && !target.test(url)) continue;
        if (!translator.detect(doc, url)) continue;
        const result = normalize(translator.extract(doc, url), translator);
        if (result.isPaper && result.title) return result;
      } catch {
        // Try the next translator or the native fallback.
      }
    }
    return null;
  }

  globalThis.BiblioTranslate = {
    clean,
    absolute,
    register(translator) {
      registry.push(translator);
    },
    run
  };
})();
