<script setup lang="ts">
import type { Paper, ResearchNote } from "@biblio/core";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { creatorsToText, shortAuthors, updatePaper, updateResearchNote, useLibrary } from "../services/library";
import { renderNotes } from "../services/notes";
import { toastError } from "../services/ui";

// Markdown notes with @[ paper links: a paper's own notes, or the text of a research note.
const props = defineProps<{ paper?: Paper; researchNote?: ResearchNote; compact?: boolean; autofocus?: boolean; placeholder?: string }>();
const router = useRouter();
const { papers, paperByKey } = useLibrary();

const docId = computed(() => props.paper?.id ?? props.researchNote?.id ?? "");
const stored = computed(() => (props.paper ? props.paper.notesMarkdown : props.researchNote?.bodyMarkdown) ?? "");
const persist = (markdown: string) =>
  props.paper ? updatePaper(props.paper.id, { notesMarkdown: markdown }) : props.researchNote ? updateResearchNote(props.researchNote.id, { bodyMarkdown: markdown }) : Promise.resolve();

const draft = ref(stored.value);
const mode = ref<"write" | "preview">(props.autofocus || !draft.value.trim() ? "write" : "preview");
const status = ref<"saved" | "dirty" | "saving" | "error">("saved");
const textarea = ref<HTMLTextAreaElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

// Adopt remote changes (e.g. a citation-key rename rewrote this note) when there are no local edits.
watch(
  () => [docId.value, stored.value] as const,
  ([id, remote], old) => {
    if (old && old[0] !== id) {
      draft.value = remote ?? "";
      status.value = "saved";
      mode.value = draft.value.trim() ? "preview" : "write";
    } else if (status.value === "saved") draft.value = remote ?? "";
  }
);

async function save() {
  clearTimeout(timer);
  if (draft.value === stored.value) {
    status.value = "saved";
    return;
  }
  status.value = "saving";
  try {
    await persist(draft.value);
    status.value = "saved";
  } catch (error) {
    status.value = "error";
    toastError(error, "Couldn't save notes.");
  }
}

function onInput() {
  status.value = "dirty";
  clearTimeout(timer);
  timer = setTimeout(save, 900);
  updateSuggest();
}

onBeforeUnmount(() => {
  if (status.value === "dirty") void save();
});

defineExpose({ save, focus: () => edit() });

onMounted(() => {
  if (props.autofocus) void edit();
});

async function edit() {
  mode.value = "write";
  await nextTick();
  textarea.value?.focus();
}

const html = computed(() => renderNotes(draft.value, paperByKey.value));

function onPreviewClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-paper-id]");
  if (link) {
    event.preventDefault();
    void router.push(`/paper/${link.dataset.paperId}`);
  } else if (!(event.target as HTMLElement).closest("a")) {
    void edit();
  }
}

// --- @[ autocomplete ---
const suggest = ref<{ query: string; start: number; top: number; left: number } | null>(null);
const active = ref(0);

