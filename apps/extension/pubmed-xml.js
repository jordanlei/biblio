// Structured PubMed author parsing adapted from Zotero's PubMed translator flow.
// Zotero resolves a PMID through NCBI E-utilities and reads LastName, ForeName, and Suffix
// separately. This small parser keeps the extension independent of Zotero's runtime.
(() => {
  const text = (xml, tag) => {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
    return match ? match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim() : "";
  };

  globalThis.BiblioPubMed = {
    parse(xml) {
      const article = /<PubmedArticle[\s\S]*?<\/PubmedArticle>/i.exec(String(xml))?.[0] || String(xml);
      const authors = [...article.matchAll(/<Author\b[\s\S]*?<\/Author>/gi)].map((match) => {
        const author = match[0];
        const family = text(author, "LastName");
        const given = text(author, "ForeName") || text(author, "Initials");
        const suffix = text(author, "Suffix");
        if (family) return `${family}, ${[given, suffix].filter(Boolean).join(" ")}`;
        return text(author, "CollectiveName");
      }).filter(Boolean);
      return {
        title: text(article, "ArticleTitle"),
        authors,
        year: Number(text(article, "Year")) || undefined,
        venue: text(article, "Title"),
        volume: text(article, "Volume"),
        issue: text(article, "Issue"),
        pmid: text(article, "PMID")
      };
    }
  };
})();
