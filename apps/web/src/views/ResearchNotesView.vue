<script setup lang="ts">
import { extractCitationLinks, type Paper } from "@biblio/core";
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import NotesEditor from "../components/NotesEditor.vue";
import { deleteResearchNoteEverywhere } from "../services/deletion";
import { createResearchNote, shortAuthors, updateResearchNote, useLibrary } from "../services/library";
import { readingStatusLabel } from "../services/scope";
import { askConfirm, toastError } from "../services/ui";

// Research notes are freeform Markdown: a question, a project, a related-work draft. Papers are
// connected by writing @[key] in the text; nothing else to set up. Each note is a .md file in
// notes/ in the user's Drive, beside the papers' own notes.

const route = useRoute();
const router = useRouter();
const { researchNotes, paperByKey } = useLibrary();

const notes = computed(() => [...researchNotes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const selected = computed(() => notes.value.find((n) => n.id === route.params.id) ?? (route.params.id ? null : notes.value[0]) ?? null);

const title = ref("");
const titleInput = ref<HTMLInputElement | null>(null);
const editor = ref<InstanceType<typeof NotesEditor> | null>(null);
let titleTimer: ReturnType<typeof setTimeout> | undefined;

// Reload the title only when switching notes, so a save coming back never clobbers typing. A new
// note (?new=1) gets its title selected, whichever arrives first: the note or the route change.
watch(
  () => [selected.value?.id, route.query.new] as const,
  async ([id, isNew], previous) => {
    if (id !== previous?.[0]) title.value = selected.value?.title ?? "";
    if (isNew && selected.value && selected.value.id === route.params.id) {
      await nextTick();
      titleInput.value?.select();
      void router.replace({ path: route.path });
    }
  },
  { immediate: true }
);

function saveTitle() {
  clearTimeout(titleTimer);
  const note = selected.value;
  const next = title.value.trim() || "Untitled note";
  if (note && next !== note.title) updateResearchNote(note.id, { title: next }).catch(toastError);
}

function onTitleInput() {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(saveTitle, 800);
}

async function newNote() {
  try {
    const note = await createResearchNote();
    await router.push({ path: `/research-notes/${note.id}`, query: { new: "1" } });
  } catch (error) {
    toastError(error);
  }
}

/** Papers this note links to, in the order they first appear. */
const linked = computed<Paper[]>(() =>
  selected.value ? extractCitationLinks(selected.value.bodyMarkdown).flatMap((key) => paperByKey.value.get(key) ?? []) : []
);

function preview(markdown: string) {
  const line = markdown
    .split("\n")
    .map((l) => l.replace(/^#+\s*|^[-*+]\s+|\*\*|__/g, "").trim())
    .find(Boolean);
  return line ? line.replace(/@\[([^\]]+)\]/g, (raw, key: string) => (paperByKey.value.get(key) ? shortAuthors(paperByKey.value.get(key)!.authors) : raw)) : "Empty note";
}

const linkCount = (markdown: string) => extractCitationLinks(markdown).filter((key) => paperByKey.value.has(key)).length;

async function removeNote() {
  const note = selected.value;
  if (!note) return;
  const { confirmed } = await askConfirm({
    title: "Delete this note?",
    message: `“${note.title}” will be deleted, and its file moved to your Drive's trash. Papers it links stay in your library.`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return;
  try {
    await deleteResearchNoteEverywhere(note);
    await router.replace("/research-notes");
  } catch (error) {
    toastError(error, "Couldn't delete the note.");
  }
}
</script>

<template>
  <div class="research-notes">
    <aside class="notes-list">
      <header class="list-head">
        <h1 class="display">Notes</h1>
        <span class="spacer" />
        <button class="btn sm primary" type="button" @click="newNote"><AppIcon name="plus" :size="13" /> New note</button>
      </header>
      <RouterLink v-for="note in notes" :key="note.id" class="note-row" :class="{ active: note.id === selected?.id }" :to="`/research-notes/${note.id}`">
        <strong>{{ note.title }}</strong>
        <span>{{ preview(note.bodyMarkdown) }}</span>
        <small v-if="linkCount(note.bodyMarkdown)">{{ linkCount(note.bodyMarkdown) }} paper{{ linkCount(note.bodyMarkdown) === 1 ? "" : "s" }}</small>
      </RouterLink>
    </aside>

    <main v-if="selected" class="note-main">
      <input
        ref="titleInput"
        v-model="title"
        class="title-input display"
        aria-label="Title"
        placeholder="Untitled note"
        @input="onTitleInput"
        @blur="saveTitle"
        @keydown.enter.prevent="editor?.focus()"
      />
      <NotesEditor
        ref="editor"
        :key="selected.id"
        :research-note="selected"
        :autofocus="false"
        placeholder="Write anything: a question, a plan, a draft. Type @[ to link a paper — e.g. “@[vaswaniAttentionNeed2017] scales better because…”"
      />

      <section class="linked">
        <h2 class="section-label">Papers in this note</h2>
        <ul v-if="linked.length">
          <li v-for="paper in linked" :key="paper.id">
            <RouterLink :to="`/paper/${paper.id}`" class="paper-title">{{ paper.title }}</RouterLink>
            <span class="faint small">
              {{ shortAuthors(paper.authors) }}<template v-if="paper.issued?.year">, {{ paper.issued.year }}</template>
              <template v-if="paper.readingStatus"> · {{ readingStatusLabel(paper.readingStatus) }}</template>
            </span>
          </li>
        </ul>
        <p v-else class="faint small">Papers you link with <code>@[</code> show up here, and the note shows up on their pages.</p>
      </section>

      <button class="btn danger sm delete" type="button" @click="removeNote"><AppIcon name="trash" :size="13" /> Delete note</button>
    </main>

    <main v-else class="note-main empty-state">
      <h2>{{ route.params.id ? "This note doesn't exist anymore" : "Notes for anything bigger than one paper" }}</h2>
      <p>A question you're chasing, a project, a related-work draft. Write in Markdown and link papers with <code>@[</code>. Each note is a Markdown file in your Drive.</p>
      <button class="btn primary" type="button" @click="newNote"><AppIcon name="plus" /> New note</button>
    </main>
  </div>
</template>

<style scoped>
.research-notes {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  min-height: 100vh;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: 24px 16px;
}

.list-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 6px 14px;
}

.list-head h1 {
  font-size: calc(26px * var(--text-scale));
}

.note-row {
  display: grid;
  gap: 2px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-decoration: none;
}

.note-row:hover,
.note-row.active {
  background: var(--surface-3);
}

.note-row strong {
  font-weight: 600;
}

.note-row span {
  overflow: hidden;
  color: var(--text-2);
  font-size: calc(13px * var(--text-scale));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-row small {
  color: var(--text-3);
}

.note-main {
  display: grid;
  gap: 18px;
  align-content: start;
  max-width: 860px;
  padding: 32px 40px 64px;
}

.title-input {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: calc(34px * var(--text-scale));
  line-height: 1.15;
  outline: none;
}

.title-input::placeholder {
  color: var(--text-3);
}

.linked ul {
  display: grid;
  gap: 12px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.linked li {
  display: grid;
  gap: 1px;
}

.paper-title {
  color: var(--text);
  font-family: var(--font-serif);
  font-weight: 600;
}

.linked .faint code {
  font-family: var(--font-mono);
}

.delete {
  justify-self: start;
}

.empty-state {
  justify-items: start;
  max-width: 560px;
  padding-top: 80px;
}

.empty-state h2 {
  font-family: var(--font-serif);
  font-size: calc(24px * var(--text-scale));
}

.empty-state p {
  color: var(--text-2);
  line-height: 1.6;
}

.empty-state code {
  font-family: var(--font-mono);
}

@media (max-width: 760px) {
  .research-notes {
    grid-template-columns: 1fr;
  }

  .notes-list {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .note-main {
    padding: 24px 16px 48px;
  }
}
</style>
