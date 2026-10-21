// Configure the Chrome extension for this copy's web app (from biblio.config.json).
// The code lives in one place: apps/extension itself. This script writes only the two ignored,
// deployment-specific files Chrome needs, so there is no duplicate dist/source tree.
//   npm run build:extension   (also run by `npm run setup`)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { requireConfig } from "./lib/config.mjs";

const { appUrl, firebase } = requireConfig();
const root = fileURLToPath(new URL("../apps/extension/", import.meta.url));
const template = fileURLToPath(new URL("../apps/extension/config/manifest.template.json", import.meta.url));
const origin = new URL(appUrl).origin;

const zoteroRoot = fileURLToPath(new URL("../apps/extension/vendor/zotero/", import.meta.url));
const zoteroFiles = [
  "translate-src/zotero.js",
  "translate-src/promise.js",
  "utilities/openurl.js",
  "utilities/date.js",
  "utilities/xregexp-all.js",
  "utilities/xregexp-unicode-zotero.js",
  "utilities/utilities.js",
  "utilities/utilities_item.js",
  "utilities/schema.js",
  "utilities/resource/zoteroTypeSchemaData.js",
  "utilities/cachedTypes.js",
  "translate-src/utilities_translate.js",
  "translate-src/debug.js",
  "translate-src/http.js",
  "translate-src/translator.js",
  "translate-src/translators.js",
  "translate-src/repo.js",
  "translate-src/translation/translate.js",
  "translate-src/translation/sandboxManager.js",
  "translate-src/translation/translate_item.js",
  "translate-src/tlds.js",
  "translate-src/proxy.js",
  "translate-src/rdf/init.js",
  "translate-src/rdf/uri.js",
  "translate-src/rdf/term.js",
  "translate-src/rdf/identity.js",
  "translate-src/rdf/n3parser.js",
  "translate-src/rdf/rdfparser.js",
  "translate-src/rdf/serialize.js",
  "http-adapter.js"
];
const translatorFiles = [
  "PubMed.js",
  "PubMed XML.js",
  "Embedded Metadata.js",
  "RIS.js",
  "RDF.js",
  "Nature Publishing Group.js",
  "Springer Link.js"
];

const readTranslator = (fileName) => {
  const code = readFileSync(`${zoteroRoot}translators/${fileName}`, "utf8");
  const match = code.match(/^\s*(\{[\s\S]*?\})\s*\r?\n\s*(?=\/\*|\/\/)/);
  if (!match) throw new Error(`Could not read Zotero translator metadata from ${fileName}`);
  return { ...JSON.parse(match[1]), code, body: code.slice(match[0].length) };
};

const runtime = zoteroFiles.map((file) => readFileSync(`${zoteroRoot}${file}`, "utf8")).join("\n;\n");
const extensionHttpAdapter = readFileSync(`${root}zotero-http-adapter.js`, "utf8");
const translators = translatorFiles.map(readTranslator);
const dateFormats = readFileSync(`${zoteroRoot}utilities/resource/dateFormats.json`, "utf8");
const translatorPayload = JSON.stringify(translators.map(({ body, ...record }) => record));
const translatorFactories = translators
  .map(({ body, ...record }) => `
    globalThis.BiblioZoteroTranslatorFactories[${JSON.stringify(record.translatorID)}] = (sandbox) => {
      const Zotero = sandbox.Zotero;
      const Z = sandbox.Z;
      const ZU = sandbox.ZU;
      const attr = sandbox.attr;
      const text = sandbox.text;
      const innerText = sandbox.innerText;
      const request = sandbox.request;
      const requestText = sandbox.requestText;
      const requestJSON = sandbox.requestJSON;
      const requestDocument = sandbox.requestDocument;
      var exports = {};
${body}
      return {
        exports,
        ZOTERO_TRANSLATOR_INFO: ${JSON.stringify(record)},
        detectWeb: typeof detectWeb === "function" ? detectWeb : undefined,
        doWeb: typeof doWeb === "function" ? doWeb : undefined,
        detectImport: typeof detectImport === "function" ? detectImport : undefined,
        doImport: typeof doImport === "function" ? doImport : undefined,
        detectSearch: typeof detectSearch === "function" ? detectSearch : undefined,
        doSearch: typeof doSearch === "function" ? doSearch : undefined,
        detectExport: typeof detectExport === "function" ? detectExport : undefined,
        doExport: typeof doExport === "function" ? doExport : undefined
      };
    };
    globalThis.BiblioZoteroTranslatorFactoriesByLabel[${JSON.stringify(record.label)}] = globalThis.BiblioZoteroTranslatorFactories[${JSON.stringify(record.translatorID)}];`)
  .join("\n");
