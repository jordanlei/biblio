import { describe, it } from "vitest";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { exportBibtex, extractCitationLinkContexts, parseLibrary, serializeLibrary, type Paper, type ResearchNote } from "../packages/core/src/index";

const now = "2026-10-07T12:00:00.000Z";
const sizes = [100, 1000, 5000];
const statuses = ["inbox", "readNext", "skimming", "reading", "read", "reference", "parked"] as const;
const topics = ["credit assignment", "working memory", "attention", "reinforcement learning", "dendritic computation", "latent dynamics", "planning"];

function paperAt(i: number): Paper {
  const topic = topics[i % topics.length];
  const keyTopic = topic.replace(/\s+/g, "");
  const citationKey = `smith${keyTopic}${2000 + (i % 25)}_${i}`;
  return {
    id: `paper-${i}`,
    citationKey,
    type: i % 5 === 0 ? "preprint" : "article",
    title: `${topic} in neural systems ${i}`,
    authors: [{ family: `Smith${i % 37}`, given: "Alex" }, { family: `Chen${i % 19}`, given: "Riley" }],
    issued: { year: 2000 + (i % 25) },
    containerTitle: i % 3 === 0 ? "Journal of Synthetic Benchmarks" : "Conference on Measured Systems",
    abstract: `A benchmark paper about ${topic}, retrieval, notes, folders, tags, and scientific reading workflows.`,
    tags: [topic.split(" ")[0], `cluster-${i % 20}`],
    folderIds: [`folder-${i % 12}`],
    notesMarkdown: `This note links to @[${citationKey}] and tracks why ${topic} mattered for a research question.`,
    readingStatus: statuses[i % statuses.length],
    savedBecause: `Useful for ${topic} synthesis and follow-up reading.`,
    source: "manual",
    createdAt: now,
    updatedAt: now
  };
}

function makeLibrary(count: number) {
  const papers = Array.from({ length: count }, (_, i) => paperAt(i));
  const folders = Array.from({ length: 12 }, (_, i) => ({
    id: `folder-${i}`,
    name: `Folder ${i}`,
    parentId: i > 5 ? `folder-${i - 6}` : null,
    createdAt: now,
    updatedAt: now
  }));
  const researchNotes: ResearchNote[] = Array.from({ length: 24 }, (_, i) => ({
    id: `rn-${i}`,
    title: `Research note ${i}`,
    bodyMarkdown: `How does ${topics[i % topics.length]} connect to actionable reading?\n\n${papers
      .slice(i * 3, i * 3 + 8)
      .map((paper) => `- @[${paper.citationKey}] with context around a question.`)
      .join("\n")}`,
    createdAt: now,
    updatedAt: now
  }));
  return { papers, folders, researchNotes };
}

function fold(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function searchScan(papers: Paper[], query: string) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  let matches = 0;
  let score = 0;
  for (const paper of papers) {
    const haystack = fold(
      [
        paper.title,
        paper.authors.map((a) => [a.given, a.family, a.literal].filter(Boolean).join(" ")).join(" "),
        paper.containerTitle,
        paper.abstract,
        paper.notesMarkdown,
        paper.savedBecause,
        paper.tags.join(" "),
        paper.citationKey
      ]
        .filter(Boolean)
        .join(" ")
    );
    if (terms.every((term) => haystack.includes(term))) {
      matches += 1;
      score += haystack.length;
    }
  }
  return { matches, score };
}

function measure(label: string, fn: () => unknown, iterations = 5) {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    label,
    min: samples[0],
    median: samples[Math.floor(samples.length / 2)],
    max: samples.at(-1) ?? samples[0]
  };
}

function lineFor(count: number, metric: ReturnType<typeof measure>) {
  return `| ${count} | ${metric.label} | ${metric.median.toFixed(2)} | ${metric.min.toFixed(2)} | ${metric.max.toFixed(2)} |`;
}

describe("latency benchmarks", () => {
  it("records deterministic core baselines", () => {
    const rows: string[] = [];
    for (const count of sizes) {
      const library = makeLibrary(count);
      const serialized = serializeLibrary(library.papers, library.folders, () => ({}), "Bibliograph benchmark");
      rows.push(lineFor(count, measure("serializeLibrary", () => serializeLibrary(library.papers, library.folders, () => ({}), "Bibliograph benchmark"), 7)));
      rows.push(lineFor(count, measure("parseLibrary", () => parseLibrary(serialized.manifest, serialized.library, now), 7)));
      rows.push(lineFor(count, measure("exportBibtex", () => exportBibtex(library.papers), 5)));
      rows.push(lineFor(count, measure("local search scan", () => searchScan(library.papers, "credit assignment"), 11)));
      rows.push(lineFor(count, measure("citation contexts", () => library.papers.reduce((sum, paper) => sum + extractCitationLinkContexts(paper.notesMarkdown).length, 0), 7)));
    }

    const entry = [
      `## ${new Date().toISOString()}`,
      "",
      "Local deterministic benchmark on synthetic libraries. Times are milliseconds.",
      "",
      "| Papers | Operation | Median | Min | Max |",
      "| ---: | --- | ---: | ---: | ---: |",
      ...rows,
      ""
    ].join("\n");

    const path = resolve("docs/BENCHMARKS.md");
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, entry);
    console.log(`\n${entry}`);
  });
});
