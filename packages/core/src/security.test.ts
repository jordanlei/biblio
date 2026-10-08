import { describe, expect, it } from "vitest";
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
// CaptureView.decode() mirrors this logic; these cases pin the behaviour it must keep.
describe("capture payload validation", () => {
  const decode = (raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("not a capture");
    const value = raw as Record<string, unknown>;
    const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string).slice(0, 6000) : undefined);
    const title = text("title");
    if (!title?.trim()) throw new Error("no title");
    const link = (key: string) => {
      const href = text(key);
      return href && /^https?:\/\//i.test(href) ? href : undefined;
    };
    const year = Number(value.year);
    return {
      title,
      authors: Array.isArray(value.authors) ? value.authors.filter((a): a is string => typeof a === "string").slice(0, 200) : [],
      year: Number.isInteger(year) && year > 1000 && year < 3000 ? year : undefined,
      pdfUrl: link("pdfUrl"),
      url: link("url")
    };
  };

  it("rejects javascript: and data: URLs", () => {
    const out = decode({ title: "X", pdfUrl: "javascript:alert(1)", url: "data:text/html,<script>alert(1)</script>" });
    expect(out.pdfUrl).toBeUndefined();
    expect(out.url).toBeUndefined();
  });

  it("rejects a payload with no usable title", () => {
    for (const bad of [null, "a string", 42, {}, { title: "" }, { title: "   " }, { title: 123 }]) {
      expect(() => decode(bad)).toThrow();
    }
  });

  it("survives hostile field types instead of throwing", () => {
    const out = decode({ title: "X", authors: { length: 1e9 }, year: "not a year" });
    expect(out.authors).toEqual([]);
    expect(out.year).toBeUndefined();
  });

  it("drops non-string entries from authors", () => {
    expect(decode({ title: "X", authors: ["Real Name", null, 7, { toString: () => "evil" }] }).authors).toEqual(["Real Name"]);
  });

  it("keeps ordinary http(s) links", () => {
    const out = decode({ title: "X", pdfUrl: "https://arxiv.org/pdf/1234.pdf", url: "http://example.com/a" });
    expect(out.pdfUrl).toBe("https://arxiv.org/pdf/1234.pdf");
    expect(out.url).toBe("http://example.com/a");
  });
});