const captureRuntime = `${runtime}
;
${extensionHttpAdapter}
;
globalThis.BiblioZoteroTranslatorFactories = {};
globalThis.BiblioZoteroTranslatorFactoriesByLabel = {};
${translatorFactories}
;
(() => {
  const originalEval = Zotero.Translate.SandboxManager.prototype.eval;
  Zotero.Translate.SandboxManager.prototype.eval = function (code, functions, path) {
    const factory = globalThis.BiblioZoteroTranslatorFactories[path] || globalThis.BiblioZoteroTranslatorFactoriesByLabel[path];
    if (!factory) return originalEval.call(this, code, functions, path);
    for (const name of functions) delete this.sandbox[name];
    const translated = factory(this.sandbox);
    for (const name of functions) {
      if (name in translated) this.sandbox[name] = translated[name];
    }
  };
})();
;
(() => {
  const records = ${translatorPayload};
  const dateFormats = ${dateFormats};
  Zotero.Date.init(dateFormats);
  const objects = records.map((record) => new Zotero.Translator(record));
  const byId = new Map(objects.map((translator) => [translator.translatorID, translator]));
  const web = objects.filter((translator) => (translator.translatorType & 4) !== 0);
  const imports = objects.filter((translator) => (translator.translatorType & 1) !== 0);
  const matches = (translator, uri) => {
    const root = translator.webRegexp?.root;
    const all = translator.webRegexp?.all;
    return Boolean((!root || root.test(uri)) && (!all || all.test(uri)));
  };
  Object.assign(Zotero.Translators, {
    _initialized: true,
    init: async () => undefined,
    get: (id) => byId.get(id) || false,
    getCodeForTranslator: async (translator) => translator.code,
    getAllForType: async (type) => type === "web" ? web.slice() : type === "import" ? imports.slice() : [],
    getWebTranslatorsForLocation: async (uri) => [web.filter((translator) => matches(translator, uri)), []],
    getImportTranslatorsForLocation: async (uri) => imports.filter((translator) => translator.importRegexp?.test(uri))
  });

  const clean = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();
  const absolute = (value) => {
    try { return value ? new URL(value, location.href).href : ""; } catch { return ""; }
  };
  const authorText = (creator) => {
    if (!creator || creator.fieldMode || creator.name) return clean(creator?.lastName || creator?.name);
    const family = clean(creator.lastName);
    const given = clean(creator.firstName);
    return given ? (family ? family + ", " + given : given) : family;
  };
  const compact = (item, translator) => {
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    const pdf = attachments.find((attachment) => attachment.mimeType === "application/pdf" || /\\.pdf(?:$|[?#])/i.test(attachment.url || ""));
    const year = String(item.date || "").match(/(?:^|\\D)((?:18|19|20)\\d{2})(?:\\D|$)/)?.[1];
    const doi = clean(item.DOI || item.doi).replace(/^(?:https?:\\/\\/(?:dx\\.)?doi\\.org\\/|doi:)\\s*/i, "");
    return {
      title: clean(item.title),
      authors: (item.creators || []).filter((creator) => creator.creatorType === "author" || !creator.creatorType).map(authorText).filter(Boolean),
      year: year ? Number(year) : undefined,
      venue: clean(item.publicationTitle || item.bookTitle || item.proceedingsTitle),
      volume: clean(item.volume),
      issue: clean(item.issue),
      pages: clean(item.pages),
      publisher: clean(item.publisher),
      doi,
      pmid: clean(item.PMID || ((item.extra || "").match(/(?:^|\\n)PMID:\\s*([^\\n]+)/i) || [])[1]),
      abstract: clean(item.abstractNote).slice(0, 6000),
      pdfUrl: absolute(pdf?.url),
      url: absolute(item.url) || location.href,
      isPaper: Boolean(item.title && (item.creators?.length || doi || item.PMID)),
      translator: translator.label
    };
  };

  globalThis.BiblioZoteroCapture = async () => {
    const translation = new Zotero.Translate.Web();
    translation.setDocument(document);
    const found = await translation.getTranslators(true);
    if (!found?.length) return { title: "", authors: [], url: location.href, isPaper: false, translator: "None" };
    translation.setTranslator(found[0]);
    const items = await translation.translate({ libraryID: false, saveAttachments: false });
    const item = items?.[0];
    return item ? compact(item, found[0]) : { title: "", authors: [], url: location.href, isPaper: false, translator: found[0].label };
  };
})();
globalThis.BiblioZoteroCapture();`;

writeFileSync(`${root}zotero-capture.js`, `// Generated by npm run build:extension. Do not edit.\n${captureRuntime}\n`);

writeFileSync(
  `${root}app-url.js`,
  `// Generated by npm run build:extension. Do not edit.\nconst DEFAULT_APP_URL = ${JSON.stringify(origin)};\n`
);

const manifest = JSON.parse(readFileSync(template, "utf8"));
const bridge = manifest.content_scripts.find((entry) => entry.js.includes("bridge.js"));
// Replace, never union: a real install must not let a localhost page talk to its worker.
bridge.matches = [...new Set([`${origin}/*`, `https://${firebase.authDomain}/*`])];
writeFileSync(`${root}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Extension configured for ${origin}: load apps/extension in chrome://extensions (Developer mode → Load unpacked).`);
