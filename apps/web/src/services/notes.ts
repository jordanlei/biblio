import type { Paper } from "@bibliograph/core";
import DOMPurify from "dompurify";
import { Marked, type TokenizerAndRendererExtension } from "marked";
import { shortAuthors } from "./library";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Render note Markdown with `@[citationKey]` resolved against the library. The reference is an
 * inline token, so it is left alone inside code spans/blocks. Output is sanitized.
 */
export function renderNotes(markdown: string, paperByKey: Map<string, Paper>): string {
  const citation: TokenizerAndRendererExtension = {
    name: "citation",
    level: "inline",
    start: (src) => src.indexOf("@["),
    tokenizer(src) {
      const match = /^@\[([A-Za-z0-9_.:-]+)\]/.exec(src);
      if (match) return { type: "citation", raw: match[0], key: match[1] };
      return undefined;
    },
    renderer(token) {
      const paper = paperByKey.get(token.key as string);
      if (!paper) return `<span class="cite unresolved" title="No paper with this citation key">@[${escapeHtml(token.key as string)}]</span>`;
      const label = `${shortAuthors(paper.authors)}${paper.issued?.year ? ` (${paper.issued.year})` : ""}`;
      return `<a class="cite" href="/paper/${encodeURIComponent(paper.id)}" data-paper-id="${escapeHtml(paper.id)}" title="${escapeHtml(paper.title)}">${escapeHtml(label)}</a>`;
    }
  };
  const marked = new Marked({ extensions: [citation], gfm: true, breaks: true });
  return DOMPurify.sanitize(marked.parse(markdown || "", { async: false }) as string);
}

/** Plain-text note snippet for backlinks: `@[key]` shown as "Author et al. (year)", Markdown marks dropped. */
export function snippetText(snippet: string, paperByKey: Map<string, Paper>): string {
  return snippet
    .replace(/@\[([A-Za-z0-9_.:-]+)\]/g, (raw, key: string) => {
      const paper = paperByKey.get(key);
      return paper ? `${shortAuthors(paper.authors)}${paper.issued?.year ? ` (${paper.issued.year})` : ""}` : raw;
    })
    .replace(/\*\*|__/g, "")
    .replace(/^\s*[-*]\s+/, "");
}
