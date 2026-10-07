import { describe, expect, it } from "vitest";
import {
  LIBRARY_PATHS,
  MemoryFileStore,
  SyncEngine,
  buildPaper,
  noteToMarkdown,
  parseLibrary,
  parseNoteMarkdown,
  exportLibraryFiles,
  findLibraryRoot,
  importLibraryFiles,
  libraryEntries,
  parseResearchNoteMarkdown,
  researchNotePath,
  researchNoteToMarkdown,
  serializeLibrary,
  type Folder,
  type LibraryView,
  type Paper,
  type ResearchNote,
  type SyncState,
  type SyncStateStore
} from "./index";

const NOW = "2026-10-06T12:00:00.000Z";

function sampleLibrary() {
  const folders: Folder[] = [
    { id: "fld-planning", name: "Planning", parentId: null, createdAt: NOW, updatedAt: NOW },
    { id: "fld-meta", name: "Meta-control", parentId: "fld-planning", createdAt: NOW, updatedAt: NOW }
  ];
  const keys: string[] = [];
  const make = (candidate: Parameters<typeof buildPaper>[0], id: string) => {
    const paper = buildPaper(candidate, { id, existingKeys: keys, now: NOW });
    keys.push(paper.citationKey);
    return paper;
  };
  const papers: Paper[] = [
    make(
      {
        type: "conferencePaper",
        title: "Attention Is All You Need",
        authors: [{ family: "Vaswani", given: "Ashish" }, { literal: "Google Brain" }],
        issued: { year: 2017, month: 12 },
        containerTitle: "NeurIPS",
        arxivId: "1706.03762",
        tags: ["transformers", "to-cite"],
        folderIds: ["fld-meta"],
        notesMarkdown: "Key idea: **self-attention**.\n\nSee also @[mnihHumanlevelControl2015].",
        source: "bibtex"
      },
      "p-attention"
    ),
    make(
      {
        type: "article",
        title: "Human-level control through deep reinforcement learning",
        authors: [{ family: "Mnih", given: "Volodymyr" }],
        issued: { year: 2015 },
        containerTitle: "Nature",
        doi: "10.1038/nature14236",
        tags: ["rl"],
        folderIds: ["fld-planning"],
        source: "openalex"
      },
      "p-dqn"
    )
  ];
  papers[0].readingStatus = "read";
  papers[0].pdf = { driveFileId: "pdf-1", filename: `${papers[0].citationKey}.pdf`, mimeType: "application/pdf", addedAt: NOW };
  return { papers, folders };
}

class MemoryView implements LibraryView {
  constructor(
    public papers: Paper[],
    public folders: Folder[],
    public researchNotes: ResearchNote[] = []
  ) {}
  snapshot() {
    return { papers: this.papers, folders: this.folders, researchNotes: this.researchNotes };
  }
  async applyNote(paperId: string, markdown: string) {
    this.papers = this.papers.map((p) => (p.id === paperId ? { ...p, notesMarkdown: markdown } : p));
  }
  async replaceAll(papers: Paper[], folders: Folder[], researchNotes: ResearchNote[] = []) {
    this.papers = papers;
    this.folders = folders;
    this.researchNotes = researchNotes;
  }
  async applyResearchNote(note: ResearchNote) {
    this.researchNotes = [...this.researchNotes.filter((n) => n.id !== note.id), note];
  }
  async setPdfLocation(paperId: string, pdf: Paper["pdf"]) {
    this.papers = this.papers.map((p) => (p.id === paperId ? { ...p, pdf } : p));
  }
  edit(paperId: string, patch: Partial<Paper>) {
    this.papers = this.papers.map((p) => (p.id === paperId ? { ...p, ...patch } : p));
  }
}

class MemoryState implements SyncStateStore {
  state: SyncState | null = null;
  async load() {
    return this.state ? (JSON.parse(JSON.stringify(this.state)) as SyncState) : null;
  }
  async save(state: SyncState) {
    this.state = JSON.parse(JSON.stringify(state)) as SyncState;
  }
}

/** The canonical fields a user would care about (no provider ids, no timestamps of sync). */
const essence = (papers: Paper[]) =>
  [...papers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      id: p.id,
      key: p.citationKey,
      type: p.type,
      title: p.title,
      authors: p.authors,
      issued: p.issued,
      venue: p.containerTitle,
      doi: p.doi,
      arxiv: p.arxivId,
      tags: p.tags,
      folders: p.folderIds,
      status: p.readingStatus,
      savedBecause: p.savedBecause,
      notes: p.notesMarkdown,
      addedAt: p.createdAt,
      pdf: p.pdf?.filename
    }));

