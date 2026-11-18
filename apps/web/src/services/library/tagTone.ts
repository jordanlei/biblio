/**
 * Each tag gets one of six muted inks, chosen from its name so it's the same everywhere: a
 * reading-journal colour key. Returns the class that sets `--tag-ink`.
 */
export function tagTone(tag: string): string {
  let hash = 0;
  for (const char of tag.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `tone-${hash % 6}`;
}
