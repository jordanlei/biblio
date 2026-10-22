# Third-party notices

## Zotero Translate and translators

Biblio vendors the Zotero Translate runtime and these official translator sources:

<https://github.com/zotero/translate>

<https://github.com/zotero/translators>

The extension ships every translator in that repository (`vendor/zotero/translators/`).

The vendored upstream snapshots are kept under `apps/extension/vendor/zotero/`.
`build/zotero-runtime.js` and `build/zotero-translators/<translatorID>.js` are generated from those files by
`npm run build:extension`; they contain the upstream source verbatim (translators without their
embedded test cases) plus a Biblio runtime adapter.

Pinned upstream revisions: `zotero/translate` `dd524aea9a556cd23eb9dc8cc617219a98d0fb47`,
`zotero/translators` `8fdb26b68c732b5810ffb037304c99e68aadd62b`, and Zotero utilities
`cccf1235a318c259345fc623d5e9d6770ba19df7`.

The upstream runtime and translators are licensed under the GNU Affero General Public License,
version 3 or later. The extension follows the same license. Zotero is not affiliated with or
endorsing Biblio. See `vendor/zotero/TRANSLATE-COPYING` and `vendor/zotero/utilities/COPYING`.
