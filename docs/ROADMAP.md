# Roadmap: discovery, organization, and comprehension under one roof

Bibliograph is a reference manager. Its job is not to become a grand theory of research or a generic
"second brain"; it should solve the ordinary friction of living with a large paper library:

- papers arrive from many places;
- the library gets noisy quickly;
- tags multiply until they stop meaning much;
- saved papers lose the reason they were saved;
- notes and citations drift away from the papers they refer to;
- it is hard to know what deserves attention next.

The product direction is practical: keep the reference-manager core strong, then join discovery,
organization, and comprehension in the same workflow.

## Product Principles

1. **Capture should be cheap.** DOI, arXiv, URL, PDF, browser capture, OpenAlex search, and BibTeX
   import should all land in one deduped paper flow.
2. **New papers should enter an inbox.** Saving a paper should not imply a commitment to read it.
   Inbox is a triage surface, not a guilt pile.
3. **Folders and tags both matter.** Folders provide coarse, durable organization; tags handle
   cross-cutting labels. Tags alone will sprawl.
4. **Shelves describe attention.** Inbox, Read next, Skimming, Reading, Read, Reference, and Parked
   are exclusive states for how much attention a paper deserves now.
5. **Every save should be allowed to answer "why?"** A short saved-because field is often more useful
   than another tag.
6. **Notes should keep citation context visible.** `@[citationKey]` links should show the surrounding
   paragraph and make backlinks useful without opening half the library.
7. **Research notes stay freeform.** A research note is just Markdown: a question, a claim, a project,
   a reading list. Papers connect organically through `@[key]` links, not a rigid membership list.
8. **Drive remains the durable library.** Firestore is a fast view. Papers, notes, folders, shelves,
   Research Notes, PDFs, CSL-JSON, and BibTeX must rebuild from user-owned files.
9. **You run it; it's yours.** Bibliograph is open-source software, not a service. The project
   website is GitHub Pages; each person runs their own copy on their own Firebase site, with their
   library in their own Drive. Setup stays a five-minute, one-command job. Nothing belongs to anyone
   but the person running it: no central server, accounts, or analytics.

## Current Focus

The near-term surface is now:

- **Paper Inbox:** imported, searched, manually added, and captured papers default to Inbox.
- **Reading shelves:** keyboard and filters support Inbox, Read next, Skimming, Reading, Read,
  Reference, and Parked, while old `tbr`, `skimmed`, and `read` data still loads.
- **Saved because:** search results and manual add can record why a paper is being saved; rows and
  paper pages show and edit that context.
- **Folders remain prominent:** folder creation, nesting, collapse, and paper drag/drop remain in the
  sidebar because folders are the stable counterweight to tag sprawl.
- **Research notes:** freeform Markdown files in `research-notes/`, linking papers with `@[key]`.
  (An earlier version had saved searches and papers with roles; it was too rigid and was folded into
  plain Markdown.)
- **Context backlinks:** paper pages show where a paper is mentioned, including snippet context from
  paper notes and Research Notes.

## Main Pain Points In Existing Systems

| Pain point | What usually happens | Bibliograph's angle |
| --- | --- | --- |
| Capture is split | Search tools, browser tabs, PDFs, and reference managers all have separate save flows. | One add dialog and extension capture, with dedupe and Inbox as the default landing zone. |
| Organization gets noisy | Tags become too numerous; folders become too rigid; reading status is too coarse. | Use folders for coarse placement, tags for labels, shelves for attention, and saved-because for local intent. |
| Reading state is unclear | Everything marked "to read" competes equally. | Separate untriaged Inbox from Read next, active Skimming/Reading, durable Read, quiet Reference, and Parked. |
| Notes are isolated | A note on one paper rarely explains why it mattered to a project. | Keep paper notes, and add freeform research notes whose `@[` links connect papers in both directions. |
| Backlinks lack context | "Mentioned in" is useful, but often forces tab-hopping. | Show the paragraph around each citation link. |
| Discovery ignores the local library | Alerts and recommendation tools do not know what the user already saved, read, or parked. | Future discovery should weight shelves, folders, tags, saved reasons, and Research Notes. |
| Ownership is fragile | Exports are afterthoughts or incomplete. | Treat Drive files as the canonical library and Firestore as rebuildable. |

## Test Strategy

Development should use the fast loop:

```sh
npm run test:core
```

Final checks should use the full gate:

```sh
npm run test:final
```

Benchmarks are tracked separately:

```sh
npm run bench:latency
```

The benchmark log is intentionally small and local. It records enough timing data to notice search or
library-format regressions as the product surface grows.

## Near-Term Implementation Plan

1. **Stabilize Inbox and shelves**
   - Keep all add paths defaulting to Inbox.
   - Make shelf filters and keyboard shortcuts feel fast in the library view.
   - Keep legacy statuses readable and map them cleanly in the UI.

2. **Research notes as Markdown files** (done)
   - Create, edit, retitle, and delete notes; recent notes in the sidebar.
   - Connect papers with `@[key]` links; show linked papers and backlinks with context.
   - One `.md` file per note in Drive; adopt files added or edited outside Bibliograph.
   - Convert notes saved in the old structured shape.

3. **Make context visible**
   - Extract snippets around `@[key]` links.
   - Show snippets in paper inspectors and paper pages.
   - Include saved-because text in local search.

4. **Document and demo** (done)
   - Front page shows the Inbox, Research Notes, and linked-note captures, plus a comparison with
     Zotero, EndNote, and Paperpile.
   - README, storage, format, architecture, and status docs updated.
   - Landing-page captures recorded; the process is in [CAPTURES.md](CAPTURES.md).

## Next

- Add full-text PDF indexing and annotation search.
- Add annotation/highlight import from the PDF reader layer.
- Add better triage views for Inbox and Read next.
- Links between research notes (e.g. `[[Note title]]`) and note-to-note backlinks.
- Add Zotero JSON import and map collections to folders.
- Add writing-focused exports for Markdown/Quarto and richer BibTeX/CSL workflows.

## Later

- Recommendation/digest views grounded in the user's library state.
- Collaboration around shared folders or shared Research Notes.
- Word/Docs integrations after the file format and citation-key behavior is boringly reliable.
- Alternative storage adapters once the Drive-backed format is stable.
