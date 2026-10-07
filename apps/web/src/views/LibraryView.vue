<script setup lang="ts">
import type { Paper } from "@biblio/core";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import PaperInspector from "../components/PaperInspector.vue";
import { attachPdf, driveOpenUrl, grabPdf } from "../services/drive";
import { citeCommand, downloadBibtex, familyName, setPaperTag, updatePaper, useLibrary } from "../services/library";
import { highlight, isEmptyQuery, parseLocalQuery, scorePaper } from "../services/librarySearch";
import { filtersFromQuery, matchesFilters, normalizeReadingStatus, readingStatusLabel, readingStatuses, scopeFromQuery, type ListFilters } from "../services/scope";
import { useSession } from "../services/session";
import { askConfirm, copyText, isTypingTarget, openAdd, toast, toastError, ui, undoAction } from "../services/ui";
import { deletePapersEverywhere } from "../services/deletion";

type SortKey = "relevance" | "added" | "year-desc" | "year-asc" | "author" | "title";
const sortOptions: Array<{ id: SortKey; label: string }> = [
  { id: "added", label: "Date added" },
  { id: "year-desc", label: "Newest" },
  { id: "year-asc", label: "Oldest" },
  { id: "author", label: "First author" },
  { id: "title", label: "Title" }
];

const route = useRoute();
const router = useRouter();
const session = useSession();
const { papers, loaded, loadError, paperById } = useLibrary();

const SORT_KEY = "biblio.sort";
const search = ref("");
const sort = ref<SortKey>(readSort());
// While a search is active the list is ranked by relevance unless the user picks another order.
const searchSort = ref<SortKey>("relevance");
const checked = ref<Set<string>>(new Set());
const anchor = ref<string | null>(null);
const pageSize = ref(200);
const searchInput = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
const pdfDropTarget = ref<string | null>(null);
const bulkTag = ref("");

function readSort(): SortKey {
  try {
    const saved = localStorage.getItem(SORT_KEY) as SortKey | null;
    return saved && saved !== "relevance" ? saved : "added";
  } catch {
    return "added";
  }
}
watch(sort, (value) => {
  try {
    localStorage.setItem(SORT_KEY, value);
  } catch {
    // Per-browser convenience only.
  }
});

const scope = computed(() => scopeFromQuery(route.query));
const filters = computed(() => filtersFromQuery(route.query));
const query = computed(() => parseLocalQuery(search.value));
const searching = computed(() => !isEmptyQuery(query.value));
const activeSort = computed<SortKey>({
  get: () => (searching.value ? searchSort.value : sort.value),
  set: (value) => (searching.value ? (searchSort.value = value) : (sort.value = value))
});

const compare: Record<Exclude<SortKey, "relevance">, (a: Paper, b: Paper) => number> = {
  added: (a, b) => b.createdAt.localeCompare(a.createdAt),
  "year-desc": (a, b) => (b.issued?.year ?? -1) - (a.issued?.year ?? -1) || b.createdAt.localeCompare(a.createdAt),
  "year-asc": (a, b) => (a.issued?.year ?? 9999) - (b.issued?.year ?? 9999) || a.title.localeCompare(b.title),
  author: (a, b) => familyName(a.authors[0] ?? {}).localeCompare(familyName(b.authors[0] ?? {})) || (a.issued?.year ?? 0) - (b.issued?.year ?? 0),
  title: (a, b) => a.title.localeCompare(b.title)
};

const inScope = computed(() => papers.value.filter((p) => scope.value.matches(p) && matchesFilters(p, filters.value)));

const visible = computed(() => {
  if (!searching.value) return [...inScope.value].sort(compare[sort.value === "relevance" ? "added" : sort.value]);
  const scored = inScope.value.map((paper) => ({ paper, score: scorePaper(paper, query.value) })).filter((r) => r.score > 0);
  if (activeSort.value === "relevance") scored.sort((a, b) => b.score - a.score || compare.added(a.paper, b.paper));
  else scored.sort((a, b) => compare[activeSort.value as Exclude<SortKey, "relevance">](a.paper, b.paper));
  return scored.map((r) => r.paper);
});
const rendered = computed(() => visible.value.slice(0, pageSize.value));

