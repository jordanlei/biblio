import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPaper, exportBibtex, extractCitationLinkContexts, findExistingPaper, generateCitationKey, normalizeDoi, parseBibtex, replaceCitationKey } from "./index";
import type { Paper } from "./types";

const basePaper: Paper = {
  id: "p1",
  citationKey: "vaswaniAttentionNeed2017",
  type: "article",
  title: "Attention Is All You Need",
  authors: [{ family: "Vaswani", given: "Ashish" }],
  issued: { year: 2017 },
  tags: ["transformers"],
  folderIds: [],
  notesMarkdown: "",
  source: "manual",
  doi: "10.5555/example",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("core", () => {
  it("normalizes DOI prefixes", () => {
    expect(normalizeDoi("https://doi.org/10.5555/Example")).toBe("10.5555/example");
  });

  it("generates stable collision suffixes", () => {
    expect(
      generateCitationKey({
        title: "Attention Is All You Need",
        authors: [{ family: "Vaswani" }],
        year: 2017,
        existingKeys: ["vaswaniAttentionNeed2017"]
      })
    ).toBe("vaswaniAttentionNeed2017a");
  });

  it("finds exact DOI duplicates", () => {
    const duplicate = findExistingPaper({ title: "x", doi: "doi:10.5555/EXAMPLE" }, [basePaper]);
    expect(duplicate.kind).toBe("exact");
  });

  it("exports BibTeX", () => {
    expect(exportBibtex([basePaper])).toContain("@article{vaswaniAttentionNeed2017");
  });

  it("keeps shelf and saved-because intent from candidates", () => {
    const paper = buildPaper(
      { title: "A Useful Paper", readingStatus: "inbox", savedBecause: "Compare against baseline." },
      { id: "p2", existingKeys: [], now: "2026-01-01T00:00:00.000Z" }
    );
    expect(paper.readingStatus).toBe("inbox");
    expect(paper.savedBecause).toBe("Compare against baseline.");
  });
});

describe("BibTeX import", () => {
  const source = String.raw`
@string{neurips = "Advances in Neural Information Processing Systems"}
% a comment line with an @ sign
@inproceedings{vaswaniAttentionNeed2017,
  title = {Attention Is {All} You Need},
  author = {Vaswani, Ashish and Shazeer, Noam and {Google Brain} and others},
  booktitle = neurips # " 30",
  year = 2017,
  month = dec,
  pages = {5998--6008},
  keywords = {transformers, attention}
}
@article{muller2020,
  author = "M{\"u}ller, J{\"o}rg and Fran\c{c}ois Dupont",
  title = "Planning \& Control in R\&D",
  journal = {Nature},
  doi = {https://doi.org/10.1038/ABC},
  volume = {12}, number = {3}
}
@misc{chen2021,
  title = {A preprint},
  eprint = {2101.00001},
  archivePrefix = {arXiv}
}`;

  it("parses entries, strings, accents, and organizations", () => {
    const [conf, article, preprint] = parseBibtex(source);
    expect(conf.type).toBe("conferencePaper");
    expect(conf.citationKey).toBe("vaswaniAttentionNeed2017");
    expect(conf.title).toBe("Attention Is All You Need");
    expect(conf.containerTitle).toBe("Advances in Neural Information Processing Systems 30");
    expect(conf.authors).toEqual([{ family: "Vaswani", given: "Ashish" }, { family: "Shazeer", given: "Noam" }, { literal: "Google Brain" }]);
    expect(conf.issued).toEqual({ year: 2017, month: 12 });
    expect(conf.pages).toBe("5998–6008");
    expect(conf.tags).toEqual(["transformers", "attention"]);
    expect(article.authors).toEqual([{ family: "Müller", given: "Jörg" }, { given: "François", family: "Dupont" }]);
    expect(article.title).toBe("Planning & Control in R&D");
    expect(article.doi).toBe("10.1038/abc");
    expect(article.issue).toBe("3");
    expect(preprint.type).toBe("preprint");
    expect(preprint.arxivId).toBe("2101.00001");
  });

  it("round-trips exported BibTeX for every paper type", () => {
    const types = ["article", "conferencePaper", "book", "bookChapter", "thesis", "report"] as const;
    for (const type of types) {
      const paper = buildPaper(
        {
          type,
          title: "Braces {and} 100% R&D_test #1 in Zürich",
          authors: [{ family: "Østergaard", given: "Åse" }, { literal: "OpenAI & Friends" }],
          issued: { year: 2024 },
          containerTitle: "Some Venue",
          doi: "10.1/xyz",
          tags: ["a", "b"]
        },
        { id: "x", existingKeys: [], now: "2026-01-01T00:00:00.000Z" }
      );
      const [parsed] = parseBibtex(exportBibtex([paper]));
      expect(parsed.citationKey).toBe(paper.citationKey);
      expect(parsed.type).toBe(type);
      expect(parsed.title).toBe(paper.title);
      expect(parsed.authors).toEqual(paper.authors);
      expect(parsed.issued?.year).toBe(2024);
      expect(parsed.doi).toBe("10.1/xyz");
      expect(parsed.tags).toEqual(["a", "b"]);
      if (type !== "book" && type !== "report") expect(parsed.containerTitle).toBe("Some Venue");
    }
  });

  it("keeps imported citation keys and suffixes collisions", () => {
    const paper = buildPaper({ title: "X", citationKey: "smith2024" }, { id: "1", existingKeys: ["smith2024"], now: "n" });
    expect(paper.citationKey).toBe("smith2024a");
  });
});

describe("notes", () => {
  it("renames only exact citation keys", () => {
    expect(replaceCitationKey("see @[a2017] and @[a2017b], email a@b.c", "a2017", "z2017")).toBe("see @[z2017] and @[a2017b], email a@b.c");
  });

  it("extracts citation links with their surrounding paragraph", () => {
    expect(extractCitationLinkContexts("First paragraph @[a].\n\nSecond line uses @[b]\nwith context @[a].")).toEqual([
      { key: "a", snippet: "First paragraph @[a]." },
      { key: "b", snippet: "Second line uses @[b] with context @[a]." },
      { key: "a", snippet: "Second line uses @[b] with context @[a]." }
    ]);
  });

  it("gives each list item its own context", () => {
    expect(extractCitationLinkContexts("Reading list:\n- Start with @[a]\n- Then @[b], which extends it")).toEqual([
      { key: "a", snippet: "- Start with @[a]" },
      { key: "b", snippet: "- Then @[b], which extends it" }
    ]);
  });
});

describe("samples/sample.bib (Zotero / Better BibTeX export)", () => {
  const source = readFileSync(new URL("../../../samples/sample.bib", import.meta.url), "utf8");
  const [glaser, pandarinath, sussillo] = parseBibtex(source);

  it("parses all three entries with their citation keys and types", () => {
    expect([glaser, pandarinath, sussillo].map((p) => [p.citationKey, p.type])).toEqual([
      ["glaserRecurrentSwitchingDynamical2020", "conferencePaper"],
      ["pandarinathInferringSingletrialNeural2018", "article"],
      ["sussilloLFADSLatentFactor2016", "preprint"]
    ]);
  });

  it("cleans titles, venues, pages, and dates", () => {
    expect(glaser.title).toBe("Recurrent Switching Dynamical Systems Models for Multiple Interacting Neural Populations");
    expect(glaser.containerTitle).toBe("Advances in Neural Information Processing Systems");
    expect(glaser.pages).toBe("14867–14878");
    expect(sussillo.title).toBe("LFADS - Latent Factor Analysis via Dynamical Systems");
    expect(pandarinath.issued).toEqual({ year: 2018, month: 10 });
    expect(pandarinath.containerTitle).toBe("Nature Methods");
    expect(pandarinath.issue).toBe("10");
  });

  it("keeps authors structured, including initials and curly apostrophes", () => {
    expect(glaser.authors).toHaveLength(5);
    expect(pandarinath.authors?.[1]).toEqual({ family: "O’Shea", given: "Daniel J." });
    expect(pandarinath.authors?.[12]).toEqual({ family: "Abbott", given: "L. F." });
  });

  it("unescapes Zotero's LaTeX in abstracts", () => {
    expect(glaser.abstract).toContain("the nematode C. elegans.");
    expect(glaser.abstract).not.toMatch(/textbackslash|textit|[{}\\]/);
  });

  it("recognizes the arXiv preprint and its identifiers", () => {
    expect(sussillo.arxivId).toBe("1608.06315");
    expect(sussillo.doi).toBe("10.48550/arxiv.1608.06315");
    expect(pandarinath.doi).toBe("10.1038/s41592-018-0109-9");
    expect(sussillo.tags).toEqual(["Computer Science - Machine Learning", "Statistics - Machine Learning", "Quantitative Biology - Neurons and Cognition"]);
  });
});