function setup() {
  const { papers, folders } = sampleLibrary();
  const files = new MemoryFileStore();
  // An existing top-level PDF, as created by earlier versions of Bibliograph.
  files.files.set(`${papers[0].citationKey}.pdf`, { file: { id: "pdf-1", path: `${papers[0].citationKey}.pdf`, version: "1" }, content: "%PDF-1.4" });
  const view = new MemoryView(papers, folders);
  const state = new MemoryState();
  const engine = new SyncEngine({ files, view, state, now: () => NOW, debounceMs: 1 });
  return { files, view, state, engine, papers, folders };
}

function sampleResearchNote(): ResearchNote {
  return { id: "rn-credit", title: "Credit assignment", bodyMarkdown: "Compare against @[vaswaniAttentionNeed2017].", createdAt: NOW, updatedAt: NOW };
}

describe("library format", () => {
  it("round-trips papers and collections through CSL-JSON", () => {
    const { papers, folders } = sampleLibrary();
    const out = serializeLibrary(papers, folders, (p) => ({ note: p.notesMarkdown ? `notes/${p.citationKey}.md` : undefined, pdf: p.pdf ? `papers/${p.pdf.filename}` : undefined }));
    const parsed = parseLibrary(out.manifest, out.library, NOW);
    const withNotes = parsed.papers.map((p) => ({ ...p, notesMarkdown: papers.find((o) => o.id === p.id)!.notesMarkdown, pdf: papers.find((o) => o.id === p.id)!.pdf }));
    expect(essence(withNotes)).toEqual(essence(papers));
    expect(parsed.folders.map((f) => [f.id, f.name, f.parentId])).toEqual([
      ["fld-meta", "Meta-control", "fld-planning"],
      ["fld-planning", "Planning", null]
    ]);
  });

  it("folds old structured research notes from the manifest into Markdown", () => {
    const { papers, folders } = sampleLibrary();
    const out = serializeLibrary(papers, folders, () => ({}), "Test");
    const manifest = JSON.parse(out.manifest);
    manifest.researchNotes = [
      {
        id: "rn-old",
        title: "Credit assignment",
        question: "Which approximations are plausible?",
        query: "credit assignment",
        paperRoles: [{ paperId: papers[0].id, role: "core", note: "Transformer baseline." }],
        bodyMarkdown: "Compare the two.",
        createdAt: NOW,
        updatedAt: NOW
      }
    ];
    const parsed = parseLibrary(JSON.stringify(manifest), out.library, NOW);
    expect(parsed.researchNotes).toEqual([
      {
        id: "rn-old",
        title: "Credit assignment",
        bodyMarkdown: `Which approximations are plausible?\n\nSearch: \`credit assignment\`\n\n- @[${papers[0].citationKey}] (core): Transformer baseline.\n\nCompare the two.\n`,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]);
    expect(JSON.parse(out.manifest).researchNotes).toBeUndefined();
  });

  it("reads research note files with or without a header", () => {
    const note = sampleResearchNote();
    expect(parseResearchNoteMarkdown(researchNoteToMarkdown(note), "x.md")).toEqual({ id: note.id, title: note.title, body: note.bodyMarkdown });
    expect(parseResearchNoteMarkdown("# Ideas\n\nSee @[a].", "ideas.md")).toEqual({ id: undefined, title: "Ideas", body: "# Ideas\n\nSee @[a]." });
    expect(parseResearchNoteMarkdown("Loose thoughts.", "Loose.md").title).toBe("Loose");
    expect(researchNotePath("A/B: “test”", new Set())).toBe("research-notes/A B “test”.md");
    expect(researchNotePath("Ideas", new Set(["research-notes/Ideas.md"]))).toBe("research-notes/Ideas 2.md");
  });

  it("stores shelves and saved-because text in CSL custom fields", () => {
    const { papers, folders } = sampleLibrary();
    papers[1].readingStatus = "readNext";
    papers[1].savedBecause = "Follow up for related work.";
    const items = JSON.parse(serializeLibrary(papers, folders, () => ({})).library);
    const dqn = items.find((i: { id: string }) => i.id === papers[1].citationKey);
    expect(dqn.custom.bibliograph.readingStatus).toBe("readNext");
    expect(dqn.custom.bibliograph.savedBecause).toBe("Follow up for related work.");
    const parsed = parseLibrary(null, JSON.stringify([dqn]), NOW);
    expect(parsed.papers[0].readingStatus).toBe("readNext");
    expect(parsed.papers[0].savedBecause).toBe("Follow up for related work.");
  });

  it("writes standard CSL-JSON that other tools can read", () => {
    const { papers, folders } = sampleLibrary();
    const items = JSON.parse(serializeLibrary(papers, folders, () => ({})).library);
    const attention = items.find((i: { id: string }) => i.id === papers[0].citationKey);
    expect(attention).toMatchObject({
      type: "paper-conference",
      title: "Attention Is All You Need",
      author: [{ family: "Vaswani", given: "Ashish" }, { literal: "Google Brain" }],
      issued: { "date-parts": [[2017, 12]] },
      "container-title": "NeurIPS",
      keyword: "transformers, to-cite"
    });
  });

  it("is deterministic, so unchanged libraries aren't rewritten", () => {
    const { papers, folders } = sampleLibrary();
    const a = serializeLibrary(papers, folders, () => ({}));
    const b = serializeLibrary([...papers].reverse(), [...folders].reverse(), () => ({}));
    expect(a).toEqual(b);
  });

  it("reads plain CSL-JSON from other tools (e.g. a Zotero export)", () => {
    const parsed = parseLibrary(null, JSON.stringify([{ id: "smith2020", type: "article-journal", title: "A Paper", author: [{ family: "Smith", given: "A." }], issued: { "date-parts": [[2020]] }, keyword: "x, y" }]), NOW);
    expect(parsed.papers[0]).toMatchObject({ citationKey: "smith2020", type: "article", title: "A Paper", tags: ["x", "y"], issued: { year: 2020 } });
  });

  it("keeps notes as ordinary Markdown with a small header", () => {
    const md = noteToMarkdown({ citationKey: "k2020", title: 'Quotes "and" colons: fine', id: "p1" }, "# Heading\n\nBody @[other].");
    expect(md.startsWith("---\nkey: k2020\n")).toBe(true);
    expect(parseNoteMarkdown(md)).toEqual({ key: "k2020", id: "p1", body: "# Heading\n\nBody @[other]." });
    expect(parseNoteMarkdown("Hand-written note").body).toBe("Hand-written note");
  });
});

describe("sync engine", () => {
  it("writes a human-readable library and moves legacy PDFs into papers/", async () => {
    const { files, engine, papers } = setup();
    await engine.syncNow();
    const paths = [...files.files.keys()].sort();
    expect(paths).toEqual(
      [
        "README.md",
        "bibliograph.json",
        "library.json",
        "references.bib",
        `notes/${papers[0].citationKey}.md`,
        `papers/${papers[0].citationKey}.pdf`
      ].sort()
    );
    expect(files.text(`notes/${papers[0].citationKey}.md`)).toContain("Key idea: **self-attention**.");
    expect(files.text("references.bib")).toContain(`@inproceedings{${papers[0].citationKey},`);
    expect(engine.getStatus().phase).toBe("saved");
  });

  it("doesn't rewrite anything when nothing changed", async () => {
    const { files, engine } = setup();
    await engine.syncNow();
    const writes = files.writes;
    await engine.syncNow();
    expect(files.writes).toBe(writes);
    expect(engine.pending()).toBe(0);
  });

  it("keeps research notes as Markdown files, renamed with their titles, and rebuilds them", async () => {
    const { files, view, engine } = setup();
    view.researchNotes = [sampleResearchNote()];
    await engine.syncNow();
    expect(files.text("research-notes/Credit assignment.md")).toBe(researchNoteToMarkdown(view.researchNotes[0]));
    expect(JSON.parse(files.text("bibliograph.json")!).researchNotes).toBeUndefined();

    view.researchNotes = [{ ...view.researchNotes[0], title: "Credit assignment in cortex" }];
    await engine.syncNow();
    expect(files.text("research-notes/Credit assignment.md")).toBeUndefined();
    expect(files.text("research-notes/Credit assignment in cortex.md")).toContain("Compare against");
    const writes = files.writes;
    await engine.syncNow();
    expect(files.writes).toBe(writes);
    expect(engine.pending()).toBe(0);

    const freshView = new MemoryView([], []);
    const fresh = new SyncEngine({ files, view: freshView, state: new MemoryState(), now: () => NOW });
    await fresh.rebuild();
    expect(freshView.researchNotes).toEqual(view.researchNotes);
  });

  it("adopts research notes written or edited outside Bibliograph", async () => {
    const { files, view, engine } = setup();
    view.researchNotes = [sampleResearchNote()];
    await engine.syncNow();

    await files.writeText("research-notes/From Obsidian.md", "# Reading list\n\nStart with @[vaswaniAttentionNeed2017].", "text/markdown");
    files.editOutside("research-notes/Credit assignment.md", researchNoteToMarkdown({ ...view.researchNotes[0], bodyMarkdown: "Edited elsewhere." }));
    await engine.syncNow();

    const adopted = view.researchNotes.find((n) => n.title === "Reading list");
    expect(adopted?.bodyMarkdown).toContain("@[vaswaniAttentionNeed2017]");
    expect(view.researchNotes.find((n) => n.id === "rn-credit")?.bodyMarkdown).toBe("Edited elsewhere.");
    // The hand-written file is tracked as is; it isn't rewritten until the note is edited.
    expect(files.text("research-notes/From Obsidian.md")).toBe("# Reading list\n\nStart with @[vaswaniAttentionNeed2017].");
    const writes = files.writes;
    await engine.syncNow();
    expect(files.writes).toBe(writes);
  });

  it("moves a whole library between copies as a set of files", async () => {
    const { files, view, engine } = setup();
    view.researchNotes = [sampleResearchNote()];
    await engine.syncNow();
    const exported = await exportLibraryFiles(files);
    expect(exported.map((e) => e.path)).toEqual(expect.arrayContaining(["library.json", "bibliograph.json", "references.bib", "README.md", "research-notes/Credit assignment.md"]));

    // As Google Drive's folder download would: wrapped in folders, with a stray file.
    const archive = [...exported.map((e) => ({ ...e, path: `Bibliograph Library-2026/Bibliograph Library/${e.path}` })), { path: "Bibliograph Library-2026/.DS_Store", data: new Blob(["x"]) }];
    expect(findLibraryRoot(archive.map((e) => e.path))).toBe("Bibliograph Library-2026/Bibliograph Library/");
    const entries = libraryEntries(archive);
    expect(entries.map((e) => e.path).sort()).toEqual(exported.map((e) => e.path).sort());

    const target = new MemoryFileStore();
    const result = await importLibraryFiles(target, entries);
    expect(result.papers).toBe(view.papers.length);
    const freshView = new MemoryView([], []);
    await new SyncEngine({ files: target, view: freshView, state: new MemoryState(), now: () => NOW }).rebuild();
    expect(freshView.papers.map((p) => p.citationKey).sort()).toEqual(view.papers.map((p) => p.citationKey).sort());
    expect(freshView.researchNotes).toEqual(view.researchNotes);
  });

  it("refuses an archive without a library", () => {
    expect(() => libraryEntries([{ path: "photos/cat.jpg", data: new Blob(["x"]) }])).toThrow(/no library.json/);
  });

  it("moves research notes from an older manifest into files", async () => {
    const { files, view, engine, papers } = setup();
    await engine.syncNow();
    const manifest = JSON.parse(files.text("bibliograph.json")!);
    manifest.researchNotes = [{ id: "rn-old", title: "Old note", paperRoles: [{ paperId: papers[0].id, role: "supports" }], bodyMarkdown: "", createdAt: NOW, updatedAt: NOW }];
    files.editOutside("bibliograph.json", JSON.stringify(manifest));
    files.editOutside("library.json", files.text("library.json")!);
    await engine.syncNow(); // adopts the outside library, including the old note
    await engine.syncNow(); // writes the note as a file and drops it from the manifest
    expect(view.researchNotes.map((n) => n.bodyMarkdown)).toEqual([`- @[${papers[0].citationKey}] (supports)\n`]);
    expect(files.text("research-notes/Old note.md")).toContain(`@[${papers[0].citationKey}] (supports)`);
    expect(JSON.parse(files.text("bibliograph.json")!).researchNotes).toBeUndefined();
  });

  it("queues edits while storage is unavailable and writes them when it returns", async () => {
    const { files, view, engine, papers } = setup();
    await engine.syncNow();
    files.offline = true;
    view.edit(papers[1].id, { tags: ["rl", "classic"], notesMarkdown: "Written offline." });
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe("offline");
    expect(engine.getStatus().pending).toBe(2); // library.json + the new note
    files.offline = false;
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe("saved");
    expect(files.text("library.json")).toContain('"classic"');
    expect(files.text(`notes/${papers[1].citationKey}.md`)).toContain("Written offline.");
  });

  it("pulls notes edited outside Bibliograph", async () => {
    const { files, view, engine, papers } = setup();
    await engine.syncNow();
    const path = `notes/${papers[0].citationKey}.md`;
    files.editOutside(path, noteToMarkdown(papers[0], "Edited in another app."));
    await engine.syncNow();
    expect(view.papers[0].notesMarkdown).toBe("Edited in another app.");
    expect(engine.getStatus().phase).toBe("saved");
  });

  it("keeps both versions when a note changed in both places", async () => {
    const { files, view, engine, papers } = setup();
    await engine.syncNow();
    const path = `notes/${papers[0].citationKey}.md`;
    files.editOutside(path, noteToMarkdown(papers[0], "Outside edit."));
    view.edit(papers[0].id, { notesMarkdown: "Inside edit." });
    await engine.syncNow();
    expect(files.text(path)).toContain("Inside edit.");
    const copy = [...files.files.keys()].find((p) => p.startsWith(`notes/${papers[0].citationKey}.conflict-`))!;
    expect(files.text(copy)).toContain("Outside edit.");
    expect(engine.getStatus().phase).toBe("conflict");
  });

  it("rebuilds the whole library after the index is lost (data-loss test)", async () => {
    const { files, engine, papers } = setup();
    await engine.syncNow();

    // Bibliograph's database and sync bookkeeping disappear. Only the files remain.
    const freshView = new MemoryView([], []);
    const fresh = new SyncEngine({ files, view: freshView, state: new MemoryState(), now: () => NOW });
    const summary = await fresh.rebuild();

    expect(summary).toEqual({ papers: 2, notes: 1, pdfs: 1 });
    expect(essence(freshView.papers)).toEqual(essence(papers.map((p) => ({ ...p, pdf: p.pdf && { ...p.pdf } }))));
    expect(freshView.folders.map((f) => f.name).sort()).toEqual(["Meta-control", "Planning"]);
    expect(freshView.papers.find((p) => p.id === "p-attention")!.pdf!.driveFileId).toBe("pdf-1");
    // And the rebuilt index is in sync: nothing to write.
    await fresh.syncNow();
    expect(fresh.pending()).toBe(0);
  });

  it("adopts an existing library when connected to an empty index", async () => {
    const { files, engine, papers } = setup();
    await engine.syncNow();
    const view = new MemoryView([], []);
    await new SyncEngine({ files, view, state: new MemoryState(), now: () => NOW }).syncNow();
    expect(view.papers.map((p) => p.citationKey).sort()).toEqual(papers.map((p) => p.citationKey).sort());
  });

  it("never overwrites an unknown library: the existing one is kept as a copy", async () => {
    const { files, engine } = setup();
    await engine.syncNow();
    const other = sampleLibrary();
    other.papers = [other.papers[1]];
    const view = new MemoryView(other.papers, []);
    const second = new SyncEngine({ files, view, state: new MemoryState(), now: () => NOW });
    await second.syncNow();
    const copy = [...files.files.keys()].find((p) => p.startsWith("library.conflict-"))!;
    expect(JSON.parse(files.text(copy)!)).toHaveLength(2);
    expect(JSON.parse(files.text(LIBRARY_PATHS.library)!)).toHaveLength(1);
    expect(second.getStatus().phase).toBe("conflict");
  });

  it("keeps a backup when the library is suddenly emptied", async () => {
    const { files, view, engine } = setup();
    await engine.syncNow();
    view.papers = [];
    await engine.syncNow();
    const backup = [...files.files.keys()].find((p) => p.startsWith("library.backup-"))!;
    expect(JSON.parse(files.text(backup)!)).toHaveLength(2);
    expect(JSON.parse(files.text(LIBRARY_PATHS.library)!)).toHaveLength(0);
  });
});
