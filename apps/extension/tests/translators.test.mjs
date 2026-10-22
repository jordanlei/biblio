import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const build = fileURLToPath(new URL("../build/", import.meta.url));
const src = fileURLToPath(new URL("../src/", import.meta.url));
const vendorRoot = fileURLToPath(new URL("../vendor/zotero/", import.meta.url));

const translatorIndex = () => {
  const source = readFileSync(`${build}zotero-translator-index.js`, "utf8");
  return JSON.parse(source.slice(source.indexOf("["), source.lastIndexOf("]") + 1));
};

test("the generated Zotero runtime and capture driver parse", () => {
  execFileSync(process.execPath, ["--check", `${build}zotero-runtime.js`], { stdio: "pipe" });
  execFileSync(process.execPath, ["--check", `${build}zotero-capture.js`], { stdio: "pipe" });
});

test("the extension has one translator path and no retired Biblio parsers", () => {
  for (const name of ["extract.js", "biblio-translate.js", "biblio-translators.js", "pubmed-xml.js"]) {
    assert.equal(existsSync(`${src}${name}`), false, `${name} should not be shipped`);
  }
  assert.match(readFileSync(`${src}background.js`, "utf8"), /files: \["zotero-runtime\.js", \.\.\.translatorFilesFor\(tab\.url\), "zotero-capture\.js"\]/);
});

test("every official Zotero translator ships, with its source verbatim", () => {
  const vendored = readdirSync(`${vendorRoot}translators`).filter((name) => name.endsWith(".js"));
  const index = translatorIndex();
  assert.ok(vendored.length > 700, `only ${vendored.length} translators vendored`);
  assert.ok(index.length >= vendored.length - 5, `only ${index.length} of ${vendored.length} translators built`);
  for (const name of ["PubMed.js", "PubMed Central.js", "ScienceDirect.js", "Nature Publishing Group.js", "arXiv.org.js", "Embedded Metadata.js"]) {
    const source = readFileSync(`${vendorRoot}translators/${name}`, "utf8");
    const header = source.match(/^\s*(\{[\s\S]*?\n\})/);
    const { translatorID } = JSON.parse(header[1]);
    const body = source.slice(header[0].length).split("/** BEGIN TEST CASES **/")[0];
    const built = readFileSync(`${build}zotero-translators/${translatorID}.js`, "utf8");
    assert.ok(built.includes(body), `${name} body is not present verbatim in its generated file`);
  }
});

test("translators are chosen by their own target, as in the Zotero Connector", () => {
  const index = translatorIndex();
  const matching = (url) => index.filter((t) => t.type & 4 && t.target && new RegExp(t.target, "i").test(url)).map((t) => t.label);
  assert.ok(matching("https://pmc.ncbi.nlm.nih.gov/articles/PMC2669412/?utm_source=chatgpt.com").includes("PubMed Central"));
  assert.ok(matching("https://www.sciencedirect.com/science/article/pii/S0960982209006083?via%3Dihub").includes("ScienceDirect"));
  assert.ok(matching("https://pubmed.ncbi.nlm.nih.gov/19217296/").includes("PubMed"));
  assert.ok(matching("https://arxiv.org/abs/1706.03762").includes("arXiv.org"));
  const embedded = index.find((t) => t.label === "Embedded Metadata");
  assert.ok(index.some((t) => t.deps.includes(embedded.id)), "translators that build on Embedded Metadata should list it as a dependency");
});

test("the capture driver keeps identifiers the app uses for PDF discovery", () => {
  const runtime = readFileSync(`${build}zotero-runtime.js`, "utf8");
  assert.match(runtime, /pmcid: clean\(item\.PMCID/);
  assert.match(runtime, /arxivId: clean\(/);
});

test("the toolbar button and the right-click menu run the same save", () => {
  const background = readFileSync(`${src}background.js`, "utf8");
  assert.equal(existsSync(`${src}popup.js`) || existsSync(`${build}popup.js`), false);
  assert.match(background, /chrome\.action\.onClicked\.addListener\(\(tab\) => saveTab\(tab\)\)/);
  assert.match(background, /if \(info\.menuItemId === "save-to-biblio"\) saveTab\(tab\)/);
  assert.match(background, /chrome\.tabs\.create\(\{ url: .*\/capture#/);
});

test("captured publisher PDFs are fetched in the article tab first", () => {
  const background = readFileSync(`${src}background.js`, "utf8");
  assert.match(background, /const fromTab = await fetchPdfInTab\(capture\)/);
});

test("captured PDF URLs can use a short-lived extension token", () => {
  const background = readFileSync(`${src}background.js`, "utf8");
  const bridge = readFileSync(`${src}bridge.js`, "utf8");
  assert.match(background, /capturedPdf\(message\.captureToken/);
  assert.match(bridge, /captureToken/);
});
