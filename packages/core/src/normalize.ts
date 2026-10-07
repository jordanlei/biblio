import type { Creator } from "./types";

export function normalizeDoi(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
  return normalized || undefined;
}

export function normalizeArxivId(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .replace(/^arxiv:\s*/i, "")
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, "")
    .replace(/\.pdf$/i, "");
  return normalized || undefined;
}

export function normalizeIdentifier(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTitleKey(value: string): string {
  return normalizeTitle(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCreatorName(creator: Creator): string {
  if (creator.literal) return creator.literal.trim();
  return [creator.given, creator.family].filter(Boolean).join(" ").trim();
}

export function firstCreatorFamily(creators: Creator[]): string {
  const first = creators[0];
  if (!first) return "anonymous";
  if (first.family) return first.family;
  if (first.literal) return first.literal.split(/\s+/)[0] || "anonymous";
  return first.given || "anonymous";
}
