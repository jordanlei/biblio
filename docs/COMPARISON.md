# Comparison sources

The table on the [home page](https://jordanlei.github.io/biblio/) compares Biblio with Zotero,
EndNote, and Paperpile. Every claim about another product comes from that product's own
documentation or official support forum, checked **October 2026**. Sources are below so anyone can
check them, and so they can be rechecked when the products change.

Rules for this table:

- Only claims we can point at a source for. No guessing from reputation.
- Describe what a product *does*, not what it lacks, wherever both are true.
- A row where everyone does the same thing is worth keeping only if it matters; say so plainly
  rather than implying an advantage.
- When something is ambiguous, say less. "Not built in" is a claim, and needs a source too.
- Marks are **yes / partly / no**. Use *partly* generously: it covers "true with a caveat"
  (Zotero's library is local but its sync isn't) and "we can't verify the detail". Reserve *no*
  for things a product documents as absent or clearly doesn't do.
- Privacy is a weak spot for comparison: a vendor's policy says what they're permitted to collect,
  not what they do. So every competitor is marked *partly* there, describing their stated policy
  rather than asserting what actually happens.

## Zotero

| Claim | Source |
| --- | --- |
| Open source, AGPL | [zotero/zotero on GitHub](https://github.com/zotero/zotero) |
| Free; paid storage above 300 MB | [Zotero storage](https://www.zotero.org/storage) |
| Library is local; sync is Zotero's service | [Zotero sync](https://www.zotero.org/support/sync) |
| Attachments stored under random 8-character keys | [The Zotero data directory](https://www.zotero.org/support/zotero_data) |
| "Related" links between items and notes | [Related items](https://www.zotero.org/support/related) · [forum thread on inline links](https://forums.zotero.org/discussion/78829/feature-request-links-to-library-items-in-a-note) |
| Searches databases in-app and via the connector | [Zotero Connector](https://www.zotero.org/support/adding_items_to_zotero) |
| Exports BibTeX, RIS, CSL-JSON | [Exporting](https://www.zotero.org/support/kb/exporting) |
| Sync optional and off by default; servers log IPs up to 90 days | [Zotero privacy policy](https://www.zotero.org/support/privacy) |
| Zotero Connector browser extension | [Adding items](https://www.zotero.org/support/adding_items_to_zotero) |

Note on cross-referencing: Zotero's Related tab does link notes to items. What it doesn't do is
inline links inside the note text, which is a long-standing feature request. The table says what it
has, not what it lacks.

## EndNote

| Claim | Source |
| --- | --- |
| Not open source; paid licence | [EndNote pricing](https://endnote.com/buy) |
| Local `.enl` library | [EndNote library structure](https://support.clarivate.com/Endnote/s/article/EndNote-Library-Structure) |
| Citing articles via Web of Science | [EndNote 2025 features](https://endnote.com/product-details) |
| Online search of subscribed databases | [EndNote online search](https://support.clarivate.com/Endnote/s/article/EndNote-Online-Search) |
| Exports BibTeX, RIS, XML | [Exporting references](https://support.clarivate.com/Endnote/s/article/EndNote-Export-references) |
| Privacy governed by Clarivate's corporate policy | [EndNote privacy policy](https://endnote.com/privacy-policy/) |
| Capture browser extension | [EndNote Click / capture](https://endnote.com/product-details) |

We found no documented feature for linking one reference to another from within a note, so that
cell describes the Web of Science citation feature instead.

## Paperpile

| Claim | Source |
| --- | --- |
| Not open source; paid subscription | [Paperpile pricing](https://paperpile.com/pricing) |
| Metadata on Paperpile's servers; PDFs in your Drive | [How Paperpile stores data](https://paperpile.com/h/google-drive/) |
| Searches PubMed, Google Scholar, arXiv and more in-app | [Paperpile features](https://paperpile.com/features) |
| Exports BibTeX, RIS, CSL-JSON | [Paperpile export](https://paperpile.com/h/export/) |
| App listing declares usage data and diagnostics linked to identity | [Paperpile privacy policy](https://paperpile.com/privacy) · App Store listing |
| Paperpile browser extension | [Chrome Web Store listing](https://chromewebstore.google.com/detail/bomfdkbfpdhijjbeoicnfhjbdhncfhig) |

## Biblio

Claims about Biblio should be checkable in this repository:

| Claim | Where |
| --- | --- |
| MIT licensed | [LICENSE](../LICENSE) |
| Free on Google's Spark plan | [SELF_HOSTING.md](SELF_HOSTING.md) |
| Rebuild from a .zip | [STORAGE.md](STORAGE.md), and the `.zip` round-trip test in `e2e/ownership.spec.ts` |
| You deploy and change it | [SELF_HOSTING.md](SELF_HOSTING.md), [EXTENDING.md](EXTENDING.md) |
| Everything in a Drive folder you control | [LIBRARY_FORMAT.md](LIBRARY_FORMAT.md) |
| Plain files, human-readable names | [LIBRARY_FORMAT.md](LIBRARY_FORMAT.md) |
| `@[` links with backlinks | `packages/core/src/markdown.ts`, `apps/web/src/components/BacklinkList.vue` |
| 250M papers in-app | OpenAlex, via `apps/web/src/services/lookup.ts` |
| `references.bib` always current | `packages/core/src/library/format.ts` |