// Remember the list so the paper page can offer previous/next within it.
watch(
  visible,
  (list) => {
    ui.listIds = list.map((p) => p.id);
    ui.listLabel = searching.value ? `“${search.value}”` : scope.value.label;
    ui.listRoute = route.fullPath;
  },
  { immediate: true }
);

watch(
  () => route.fullPath,
  (next, prev) => {
    // Changing scope resets; toggling a filter keeps the search.
    if (route.path !== "/library" || next.split("?")[0] !== prev?.split("?")[0]) return;
    checked.value = new Set();
    pageSize.value = 200;
  }
);
watch(() => [route.query.folder, route.query.tag, route.query.view], () => (search.value = ""));

const selected = computed(() => (ui.selectedId ? paperById.value.get(ui.selectedId) ?? null : null));
const targetIds = computed(() => (checked.value.size ? [...checked.value] : selected.value ? [selected.value.id] : []));
const checkedPapers = computed(() => visible.value.filter((p) => checked.value.has(p.id)));
const pdfCount = computed(() => visible.value.filter((p) => p.pdf).length);

function listAuthors(paper: Paper) {
  const names = paper.authors.slice(0, 3).map(familyName).filter(Boolean);
  if (!names.length) return "Unknown author";
  return names.join(", ") + (paper.authors.length > 3 ? " et al." : "");
}

async function select(paper: Paper, scroll = false) {
  ui.selectedId = paper.id;
  if (scroll) {
    await nextTick();
    listEl.value?.querySelector(`[data-id="${paper.id}"]`)?.scrollIntoView({ block: "nearest" });
  }
}

function toggleCheck(paper: Paper, range = false) {
  const next = new Set(checked.value);
  if (range && anchor.value) {
    const ids = visible.value.map((p) => p.id);
    const [a, b] = [ids.indexOf(anchor.value), ids.indexOf(paper.id)].sort((x, y) => x - y);
    for (const id of ids.slice(a, b + 1)) next.add(id);
  } else if (next.has(paper.id)) next.delete(paper.id);
  else next.add(paper.id);
  anchor.value = paper.id;
  checked.value = next;
}

// Selecting a paper opens the preview pane, which narrows the list and can move rows. A double
// click therefore opens the paper the *first* click selected, not whatever is under the pointer now.
let firstClick: { id: string; at: number } | null = null;

function onRowClick(paper: Paper, event: MouseEvent) {
  if (event.metaKey || event.ctrlKey) return toggleCheck(paper);
  if (event.shiftKey) return toggleCheck(paper, true);
  if (event.detail >= 2 && firstClick && Date.now() - firstClick.at < 600) {
    const target = paperById.value.get(firstClick.id);
    firstClick = null;
    if (target) openPaper(target);
    return;
  }
  firstClick = { id: paper.id, at: Date.now() };
  void select(paper);
}

function openPaper(paper: Paper) {
  void router.push(`/paper/${paper.id}`);
}

function move(delta: number, extend = false) {
  const list = visible.value;
  if (!list.length) return;
  const index = list.findIndex((p) => p.id === ui.selectedId);
  const nextIndex = Math.max(0, Math.min(list.length - 1, index === -1 ? 0 : index + delta));
  const next = list[nextIndex];
  if (nextIndex >= pageSize.value) pageSize.value += 200;
  if (extend) {
    if (index !== -1 && !checked.value.has(list[index].id)) toggleCheck(list[index]);
    if (!checked.value.has(next.id)) toggleCheck(next);
  }
  void select(next, true);
}

