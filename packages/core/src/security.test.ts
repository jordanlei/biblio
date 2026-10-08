import { describe, expect, it } from "vitest";
import { decodeCaptureHash, parseCapturedPaper } from "./capture";
import { isLibraryPath, libraryEntries } from "./library/transfer";

describe("zip import rejects path traversal", () => {
  const attacks = [
    "../../../etc/passwd",
    "../outside.json",
    "notes/../../escape.md",
    "/absolute/path.json",
    "papers/../../../evil.pdf",
    ".ssh/id_rsa",
    "notes/.hidden.md",
    "../../.gitignore",
    "notes/sub/deep.md",
    "evil/payload.md",
    "notes/script.js",
    "papers/not-a-pdf.exe"
  ];
  for (const path of attacks) {
    it(`rejects ${path}`, () => expect(isLibraryPath(path)).toBe(false));
  }
  const legit = ["library.json", "biblio.json", "references.bib", "README.md", "notes/key2020.md", "notes/My Note.md", "papers/key2020.pdf"];
  for (const path of legit) {
    it(`accepts ${path}`, () => expect(isLibraryPath(path)).toBe(true));
  }
  it("strips traversal entries from a hostile archive", () => {
    const blob = () => new Blob(["x"]);
    const entries = libraryEntries([
      { path: "Lib/library.json", data: blob() },
      { path: "Lib/../../../evil.sh", data: blob() },
      { path: "Lib/notes/ok.md", data: blob() },
      { path: "Lib/../escape.json", data: blob() }
    ]);
    expect(entries.map((e) => e.path).sort()).toEqual(["library.json", "notes/ok.md"]);
  });
});

// The capture hash is attacker-supplyable: anyone can send a crafted /capture#… link.
// These exercise the REAL function the app calls, not a copy of its logic.
describe("capture payload validation", () => {
  it("rejects javascript: and data: URLs", () => {
    const out = parseCapturedPaper({ title: "X", pdfUrl: "javascript:alert(1)", url: "data:text/html,<script>alert(1)</script>" });
    expect(out.pdfUrl).toBeUndefined();
    expect(out.url).toBeUndefined();
  });

  it("rejects a payload with no usable title", () => {
    for (const bad of [null, undefined, "a string", 42, [], {}, { title: "" }, { title: "   " }, { title: 123 }]) {
      expect(() => parseCapturedPaper(bad)).toThrow();
    }
  });

  it("survives hostile field types instead of throwing", () => {
    const out = parseCapturedPaper({ title: "X", authors: { length: 1e9 }, year: "not a year" });
    expect(out.authors).toEqual([]);
    expect(out.year).toBeUndefined();
  });

  it("drops non-string entries from authors", () => {
    expect(parseCapturedPaper({ title: "X", authors: ["Real Name", null, 7, { toString: () => "evil" }] }).authors).toEqual(["Real Name"]);
  });

  it("keeps ordinary http(s) links", () => {
    const out = parseCapturedPaper({ title: "X", pdfUrl: "https://arxiv.org/pdf/1234.pdf", url: "http://example.com/a" });
    expect(out.pdfUrl).toBe("https://arxiv.org/pdf/1234.pdf");
    expect(out.url).toBe("http://example.com/a");
  });

  it("caps absurdly long text and author lists", () => {
    const out = parseCapturedPaper({ title: "T".repeat(50_000), abstract: "A".repeat(50_000), authors: Array(5000).fill("X") });
    expect(out.title.length).toBe(6000);
    expect(out.abstract?.length).toBe(6000);
    expect(out.authors.length).toBe(200);
  });

  it("ignores prototype-polluting keys", () => {
    const payload = JSON.parse('{"title":"X","__proto__":{"polluted":true},"constructor":{"bad":1}}') as unknown;
    const out = parseCapturedPaper(payload);
    expect(out.title).toBe("X");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((out as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("decodes a real base64url hash end to end", () => {
    const json = JSON.stringify({ title: "Attention Is All You Need", authors: ["Vaswani, Ashish"], year: 2017 });
    const hash = "#" + Buffer.from(json).toString("base64url");
    expect(decodeCaptureHash(hash).title).toBe("Attention Is All You Need");
    expect(() => decodeCaptureHash("#not-valid-base64!!")).toThrow();
  });
});
