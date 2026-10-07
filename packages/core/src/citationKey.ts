import { firstCreatorFamily, normalizeTitleKey } from "./normalize";
import type { Creator } from "./types";

const STOP_WORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "you"
]);

function asciiToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
}

function camel(tokens: string[]): string {
  return tokens
    .filter(Boolean)
    .map((token, index) => {
      const lower = token.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function generateCitationKey(input: {
  title: string;
  authors?: Creator[];
  year?: number;
  existingKeys?: Iterable<string>;
}): string {
  const author = asciiToken(firstCreatorFamily(input.authors ?? [])).split(/\s+/)[0] || "anonymous";
  const titleTokens = normalizeTitleKey(input.title)
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .slice(0, 3);
  const base = camel([author, ...titleTokens, input.year ? String(input.year) : "n.d"]);
  return allocateCitationKey(base || "untitled", input.existingKeys ?? []);
}

export function allocateCitationKey(base: string, existingKeys: Iterable<string>): string {
  const existing = new Set(Array.from(existingKeys));
  const cleanBase = asciiToken(base).replace(/\s+/g, "") || "untitled";
  if (!existing.has(cleanBase)) return cleanBase;

  for (let index = 0; index < 26; index += 1) {
    const suffix = String.fromCharCode(97 + index);
    const candidate = `${cleanBase}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }

  let index = 2;
  while (existing.has(`${cleanBase}${index}`)) index += 1;
  return `${cleanBase}${index}`;
}