async function removePapers(ids: string[]) {
  if (!ids.length) return;
  const targets = ids.map((id) => paperById.value.get(id)).filter((p): p is Paper => Boolean(p));
  const one = targets.length === 1;
  const { confirmed } = await askConfirm({
    title: one ? "Delete this paper?" : `Delete ${targets.length} papers?`,
    message: one
      ? `“${targets[0].title}” will be removed from your library, and its PDF and notes moved to your Google Drive trash. You can undo this.`
      : `They'll be removed from your library, and their PDFs and notes moved to your Google Drive trash. You can undo this.`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return;
  const list = visible.value;
  const after = list.slice(list.findIndex((p) => p.id === ids.at(-1)) + 1).find((p) => !ids.includes(p.id));
  const before = [...list].reverse().find((p) => !ids.includes(p.id));
  try {
    await deletePapersEverywhere(targets);
    checked.value = new Set();
    ui.selectedId = (after ?? before)?.id ?? null;
    toast(one ? "Paper deleted." : `${targets.length} papers deleted.`, { action: undoAction });
  } catch (error) {
    toastError(error, "Couldn't move the files to the Drive trash, so nothing was deleted.");
  }
}

function onKey(event: KeyboardEvent) {
  if (document.querySelector(".overlay, .tour")) return;
  const inSearch = event.target === searchInput.value;
  if (event.key === "/" && !isTypingTarget(event.target)) {
    event.preventDefault();
    searchInput.value?.focus();
    return;
  }
  if (event.key === "Escape") {
    if (isTypingTarget(event.target)) (event.target as HTMLElement).blur();
    if (search.value) search.value = "";
    else if (checked.value.size) checked.value = new Set();
    else ui.selectedId = null;
    return;
  }
  if (isTypingTarget(event.target) && !inSearch) return;
  if (event.key === "ArrowDown" || (!inSearch && event.key === "j")) {
    event.preventDefault();
    move(1, event.shiftKey);
  } else if (event.key === "ArrowUp" || (!inSearch && event.key === "k")) {
    event.preventDefault();
    move(-1, event.shiftKey);
  } else if (event.key === "Enter" && selected.value) {
    event.preventDefault();
    openPaper(selected.value);
  } else if (inSearch) {
    return;
  } else if ((event.metaKey || event.ctrlKey) && event.key === "a") {
    event.preventDefault();
    checked.value = new Set(visible.value.map((p) => p.id));
  } else if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    void removePapers(targetIds.value);
  } else if ((event.key === " " || event.key === "x") && selected.value) {
    event.preventDefault();
    toggleCheck(selected.value);
  } else if (["0", "1", "2", "3", "4", "5", "6", "7"].includes(event.key) && targetIds.value.length) {
    void setStatus(targetIds.value, readingStatuses.find((r) => r.key === event.key)?.id);
  } else if (event.key === "o" && selected.value) {
    openPaper(selected.value);
  } else if (event.key === "p" && selected.value?.pdf) {
    window.open(driveOpenUrl(selected.value.pdf.driveFileId), "_blank", "noopener");
  } else if (event.key === "c" && selected.value) {
    void copyText(`\\cite{${selected.value.citationKey}}`);
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

// Infinite list: render more rows as the sentinel scrolls into view.
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
watch(sentinel, (el) => {
  observer?.disconnect();
  if (!el) return;
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) pageSize.value += 200;
  });
  observer.observe(el);
});
onBeforeUnmount(() => observer?.disconnect());

async function setStatus(ids: string[], status: Paper["readingStatus"]) {
  try {
    for (const id of ids) await updatePaper(id, { readingStatus: status }, "Change reading status");
    const label = readingStatuses.find((r) => r.id === status)?.label;
    toast(`${ids.length === 1 ? "Marked" : `Marked ${ids.length} papers`} ${label ? `“${label}”` : "unread"}.`, { action: undoAction });
  } catch (error) {
    toastError(error);
  }
}

const statusLabel = (paper: Paper) => readingStatusLabel(paper.readingStatus);

