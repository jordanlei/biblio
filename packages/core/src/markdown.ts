export const CITATION_LINK_PATTERN = /@\[([A-Za-z0-9_.:-]+)\]/g;

export function extractCitationLinks(markdown: string): string[] {
  const matches = markdown.matchAll(CITATION_LINK_PATTERN);
  return Array.from(new Set(Array.from(matches, (match) => match[1])));
}

export interface CitationLinkContext {
  key: string;
  snippet: string;
}

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export function extractCitationLinkContexts(markdown: string): CitationLinkContext[] {
  const contexts: CitationLinkContext[] = [];
  const seen = new Set<string>();
  // A paragraph, or a single list item: each bullet is its own context.
  const blocks = markdown.split(/\n\s*\n/).flatMap((paragraph) => paragraph.split(/\n(?=\s*(?:[-*+]|\d+[.)])\s)/));
  for (const paragraph of blocks) {
    const snippet = collapseWhitespace(paragraph);
    if (!snippet) continue;
    for (const match of paragraph.matchAll(CITATION_LINK_PATTERN)) {
      const key = match[1];
      const id = `${key}\n${snippet}`;
      if (seen.has(id)) continue;
      seen.add(id);
      contexts.push({ key, snippet });
    }
  }
  return contexts;
}

/** Rewrite `@[oldKey]` references to `@[newKey]`, leaving every other key untouched. */
export function replaceCitationKey(markdown: string, oldKey: string, newKey: string): string {
  return markdown.replace(CITATION_LINK_PATTERN, (match, key: string) => (key === oldKey ? `@[${newKey}]` : match));
}
