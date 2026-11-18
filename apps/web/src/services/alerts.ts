import { findExistingPaper, type PaperCandidate } from "@biblio/core";
import { computed } from "vue";
import { addPaper, useLibrary } from "./library/library";
import { newWorks } from "./lookup";
import { updateProfile, useSession } from "./session";

// Alerts: follow authors and topics; new work from them waits at the top of the Inbox until you
// add it or dismiss it. Nothing enters the library (or Drive) unless you add it. There's no
// server, so checks run in the browser: when the app opens, at most every 12 hours.

export interface Follow {
  id: string;
  kind: "author" | "topic";
  /** What's shown: the author's name or the topic text. */
  label: string;
  /** OpenAlex author ID, or the search text. */
  query: string;
  /** Publication date (YYYY-MM-DD) the next check starts from. */
  since: string;
}

export interface Suggestion {
  /** OpenAlex work ID. */
  id: string;
  followId: string;
  candidate: PaperCandidate;
  foundAt: string;
}

export interface AlertsState {
  follows: Follow[];
  suggestions: Suggestion[];
  /** Work IDs dismissed or added, so they never come back. Most recent last; capped. */
  seen: string[];
  checkedAt?: string;
}

const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 30;
/** Late-indexed works can carry an earlier publication date; re-scan a week back each time. */
const OVERLAP_DAYS = 7;
const MAX_SUGGESTIONS = 80;
const MAX_SEEN = 2000;

const day = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

const session = useSession();
export const alerts = computed<AlertsState>(() => ({ follows: [], suggestions: [], seen: [], ...session.profile.value?.alerts }));

async function save(next: AlertsState) {
  await updateProfile({ alerts: next });
}

export async function follow(kind: Follow["kind"], query: string, label: string) {
  const current = alerts.value;
  if (current.follows.some((f) => f.kind === kind && f.query.toLowerCase() === query.toLowerCase())) return;
  const entry: Follow = { id: crypto.randomUUID(), kind, label, query, since: day(-LOOKBACK_DAYS) };
  await save({ ...current, follows: [...current.follows, entry] });
  await checkAlerts({ force: true });
}

export async function unfollow(id: string) {
  const current = alerts.value;
  await save({ ...current, follows: current.follows.filter((f) => f.id !== id), suggestions: current.suggestions.filter((s) => s.followId !== id) });
}

let running: Promise<number> | null = null;

/** Look for new work from every follow. Returns how many suggestions were added. */
export function checkAlerts(options: { force?: boolean } = {}): Promise<number> {
  if (running) return running;
  const current = alerts.value;
  if (!current.follows.length || !session.profile.value) return Promise.resolve(0);
  if (!options.force && current.checkedAt && Date.now() - Date.parse(current.checkedAt) < CHECK_EVERY_MS) return Promise.resolve(0);
  running = (async () => {
    const { papers } = useLibrary();
    const seen = new Set([...current.seen, ...current.suggestions.map((s) => s.id)]);
    const found: Suggestion[] = [];
    const follows: Follow[] = [];
    for (const f of current.follows) {
      try {
        const hits = await newWorks(f, f.since);
        for (const hit of hits) {
          if (seen.has(hit.id) || findExistingPaper(hit.candidate, papers.value).kind !== "none") continue;
          seen.add(hit.id);
          const abstract = hit.candidate.abstract && hit.candidate.abstract.length > 1200 ? `${hit.candidate.abstract.slice(0, 1200)}…` : hit.candidate.abstract;
          found.push({ id: hit.id, followId: f.id, candidate: stripUndefined({ ...hit.candidate, abstract }), foundAt: new Date().toISOString() });
        }
        follows.push({ ...f, since: day(-OVERLAP_DAYS) });
      } catch (error) {
        console.warn(`Alert check failed for ${f.label}`, error);
        follows.push(f);
      }
    }
    // Re-read: the user may have added or dismissed something while the check ran.
    const latest = alerts.value;
    const kept = latest.follows.map((f) => follows.find((n) => n.id === f.id) ?? f);
    const suggestions = [...found, ...latest.suggestions.filter((s) => !found.some((n) => n.id === s.id))].slice(0, MAX_SUGGESTIONS);
    await save({ ...latest, follows: kept, suggestions, checkedAt: new Date().toISOString() });
    return found.length;
  })().finally(() => (running = null));
  return running;
}

function stripUndefined<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function settle(id: string) {
  const current = alerts.value;
  return save({ ...current, suggestions: current.suggestions.filter((s) => s.id !== id), seen: [...current.seen.filter((x) => x !== id), id].slice(-MAX_SEEN) });
}

/** Add a suggestion to the library (it lands in the Inbox, like any new paper). */
export async function acceptSuggestion(suggestion: Suggestion) {
  const paper = await addPaper({ ...suggestion.candidate, folderIds: [], inbox: true });
  await settle(suggestion.id);
  return paper;
}

export function dismissSuggestion(suggestion: Suggestion) {
  return settle(suggestion.id);
}

export const followLabel = (followId: string) => alerts.value.follows.find((f) => f.id === followId)?.label;