// --- Filters (kept in the URL so they survive reloads and the back button) ---
function setFilter(patch: Partial<ListFilters>) {
  const next = { ...filters.value, ...patch };
  const query = {
    ...route.query,
    pdf: next.pdf || undefined,
    notes: next.notes ? "1" : undefined,
    untagged: next.untagged ? "1" : undefined,
    unfiled: undefined,
    status: next.status || undefined
  };
  void router.replace({ path: "/library", query });
}
const anyFilter = computed(() => Boolean(filters.value.pdf || filters.value.notes || filters.value.untagged || filters.value.status));
const clearFilters = { pdf: "", notes: false, untagged: false, status: "" } as const;

// --- Drag & drop ---
function onDragStart(paper: Paper, event: DragEvent) {
  const ids = checked.value.has(paper.id) ? [...checked.value] : [paper.id];
  event.dataTransfer?.setData("application/x-biblio-papers", JSON.stringify(ids));
  event.dataTransfer?.setData("text/plain", ids.map((id) => paperById.value.get(id)?.citationKey).join(", "));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}

function onRowDragOver(paper: Paper, event: DragEvent) {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  pdfDropTarget.value = paper.id;
}

async function onRowDrop(paper: Paper, event: DragEvent) {
  pdfDropTarget.value = null;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();
  void select(paper);
  toast(`Uploading ${file.name} to Drive…`);
  try {
    await attachPdf(paperById.value.get(paper.id) ?? paper, file);
    toast(`PDF attached to “${paper.title.slice(0, 50)}”.`);
  } catch (error) {
    toastError(error);
  }
}

