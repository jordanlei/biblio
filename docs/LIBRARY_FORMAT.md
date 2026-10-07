# Biblio library format — version 1

A Biblio library is an ordinary folder (today: in the user's Google Drive). Everything a user deliberately puts into Biblio is stored here in open formats, so the library can be read, edited, backed up, or migrated **without Biblio**. This document is sufficient to write an independent reader or writer. The reference implementation is [`packages/core/src/library/format.ts`](../packages/core/src/library/format.ts).

```text
<library>/
├── README.md          plain-language explanation for whoever opens the folder
├── biblio.json   manifest: format id, version, collections (folders)
├── library.json       all papers, as a CSL-JSON array
├── references.bib     the same papers as BibTeX (derived convenience copy)
├── notes/
│   ├── <citationKey>.md   one Markdown file per paper that has notes
│   └── <title>.md         freeform notes that link papers with @[key]
└── papers/
    └── <citationKey>.pdf  PDFs
```

## `biblio.json`

```json
{
  "format": "biblio-library",
  "version": 1,
  "generator": "Biblio web",
  "collections": [
    { "id": "6c1e…", "name": "Planning", "parent": null },
    { "id": "a90b…", "name": "Meta-control", "parent": "6c1e…" }
  ]
}
```

- `format` must be `biblio-library`. Readers should refuse libraries with a higher `version` than they understand.
- `collections` is the folder tree. A paper can be in several collections (see `custom.biblio.collections` below). Deleting a collection never deletes papers.
- Early v1 manifests also had a `researchNotes` array (title, question, saved search, papers with roles, body). Readers should convert those to `notes/` files, folding the question, search, and papers-with-roles into the Markdown (as `- @[key] (role)` lines) so nothing is lost. Writers no longer emit it.

## `library.json`

A JSON array of [CSL-JSON](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html) items, sorted by `id`. It is directly usable as a biblioy by pandoc (`pandoc --citeproc --biblioy library.json`), citeproc, and Zotero's CSL-JSON import.

| CSL field | Meaning |
| --- | --- |
| `id` | The **citation key** (e.g. `vaswaniAttentionNeed2017`). Stable: Biblio never changes it automatically. |
| `type` | `article-journal`, `paper-conference`, `article` (preprint), `book`, `chapter`, `thesis`, `report`, `document`. |
| `title`, `author`, `editor`, `issued`, `container-title`, `volume`, `issue`, `page`, `publisher`, `publisher-place`, `edition`, `DOI`, `URL`, `ISBN`, `ISSN`, `PMID`, `abstract`, `language` | Standard CSL meanings. Names are structured (`family`/`given`, or `literal` for organizations). |
| `keyword` | Tags joined with `, ` (for CSL tools; the authoritative list is below). |
| `custom.biblio` | Biblio's own fields (ignored by CSL tools). |

`custom.biblio`:

| Field | Meaning |
| --- | --- |
| `id` | Stable internal paper id (UUID). Survives citation-key renames. |
| `type` | Biblio's paper type (`article`, `conferencePaper`, `preprint`, `book`, `bookChapter`, `thesis`, `report`, `other`). |
| `tags` | Array of tags. |
| `collections` | Array of collection ids from `biblio.json`. |
| `readingStatus` | Exclusive attention shelf: `inbox`, `readNext`, `skimming`, `reading`, `read`, `reference`, or `parked`. Legacy `tbr` and `skimmed` values are still accepted. |
| `savedBecause` | Short user-entered reason for keeping the paper. |
| `addedAt` | ISO 8601 timestamp the paper was added. |
| `note` | Library-relative path of the paper's notes file, e.g. `notes/vaswaniAttentionNeed2017.md`. |
| `pdf` | Library-relative path of the paper's PDF, e.g. `papers/vaswaniAttentionNeed2017.pdf`. |
| `arxivId`, `semanticScholarId`, `openAccessPdfUrl`, `source`, `sourceIdentifiers` | Identifiers and provenance. |

Readers that find no `custom.biblio` (plain CSL-JSON from another tool) treat `id` as the citation key and `keyword` as tags.

Legacy migration expectation:

- `readingStatus: "tbr"` is shown as **Read next**.
- `readingStatus: "skimmed"` is shown as **Skimming**.
- `readingStatus: "read"` remains **Read**.
- New captures and imports should use `readingStatus: "inbox"`.

## `notes/<citationKey>.md`

```markdown
---
key: vaswaniAttentionNeed2017
title: "Attention Is All You Need"
id: 2f0c…
---

My notes, in Markdown. Links to other papers are written @[mnihHumanlevelControl2015].
```

- The header identifies the paper; everything after it is the user's Markdown, verbatim.
- `@[citationKey]` is a link to another paper in the library — the portable representation of user-created relationships.
- Files are named once, from the key at creation; `custom.biblio.note` records the path, so renaming a key doesn't break the link.
- A note file without a header is valid (the whole file is the note).

## `notes/<title>.md` (research notes)

Freeform notes that aren't about a single paper: a question, a project, a reading list, a related-work draft.

```markdown
---
id: 8d3f…
title: "Single-trial population dynamics"
---

How much of the latent dynamics can we recover from one trial?

- @[sussilloLFADSLatentFactor2016] recovers them from spikes alone
- Shown in motor cortex: @[pandarinathInferringSingletrialNeural2018]
```

- The header (`id`, `title`) is optional. A hand-written file without one is a valid note: its title is the first `# heading`, else the file name. Any `.md` file added to `notes/` becomes a research note, unless it carries a `key:` header — that marks a paper's own note.
- Research notes and paper notes share `notes/`. A research note whose title would collide with a paper's `<citationKey>.md` gets a number (`<citationKey> 2.md`).
- Papers are connected only by `@[citationKey]` links in the text: no separate membership list, no roles. Each linked paper lists the note under "Mentioned in notes", with the bullet or paragraph around the link.
- Files are named after the title and renamed when the title changes in Biblio. A name chosen by hand is kept until then. Duplicate titles get a number (`Ideas 2.md`).
- `id` is stable. Deleting a note moves its file to the trash; it never deletes papers.

## `papers/<citationKey>.pdf`

Plain PDFs. `custom.biblio.pdf` links a paper to its file. Files are named once and not renamed automatically.

## `references.bib`

The library as BibTeX with the same citation keys, regenerated whenever the library changes. It is a convenience copy; `library.json` is authoritative.

## Rules for writers

- Write deterministically (stable order, no volatile timestamps in files) so unchanged libraries are byte-identical.
- Never delete a user's note or PDF as a *side effect* (e.g. because an index looks empty). When the user deliberately deletes a paper, remove it from `library.json` and move its note and PDF to the storage provider's trash, so the deletion is recoverable.
- When a file changed outside your program since you last wrote it, don't overwrite it blindly: adopt the outside version if you have no local change, otherwise keep it as `<name>.conflict-<timestamp>.<ext>` next to yours.
- Before replacing `library.json` with a much smaller library, keep the previous one as `library.backup-<timestamp>.json`.

## Versioning

`version` increments only for incompatible changes. Adding optional fields to `custom.biblio` is compatible and does not change the version.
