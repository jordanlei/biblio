import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const extensionRoot = new URL("../", import.meta.url);

test("every extension script parses", () => {
  for (const name of readdirSync(extensionRoot).filter((file) => file.endsWith(".js"))) {
    execFileSync(process.execPath, ["--check", fileURLToPath(new URL(name, extensionRoot))], { stdio: "pipe" });
  }
});

test("PubMed translator captures authors and PMID from an older record", () => {
  const url = "https://pubmed.ncbi.nlm.nih.gov/6238127/";
  const authors = ["R A Wise", "L J Murray", "C R Gerfen"];
  const document = {
    querySelectorAll(selector) {
      if (selector === ".authors-list .full-name") return authors.map((textContent) => ({ textContent }));
      return [];
    },
    querySelector(selector) {
      if (selector.includes('meta[name="ncbi_uidlist"')) return {};
      if (selector === "h1.heading-title") return { textContent: "The frontal cortex-basal ganglia system in primates" };
      if (selector === ".cit") return { textContent: "Crit Rev Neurobiol. 1984;2(2):181-213." };
      return null;
    }
  };
  const context = vm.createContext({ URL, document, location: { href: url } });
  vm.runInContext(readFileSync(new URL("biblio-translate.js", extensionRoot), "utf8"), context);
  vm.runInContext(readFileSync(new URL("biblio-translators.js", extensionRoot), "utf8"), context);

  const item = context.BiblioTranslate.run(document, url);
  assert.equal(item.pmid, "6238127");
  assert.equal(item.year, 1984);
  assert.equal(item.translator, "Biblio Translate: PubMed");
  assert.deepEqual(Array.from(item.authors), authors);
});

test("PubMed translator keeps Jr. out of the family name", () => {
  const url = "https://pubmed.ncbi.nlm.nih.gov/6238127/";
  const document = {
    querySelectorAll(selector) {
      if (selector === ".authors-list .full-name") return [{ textContent: "W H Warren Jr" }];
      return [];
    },
    querySelector(selector) {
      if (selector.includes("h1.heading-title")) return { textContent: "A paper" };
      if (selector === ".cit") return { textContent: "J Med. 1984;2:1-2." };
      return null;
    }
  };
  const context = vm.createContext({ URL, document, location: { href: url } });
  vm.runInContext(readFileSync(new URL("biblio-translate.js", extensionRoot), "utf8"), context);
  vm.runInContext(readFileSync(new URL("biblio-translators.js", extensionRoot), "utf8"), context);

  const item = context.BiblioTranslate.run(document, url);
  assert.deepEqual(Array.from(item.authors), ["Warren, W H Jr"]);
});

test("structured PubMed XML keeps suffixes separate from family names", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL("pubmed-xml.js", extensionRoot), "utf8"), context);
  const item = context.BiblioPubMed.parse(`<PubmedArticle><MedlineCitation><PMID>6238127</PMID><Article><ArticleTitle>A paper</ArticleTitle><Journal><Title>J Med</Title><JournalIssue><Volume>2</Volume><Issue>1</Issue><PubDate><Year>1984</Year></PubDate></JournalIssue></Journal><AuthorList><Author><LastName>Warren</LastName><ForeName>W H</ForeName><Suffix>Jr</Suffix></Author></AuthorList></Article></MedlineCitation></PubmedArticle>`);
  assert.deepEqual(Array.from(item.authors), ["Warren, W H Jr"]);
});