// --- Bulk actions ---
async function bulkAddTag() {
  const tag = bulkTag.value.trim().replace(/^#/, "");
  if (!tag) return;
  await setPaperTag([...checked.value], tag, true).catch(toastError);
  bulkTag.value = "";
  toast(`Tagged ${checked.value.size} papers #${tag}.`, { action: undoAction });
}

const findingPdfs = ref("");
async function bulkFindPdfs() {
  const targets = checkedPapers.value.filter((p) => !p.pdf);
  if (!targets.length) return toast("All selected papers already have PDFs.");
  if (!session.profile.value?.driveRootFolderId) return toast("Connect Google Drive in Settings first.", { tone: "error" });
  let found = 0;
  for (const [i, paper] of targets.entries()) {
    findingPdfs.value = `Finding PDFs… ${i + 1}/${targets.length}`;
    try {
      await grabPdf(paper);
      found += 1;
    } catch {
      // Reported in the summary below.
    }
  }
  findingPdfs.value = "";
  toast(`Saved ${found} of ${targets.length} PDFs to Drive.${found < targets.length ? " The rest have no downloadable open-access copy." : ""}`);
}

function exportVisible() {
  downloadBibtex(visible.value);
  toast(`Exported ${visible.value.length} entries to references.bib.`);
}

const scopeEyebrow = computed(() => (scope.value.kind === "folder" ? "Folder" : scope.value.kind === "tag" ? "Tag" : "Library"));
</script>

<template>
  <div class="library" :class="{ 'has-inspector': selected }">
    <section class="list-pane">
        <header class="list-head">
          <div>
            <p class="eyebrow">{{ scopeEyebrow }}</p>
            <h1 class="display">{{ scope.label }}</h1>
            <p v-if="loaded" class="tally">
              {{ visible.length }} {{ visible.length === 1 ? "paper" : "papers" }}<template v-if="visible.length"> · {{ pdfCount }} with PDF</template>
            </p>
          </div>
          <span class="spacer" />
          <button class="btn sm quiet" type="button" :disabled="!visible.length" title="Export these papers as references.bib" @click="exportVisible">
            <AppIcon name="download" :size="14" /> Export .bib
          </button>
        </header>

        <div v-if="checked.size" class="toolbar bulk">
          <strong class="tnum">{{ checked.size }} selected</strong>
          <form class="row" @submit.prevent="bulkAddTag">
            <input v-model="bulkTag" class="input sm" placeholder="Add tag…" aria-label="Tag selected papers" />
          </form>
          <button class="btn sm" type="button" @click="copyText(citeCommand(checkedPapers))"><AppIcon name="quote" :size="13" /> \cite</button>
          <button class="btn sm" type="button" :disabled="!!findingPdfs" @click="bulkFindPdfs"><AppIcon name="pdf" :size="13" /> {{ findingPdfs || "Find PDFs" }}</button>
          <button class="btn sm" type="button" @click="downloadBibtex(checkedPapers)"><AppIcon name="download" :size="13" /> .bib</button>
          <button class="btn sm danger" type="button" @click="removePapers([...checked])"><AppIcon name="trash" :size="13" /> Delete</button>
          <span class="spacer" />
          <button class="btn sm quiet" type="button" @click="checked = new Set()">Clear</button>
        </div>
        <div v-else class="toolbar">
          <div class="search" data-tour="search">
            <AppIcon name="search" />
            <input ref="searchInput" v-model="search" type="search" placeholder="Search — try author:hinton, year:2015-2020, #rl" aria-label="Search library" />
            <kbd v-if="!search">/</kbd>
          </div>
          <div class="filters" role="group" aria-label="Filters" data-tour="filters">
            <button
              v-for="s in readingStatuses"
              :key="s.id"
              type="button"
              class="filter"
              :class="{ on: filters.status === s.id }"
              @click="setFilter({ status: filters.status === s.id ? '' : s.id })"
            >
              {{ s.label }}
            </button>
            <span class="divider" />
            <button type="button" class="filter" :class="{ on: filters.pdf === 'has' }" @click="setFilter({ pdf: filters.pdf === 'has' ? '' : 'has' })">PDF</button>
            <button type="button" class="filter" :class="{ on: filters.notes }" @click="setFilter({ notes: !filters.notes })">Notes</button>
            <button type="button" class="filter" :class="{ on: filters.untagged }" @click="setFilter({ untagged: !filters.untagged })">Untagged</button>
          </div>
          <label class="sort small">
            <span class="faint">Sort</span>
            <select v-model="activeSort" class="select sm">
              <option v-if="searching" value="relevance">Best match</option>
              <option v-for="o in sortOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </label>
        </div>

      <p v-if="loadError" class="notice error">Couldn't load your library: {{ loadError }}</p>

      <div v-if="!loaded" class="skeleton" aria-label="Loading library">
        <div v-for="i in 6" :key="i" class="sk-row" />
      </div>

      <div v-else-if="!papers.length" class="empty-state">
        <h2>Your library is empty</h2>
        <p>Import a .bib file, or search for the first paper you want to keep.</p>
        <div class="row">
          <button class="btn primary" type="button" @click="openAdd('import')"><AppIcon name="upload" /> Import .bib</button>
          <button class="btn" type="button" @click="openAdd('search')"><AppIcon name="search" /> Search for papers</button>
        </div>
      </div>

      <div v-else-if="papers.length && !visible.length" class="empty-state">
        <template v-if="searching">
          <h2>Nothing matches “{{ search }}”</h2>
          <p>
            <button class="link-btn" type="button" @click="search = ''">Clear the search</button>
            <template v-if="anyFilter"> or <button class="link-btn" type="button" @click="setFilter(clearFilters)">remove filters</button></template>
            — or <button class="link-btn" type="button" @click="openAdd('search')">find it online</button>.
          </p>
        </template>
        <template v-else-if="anyFilter">
          <h2>No papers match these filters</h2>
          <p><button class="link-btn" type="button" @click="setFilter(clearFilters)">Remove filters</button></p>
        </template>
        <template v-else-if="scope.kind === 'folder'">
          <h2>This folder is empty</h2>
          <p>Drag papers here from All papers, or use this folder for a broad project area.</p>
          <div class="row">
            <RouterLink class="btn" to="/library">Browse all papers</RouterLink>
            <button class="btn primary" type="button" @click="openAdd('search')"><AppIcon name="plus" /> Add papers</button>
          </div>
        </template>
        <template v-else>
          <h2>Nothing here</h2>
          <p>No papers in “{{ scope.label }}” right now.</p>
        </template>
      </div>

      <template v-else-if="visible.length">
        <ol ref="listEl" data-tour="list" class="papers" role="listbox" aria-label="Papers" aria-multiselectable="true">
          <li
            v-for="paper in rendered"
            :key="paper.id"
            :data-id="paper.id"
            class="entry"
            :class="{ selected: ui.selectedId === paper.id, checked: checked.has(paper.id), 'pdf-drop': pdfDropTarget === paper.id }"
            role="option"
            :aria-selected="ui.selectedId === paper.id"
            draggable="true"
            @click="onRowClick(paper, $event)"
            @dragstart="onDragStart(paper, $event)"
            @dragover="onRowDragOver(paper, $event)"
            @dragleave="pdfDropTarget = null"
            @drop="onRowDrop(paper, $event)"
          >
            <input class="check" type="checkbox" :checked="checked.has(paper.id)" :aria-label="`Select ${paper.title}`" @click.stop="toggleCheck(paper, ($event as MouseEvent).shiftKey)" />
            <span class="year tnum">{{ paper.issued?.year ?? "n.d." }}</span>
            <div class="body">
              <button class="key-eyebrow mono" type="button" title="Copy \cite{…}" @click.stop="copyText(`\\cite{${paper.citationKey}}`)">{{ paper.citationKey }}</button>
              <p class="title">
                <template v-for="(seg, i) in highlight(paper.title, searching ? query : null)" :key="i"><mark v-if="seg.hit">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template>
              </p>
              <p class="meta">
                <span class="authors">
                  <template v-for="(seg, i) in highlight(listAuthors(paper), searching ? query : null, ['author'])" :key="i"><mark v-if="seg.hit">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template>
                </span>
                <span v-if="paper.containerTitle" class="venue">{{ paper.containerTitle }}</span>
              </p>
              <div v-if="paper.tags.length || pdfDropTarget === paper.id" class="tag-list row-tags">
                <span v-if="pdfDropTarget === paper.id" class="chip accent">Drop to attach PDF</span>
                <template v-else>
                  <span v-for="tag in paper.tags.slice(0, 4)" :key="tag" class="tag" :title="tag"><span class="tag-text">{{ tag }}</span></span>
                  <span v-if="paper.tags.length > 4" class="tag more" :title="paper.tags.slice(4).join(', ')">+{{ paper.tags.length - 4 }}</span>
                </template>
              </div>
              <p v-if="paper.savedBecause" class="saved-because">Saved because: {{ paper.savedBecause }}</p>
            </div>
            <div class="side">
              <span class="marks">
                <span v-if="normalizeReadingStatus(paper.readingStatus)" class="status-mark" :class="normalizeReadingStatus(paper.readingStatus)">{{ statusLabel(paper) }}</span>
                <AppIcon v-if="paper.notesMarkdown?.trim()" name="note" :size="14" />
                <AppIcon v-if="paper.pdf" name="pdf" :size="14" class="has-pdf" />
              </span>
            </div>
          </li>
        </ol>
        <div v-if="rendered.length < visible.length" ref="sentinel" class="faint small more">Loading more…</div>
        <p class="keys-hint faint small"><kbd>↑</kbd><kbd>↓</kbd> select · <kbd>Enter</kbd> open · <kbd>?</kbd> shortcuts</p>
      </template>
    </section>

    <PaperInspector v-if="selected" :paper="selected" @close="ui.selectedId = null" />
  </div>
</template>

<style scoped>
.library {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 100vh;
}

.library.has-inspector {
  grid-template-columns: minmax(0, 1fr) minmax(340px, 430px);
}

.list-pane {
  min-width: 0;
  padding: 32px 40px 56px;
}

.list-head {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 18px;
}

.list-head h1 {
  font-size: calc(32px * var(--text-scale));
  font-weight: 600;
  letter-spacing: -0.02em;
}

.tally {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: calc(14px * var(--text-scale));
  color: var(--text-3);
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 -40px;
  padding: 10px 40px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.toolbar.bulk {
  background: var(--accent-soft);
  color: var(--accent-ink);
}

.search {
  display: flex;
  /* Keep the search usable: when space runs out, the filter chips wrap below it. */
  flex: 1 1 340px;
  min-width: 240px;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-3);
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
}

.filters {
  display: flex;
  gap: 4px;
}

.divider {
  width: 1px;
  margin: 4px 4px;
  background: var(--border);
}

.status-mark {
  font-family: var(--font-serif);
  font-variant-caps: all-small-caps;
  font-size: calc(14.5px * var(--text-scale));
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 14px;
  color: var(--text-3);
}

.status-mark.toRead {
  color: var(--accent-ink);
}

.filters {
  flex-wrap: wrap;
}

.filter {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  font-size: calc(12.5px * var(--text-scale));
  cursor: pointer;
}

.filter:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.filter.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-weight: 550;
}

