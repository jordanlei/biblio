import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const extensionRoot = fileURLToPath(new URL("../", import.meta.url));
const vendorRoot = fileURLToPath(new URL("../vendor/zotero/", import.meta.url));

test("the generated Zotero capture bundle parses", () => {
  execFileSync(process.execPath, ["--check", `${extensionRoot}zotero-capture.js`], { stdio: "pipe" });
});

test("the extension has one translator path and no retired Biblio parsers", () => {
  for (const name of ["extract.js", "biblio-translate.js", "biblio-translators.js", "pubmed-xml.js"]) {
    assert.equal(existsSync(`${extensionRoot}${name}`), false, `${name} should not be shipped`);
  }
  assert.match(readFileSync(`${extensionRoot}popup.js`, "utf8"), /zotero-capture\.js/);
  assert.match(readFileSync(`${extensionRoot}background.js`, "utf8"), /zotero-capture\.js/);
});

test("the generated bundle contains the exact vendored official translator sources", () => {
  const bundle = readFileSync(`${extensionRoot}zotero-capture.js`, "utf8");
  for (const name of ["PubMed.js", "PubMed XML.js", "Nature Publishing Group.js", "Springer Link.js"]) {
    const source = readFileSync(`${vendorRoot}translators/${name}`, "utf8");
    const header = source.match(/^\s*\{[\s\S]*?\}\s*\r?\n\s*(?=\/\*|\/\/)/);
    assert.ok(header && bundle.includes(source.slice(header[0].length)), `${name} body is not present verbatim in the generated bundle`);
  }
});

test("the official PubMed XML translator retains structured author fields", () => {
  const source = readFileSync(`${vendorRoot}translators/PubMed XML.js`, "utf8");
  assert.match(source, /var suffix = ZU\.xpathText\(author, 'Suffix'\)/);
  assert.match(source, /ZU\.cleanAuthor\(lastName \+ ', ' \+ firstName/);
  assert.match(source, /creator\.firstName = \[creator\.firstName, suffix\]/);
});

test("the extension opens capture in a new Biblio tab", () => {
  const popup = readFileSync(`${extensionRoot}popup.js`, "utf8");
  const background = readFileSync(`${extensionRoot}background.js`, "utf8");
  assert.match(popup, /chrome\.tabs\.create\(\{ url: .*\/capture/);
  assert.match(background, /chrome\.tabs\.create\(\{ url: .*\/capture/);
});
