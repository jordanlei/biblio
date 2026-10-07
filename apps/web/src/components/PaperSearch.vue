<script setup lang="ts">
import type { PaperCandidate } from "@biblio/core";
import { computed, onMounted, ref, watch } from "vue";
import {
  lookupIdentifier,
  parseIdentifier,
  parseQualifiers,
  searchAuthors,
  searchWorks,
  type AuthorHit,
  type SearchHit,
  type SearchSort
} from "../services/lookup";
import AppIcon from "./AppIcon.vue";
import CandidateRow from "./CandidateRow.vue";

type Mode = "topic" | "title" | "author";
const modes: Array<{ id: Mode; label: string; placeholder: string }> = [
  { id: "topic", label: "Topic", placeholder: "Topic or keywords — e.g. deep learning, working memory" },
  { id: "title", label: "Title", placeholder: "Words from the title" },
  { id: "author", label: "Author", placeholder: "Author name — e.g. Geoffrey Hinton" }
];

const mode = ref<Mode>("topic");
const text = ref("");
const sort = ref<SearchSort>("relevance");
const yearFrom = ref("");
const yearTo = ref("");
const author = ref<AuthorHit | null>(null);
const withinAuthor = ref("");

const hits = ref<SearchHit[]>([]);
const identified = ref<PaperCandidate | null>(null);
const authors = ref<AuthorHit[]>([]);
const suggestedAuthor = ref<AuthorHit | null>(null);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref("");
const input = ref<HTMLInputElement | null>(null);

let controller: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const current = computed(() => modes.find((m) => m.id === mode.value)!);
const showYears = computed(() => mode.value !== "author" || author.value);

function years() {
  const from = Number.parseInt(yearFrom.value, 10);
  const to = Number.parseInt(yearTo.value, 10);
  return { yearFrom: Number.isFinite(from) ? from : undefined, yearTo: Number.isFinite(to) ? to : undefined };
}

function schedule(delay = 350) {
  clearTimeout(timer);
  timer = setTimeout(() => void run(), delay);
}