.sort {
  display: flex;
  align-items: center;
  gap: 6px;
}

.select.sm,
.input.sm {
  width: auto;
  height: 30px;
  font-size: calc(12.5px * var(--text-scale));
}

.input.sm {
  width: 130px;
}

/* Bibliography-style entries: year in the margin, title in the serif, a hairline between. */
.papers {
  margin: 8px -12px 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: grid;
  grid-template-columns: 16px 46px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: baseline;
  padding: 14px 12px;
  border-bottom: 1px solid var(--border);
  cursor: default;
  user-select: none;
}

.entry:hover {
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}

.entry.selected {
  background: var(--select);
  box-shadow: inset 2px 0 0 var(--accent);
}

.entry.checked {
  background: var(--accent-soft);
}


.entry.pdf-drop {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

.check {
  margin: 0;
  align-self: center;
  accent-color: var(--accent);
  opacity: 0;
}

.entry:hover .check,
.entry.checked .check,
.entry.selected .check {
  opacity: 1;
}

.year {
  font-family: var(--font-serif);
  font-size: calc(14px * var(--text-scale));
  color: var(--text-3);
  text-align: right;
}

.title {
  font-family: var(--font-serif);
  font-size: calc(16.5px * var(--text-scale));
  font-weight: 550;
  line-height: 1.35;
  letter-spacing: -0.005em;
  color: var(--text);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  margin-top: 3px;
  font-size: calc(13px * var(--text-scale));
  color: var(--text-2);
}

.venue {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.row-tags {
  margin-top: 7px;
}

.saved-because {
  margin-top: 6px;
  font-size: calc(12.5px * var(--text-scale));
  color: var(--text-3);
}

.side {
  display: grid;
  justify-items: end;
  gap: 4px;
  align-self: start;
  padding-top: 3px;
}

.marks {
  display: flex;
  gap: 6px;
  min-height: 14px;
  color: var(--text-3);
}

.has-pdf {
  color: var(--accent-ink);
}

.key-eyebrow {
  display: inline-flex;
  width: 100%;
  max-width: 100%;
  margin-bottom: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-3);
  font-size: calc(11px * var(--text-scale));
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: copy;
}

.key-eyebrow:hover {
  color: var(--text);
}

.more {
  padding: 16px;
  text-align: center;
}

.keys-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 20px;
}

.keys-hint kbd {
  height: 18px;
  min-width: 18px;
  font-size: calc(10.5px * var(--text-scale));
}

.skeleton {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.sk-row {
  height: 58px;
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

@media (max-width: 1180px) {
  .library.has-inspector {
    grid-template-columns: minmax(0, 1fr);
  }

  .library.has-inspector :deep(.inspector) {
    position: fixed;
    z-index: 15;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(430px, 100vw);
    box-shadow: var(--shadow-lg);
  }
}

@media (max-width: 820px) {
  .list-pane {
    padding: 16px;
  }

  .toolbar {
    top: 52px;
    margin: 0 -16px;
    padding: 8px 16px;
  }

  .entry {
    grid-template-columns: 0 40px minmax(0, 1fr);
    gap: 10px;
  }

  .side,
  .keys-hint,
  .filters {
    display: none;
  }
}
</style>
