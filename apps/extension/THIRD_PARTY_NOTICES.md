# Third-party notices

## Zotero Translate and translators

Biblio vendors the Zotero Translate runtime and these official translator sources:

<https://github.com/zotero/translate>

<https://github.com/zotero/translators>

Files used by the extension include `PubMed.js`, `PubMed XML.js`, `Nature Publishing Group.js`,
`Springer Link.js`, `Embedded Metadata.js`, `RDF.js`, and `RIS.js`.

The vendored upstream snapshots are kept under `apps/extension/vendor/zotero/`.
`zotero-capture.js` is generated from those files by `npm run build:extension`; it contains the
upstream source verbatim plus a Biblio runtime adapter.

Pinned upstream revisions: `zotero/translate` `dd524aea9a556cd23eb9dc8cc617219a98d0fb47`,
`zotero/translators` `8fdb26b68c732b5810ffb037304c99e68aadd62b`, and Zotero utilities
`cccf1235a318c259345fc623d5e9d6770ba19df7`.

The upstream runtime and translators are licensed under the GNU Affero General Public License,
version 3 or later. The extension follows the same license. Zotero is not affiliated with or
endorsing Biblio. See `vendor/zotero/TRANSLATE-COPYING` and `vendor/zotero/utilities/COPYING`.