async function run(more = false) {
  clearTimeout(timer);
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  error.value = "";
  if (!more) {
    page.value = 1;
    identified.value = null;
    suggestedAuthor.value = null;
  }
  const raw = mode.value === "author" && author.value ? withinAuthor.value : text.value;
  const q = parseQualifiers(raw);
  const span = { ...years(), ...(q.yearFrom || q.yearTo ? { yearFrom: q.yearFrom, yearTo: q.yearTo } : {}) };

  // Author mode without a chosen person: list people.
  if (mode.value === "author" && !author.value) {
    hits.value = [];
    if (!text.value.trim()) return void (authors.value = []);
    loading.value = true;
    try {
      authors.value = await searchAuthors(text.value.trim(), signal);
    } catch (e) {
      if (!signal.aborted) error.value = e instanceof Error ? e.message : "Search failed.";
    } finally {
      if (!signal.aborted) loading.value = false;
    }
    return;
  }

  // A pasted DOI / arXiv / PMID resolves directly.
  const identifier = mode.value !== "author" ? parseIdentifier(raw) : null;
  if (identifier) {
    loading.value = true;
    hits.value = [];
    try {
      identified.value = await lookupIdentifier(identifier);
    } catch (e) {
      if (!signal.aborted) error.value = e instanceof Error ? e.message : "Lookup failed.";
    } finally {
      if (!signal.aborted) loading.value = false;
    }
    return;
  }

  if (!q.text && !author.value && !q.author && !span.yearFrom && !span.yearTo) {
    hits.value = [];
    total.value = 0;
    return;
  }

  if (more) loadingMore.value = true;
  else loading.value = true;
  try {
    // author:"…" inside a topic query: resolve the person first.
    let authorId = author.value?.id;
    if (!authorId && q.author) authorId = (await searchAuthors(q.author, signal))[0]?.id;
    const [result, people] = await Promise.all([
      searchWorks({ text: q.text, authorId, titleOnly: mode.value === "title", sort: sort.value, page: page.value, ...span }, signal),
      // A short topic query might be a person's name; offer that reading instead of mixing it in.
      !more && mode.value === "topic" && !authorId && q.text.split(/\s+/).length <= 3 ? searchAuthors(q.text, signal).catch(() => []) : Promise.resolve([])
    ]);
    if (signal.aborted) return;
    hits.value = more ? [...hits.value, ...result.hits.filter((h) => !hits.value.some((x) => x.id === h.id))] : result.hits;
    total.value = result.total;
    const tokens = q.text.toLowerCase().split(/\s+/);
    const top = people[0];
    suggestedAuthor.value = top && tokens.every((t) => top.name.toLowerCase().includes(t)) && top.works > 5 ? top : null;
  } catch (e) {
    if (!signal.aborted) error.value = e instanceof Error ? e.message : "Search failed.";
  } finally {
    if (!signal.aborted) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function loadMore() {
  page.value += 1;
  void run(true);
}

function chooseAuthor(hit: AuthorHit) {
  mode.value = "author";
  author.value = hit;
  text.value = hit.name;
  withinAuthor.value = "";
  sort.value = "cited";
  void run();
}

function clearAuthor() {
  author.value = null;
  withinAuthor.value = "";
  hits.value = [];
  sort.value = "relevance";
  void run();
}

function setMode(next: Mode) {
  if (mode.value === next) return;
  mode.value = next;
  author.value = null;
  authors.value = [];
  hits.value = [];
  if (next !== "author" && sort.value === "cited" && !text.value) sort.value = "relevance";
  input.value?.focus();
  schedule(0);
}

watch(text, () => {
  if (!author.value) schedule();
});
watch(withinAuthor, () => schedule());
watch([sort, yearFrom, yearTo], () => schedule(0));

onMounted(() => input.value?.focus());

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n.toLocaleString());
</script>

<template>
  <div class="paper-search">
    <div class="modes" role="tablist" aria-label="Search by">
      <button v-for="m in modes" :key="m.id" type="button" role="tab" :aria-selected="mode === m.id" :class="{ on: mode === m.id }" @click="setMode(m.id)">
        {{ m.label }}
      </button>
    </div>

    <div v-if="author" class="author-chip">
      <AppIcon name="user" :size="15" />
      <span>Papers by <strong>{{ author.name }}</strong><span v-if="author.institution" class="faint"> · {{ author.institution }}</span></span>
      <button class="btn quiet icon" type="button" aria-label="Clear author" @click="clearAuthor"><AppIcon name="x" :size="14" /></button>
    </div>

    <form class="box" @submit.prevent="run()">
      <AppIcon name="search" />
      <input
        v-if="author"
        ref="input"
        v-model="withinAuthor"
        class="bare"
        placeholder="Filter their papers by keyword (optional)"
        aria-label="Filter this author's papers"
      />
      <input v-else ref="input" v-model="text" class="bare" :placeholder="current.placeholder" aria-label="Search for papers" data-autofocus />
      <span v-if="loading" class="spinner" aria-label="Searching" />
    </form>

    <div v-if="showYears" class="refine">
      <label class="small">
        Sort
        <select v-model="sort" class="select sm">
          <option value="relevance" :disabled="!(author ? withinAuthor : text).trim()">Best match</option>
          <option value="cited">Most cited</option>
          <option value="newest">Newest</option>
        </select>
      </label>
      <label class="small">
        Years
        <input v-model="yearFrom" class="input sm year" inputmode="numeric" placeholder="from" aria-label="From year" />
        –
        <input v-model="yearTo" class="input sm year" inputmode="numeric" placeholder="to" aria-label="To year" />
      </label>
      <span class="spacer" />
      <span v-if="hits.length" class="faint small tnum">{{ fmt(total) }} works</span>
    </div>

    <p v-if="error" class="notice error">{{ error }}</p>

    <button v-if="suggestedAuthor" class="suggest" type="button" @click="chooseAuthor(suggestedAuthor)">
      <AppIcon name="user" :size="15" />
      <span>Looking for papers <em>by</em> <strong>{{ suggestedAuthor.name }}</strong>?</span>
      <span class="faint small">{{ suggestedAuthor.institution }}</span>
      <AppIcon name="chevron-right" :size="14" />
    </button>

    <div class="results">
      <ul v-if="mode === 'author' && !author && authors.length" class="people">
        <li v-for="a in authors" :key="a.id">
          <button type="button" @click="chooseAuthor(a)">
            <span class="name">{{ a.name }}</span>
            <span class="faint small">{{ [a.institution, a.topics.slice(0, 2).join(", ")].filter(Boolean).join(" · ") }}</span>
            <span class="stats small tnum">{{ fmt(a.works) }} works · {{ fmt(a.citedBy) }} citations</span>
          </button>
        </li>
      </ul>

      <CandidateRow v-if="identified" :candidate="identified" />
      <CandidateRow v-for="hit in hits" :key="hit.id" :candidate="hit.candidate" :cited-by="hit.citedBy" />

      <div v-if="loading && !hits.length && !identified" class="skeleton">
        <div v-for="i in 4" :key="i" class="sk" />
      </div>

      <button v-if="hits.length && hits.length < total" class="btn block more" type="button" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? "Loading…" : "More results" }}
      </button>

      <div v-if="!loading && !hits.length && !identified && !authors.length && !error" class="hints">
        <template v-if="(author ? withinAuthor : text).trim()">
          <p>No matches. Try fewer words, a different mode, or widen the years.</p>
        </template>
        <template v-else>
          <p>Search by <strong>topic</strong>, <strong>title</strong>, or <strong>author</strong> — or paste a DOI, arXiv link, or PMID.</p>
          <p class="faint small">
            Refine inline: <code>author:hinton</code>, <code>year:2015-2020</code>. Results come from OpenAlex (250M+ works).
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paper-search {
  display: grid;
  gap: 10px;
}