const matches = computed(() => {
  if (!suggest.value) return [];
  const terms = suggest.value.query.toLowerCase().split(/\s+/).filter(Boolean);
  // Best first: the cite key or first author starts with what's typed (@[pand → Pandarinath, not a
  // paper Pandarinath co-wrote), then title words, then any other match.
  const rank = (p: Paper) => {
    if (!terms.length) return 0;
    const first = terms[0];
    const firstAuthor = (p.authors[0]?.family ?? p.authors[0]?.literal ?? "").toLowerCase();
    if (p.citationKey.toLowerCase().startsWith(first) || firstAuthor.startsWith(first)) return 0;
    if (p.title.toLowerCase().split(/\W+/).some((word) => word.startsWith(first))) return 1;
    return 2;
  };
  return papers.value
    .filter((p) => p.id !== props.paper?.id)
    .filter((p) => {
      const text = `${p.citationKey} ${p.title} ${creatorsToText(p.authors)} ${p.issued?.year ?? ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    })
    .map((p, index) => ({ p, index, rank: rank(p) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, 8)
    .map(({ p }) => p);
});

function caretCoords(el: HTMLTextAreaElement, position: number) {
  // Mirror the textarea in a hidden div to find the caret's pixel position.
  const mirror = document.createElement("div");
  const style = getComputedStyle(el);
  for (const prop of ["font", "lineHeight", "padding", "border", "letterSpacing", "wordSpacing", "boxSizing", "width", "whiteSpace", "overflowWrap"] as const) {
    mirror.style[prop] = style[prop];
  }
  Object.assign(mirror.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", top: "0", left: "0" });
  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop + parseFloat(style.lineHeight || "20") - el.scrollTop;
  const left = Math.min(marker.offsetLeft, el.clientWidth - 320);
  mirror.remove();
  return { top, left: Math.max(0, left) };
}

function updateSuggest() {
  const el = textarea.value;
  if (!el) return;
  const before = el.value.slice(0, el.selectionStart);
  const match = /@\[([^\]\n]{0,40})$/.exec(before);
  if (!match) {
    suggest.value = null;
    return;
  }
  const start = el.selectionStart - match[0].length;
  suggest.value = { query: match[1], start, ...caretCoords(el, el.selectionStart) };
  active.value = 0;
}

function choose(paper: Paper) {
  const el = textarea.value;
  if (!el || !suggest.value) return;
  const after = el.value.slice(el.selectionStart).replace(/^[^\]\s]*\]/, "");
  const insert = `@[${paper.citationKey}]`;
  const next = el.value.slice(0, suggest.value.start) + insert + after;
  const caret = suggest.value.start + insert.length;
  // Update the DOM synchronously so a key typed right after choosing lands after the link.
  el.value = next;
  el.setSelectionRange(caret, caret);
  draft.value = next;
  suggest.value = null;
  onInput();
}

function onBlur() {
  void save();
  setTimeout(() => (suggest.value = null), 150);
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === "s") {
    event.preventDefault();
    void save();
    return;
  }
  if (!suggest.value || !matches.value.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    active.value = (active.value + 1) % matches.value.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    active.value = (active.value - 1 + matches.value.length) % matches.value.length;
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    choose(matches.value[active.value]);
  } else if (event.key === "Escape") {
    event.stopPropagation();
    suggest.value = null;
  }
}
</script>

<template>
  <div class="notes-editor" :class="{ compact }">
    <div class="bar">
      <div class="seg" role="tablist">
        <button type="button" :class="{ on: mode === 'write' }" @click="edit">Write</button>
        <button type="button" :class="{ on: mode === 'preview' }" @click="save(); mode = 'preview'">Preview</button>
      </div>
      <span class="spacer" />
      <span class="status small" :class="status">
        {{ status === "saving" ? "Saving…" : status === "dirty" ? "Unsaved" : status === "error" ? "Not saved" : "Saved" }}
      </span>
    </div>

    <div v-show="mode === 'write'" class="write">
      <textarea
        ref="textarea"
        v-model="draft"
        class="textarea"
        rows="14"
:placeholder="placeholder ?? 'Your notes, in Markdown. Type @[ to link another paper — e.g. “extends @[vaswaniAttentionNeed2017] by…”'"
        @input="onInput"
        @keydown="onKeydown"
        @click="updateSuggest"
        @blur="onBlur"
      />
      <ul v-if="suggest && matches.length" class="suggest card" :style="{ top: `${suggest.top + 6}px`, left: `${suggest.left}px` }" role="listbox">
        <li
          v-for="(p, i) in matches"
          :key="p.id"
          :class="{ active: i === active }"
          role="option"
          :aria-selected="i === active"
          @mousedown.prevent="choose(p)"
          @mouseenter="active = i"
        >
          <span class="s-title">{{ p.title }}</span>
          <span class="s-meta">{{ shortAuthors(p.authors) }}<template v-if="p.issued?.year"> · {{ p.issued.year }}</template> · <span class="mono">{{ p.citationKey }}</span></span>
        </li>
      </ul>
      <p v-else-if="suggest" class="suggest card empty small faint" :style="{ top: `${suggest.top + 6}px`, left: `${suggest.left}px` }">No papers match “{{ suggest.query }}”.</p>
      <p class="faint small help">Markdown supported · <code>@[</code> links a paper · <kbd>⌘</kbd><kbd>S</kbd> saves (it also autosaves)</p>
    </div>

    <div v-show="mode === 'preview'" class="preview" @click="onPreviewClick">
      <div v-if="draft.trim()" class="prose" v-html="html" />
      <p v-else class="faint">No notes yet. Click to start writing.</p>
    </div>
  </div>
</template>

<style scoped>
.notes-editor {
  display: grid;
  gap: 10px;
}

.bar {
  display: flex;
  align-items: center;
}

.seg {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.seg button {
  height: 26px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-2);
  font-size: calc(12.5px * var(--text-scale));
  font-weight: 500;
  cursor: pointer;
}

.seg button.on {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.status {
  color: var(--text-3);
}

.status.dirty,
.status.saving {
  color: var(--warn-ink);
}

.status.error {
  color: var(--danger);
}

.write {
  position: relative;
}

.compact .write .textarea {
  min-height: 200px;
  font-size: calc(14px * var(--text-scale));
}

.compact .help {
  display: none;
}

.write .textarea {
  min-height: 280px;
  font-family: var(--font-ui);
  font-size: calc(15px * var(--text-scale));
  line-height: 1.65;
}

.help {
  margin-top: 6px;
}

.help code {
  font-family: var(--font-mono);
}

.suggest {
  position: absolute;
  z-index: 10;
  width: 320px;
  max-height: 300px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  box-shadow: var(--shadow);
}

.suggest.empty {
  padding: 8px 10px;
}

.suggest li {
  display: grid;
  gap: 1px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.suggest li.active {
  background: var(--accent-soft);
}

.s-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: calc(13.5px * var(--text-scale));
  font-weight: 550;
}

.s-meta {
  font-size: calc(11.5px * var(--text-scale));
  color: var(--text-2);
}

.preview {
  min-height: 120px;
  padding: 4px 0;
  cursor: text;
}
</style>