.modes {
  display: inline-flex;
  justify-self: start;
  padding: 2px;
  border-radius: 8px;
  background: var(--surface-2);
}

.modes button {
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: calc(13px * var(--text-scale));
  font-weight: 500;
  cursor: pointer;
}

.modes button.on {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.author-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: calc(13.5px * var(--text-scale));
}

.author-chip span {
  flex: 1;
}

.box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-3);
}

.box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.bare {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: none;
  font-size: calc(15.5px * var(--text-scale));
  color: var(--text);
}

.refine {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  color: var(--text-2);
}

.refine label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.select.sm,
.input.sm {
  width: auto;
  height: 28px;
  font-size: calc(12.5px * var(--text-scale));
}

.year {
  width: 62px !important;
  text-align: center;
}

.suggest {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: calc(13.5px * var(--text-scale));
  text-align: left;
  cursor: pointer;
}

.suggest:hover {
  border-color: var(--accent);
  color: var(--text);
}

.suggest > span:first-of-type {
  flex: 1;
}

.results {
  display: grid;
  max-height: 54vh;
  overflow-y: auto;
}

.people {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.people button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 16px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.people button:hover {
  background: var(--surface-2);
}

.people .name {
  font-family: var(--font-serif);
  font-size: calc(15.5px * var(--text-scale));
  font-weight: 600;
}

.people .stats {
  grid-row: 1 / span 2;
  grid-column: 2;
  align-self: center;
  color: var(--text-2);
}

.more {
  margin-top: 8px;
}

.hints {
  display: grid;
  gap: 6px;
  padding: 12px 2px;
  color: var(--text-2);
  font-size: calc(13.5px * var(--text-scale));
}

code {
  font-family: var(--font-mono);
  font-size: 0.86em;
}

.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.skeleton {
  display: grid;
  gap: 10px;
  padding-top: 6px;
}

.sk {
  height: 64px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--surface-2), var(--surface), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>
