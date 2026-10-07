<script setup lang="ts">
import { paperToBibtex, type Paper } from "@bibliograph/core";
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { creatorsToText, paperTypeLabels, updatePaper, useLibrary } from "../services/library";
import { renderNotes } from "../services/notes";
import { copyText, toastError } from "../services/ui";
import AppIcon from "./AppIcon.vue";
import BacklinkList from "./BacklinkList.vue";
import NotesEditor from "./NotesEditor.vue";
import PdfPanel from "./PdfPanel.vue";
import StatusControl from "./StatusControl.vue";
import TagEditor from "./TagEditor.vue";

const props = defineProps<{ paper: Paper }>();
const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const { paperByKey, backlinkContexts } = useLibrary();
const abstractOpen = ref(false);
const editingNotes = ref(false);
const reason = ref(props.paper.savedBecause ?? "");
watch(
  () => props.paper.id,
  () => {
    abstractOpen.value = false;
    editingNotes.value = false;
    reason.value = props.paper.savedBecause ?? "";
  }
);

const authors = computed(() => {
  const list = props.paper.authors;
  const text = creatorsToText(list.slice(0, 10)).replace(/; /g, ", ");
  return list.length > 10 ? `${text}, and ${list.length - 10} more` : text;
});
const venue = computed(() => {
  const p = props.paper;
  const parts = [p.containerTitle, p.volume && `${p.volume}${p.issue ? `(${p.issue})` : ""}`, p.pages && `pp. ${p.pages}`].filter(Boolean);
  return parts.join(", ");
});
const notesHtml = computed(() => renderNotes(props.paper.notesMarkdown, paperByKey.value));
const mentionedIn = computed(() => (backlinkContexts.value.get(props.paper.citationKey) ?? []).filter((entry) => entry.sourceId !== props.paper.id));

function saveReason() {
  const value = reason.value.trim();
  updatePaper(props.paper.id, { savedBecause: value || undefined }, "Change saved reason").catch(toastError);
}

function followCite(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-paper-id]");
  if (!link) return;
  event.preventDefault();
  void router.push(`/paper/${link.dataset.paperId}`);
}
</script>

<template>
  <aside class="inspector" aria-label="Paper preview">
    <header class="ins-head">
      <p class="eyebrow">{{ paperTypeLabels[paper.type] }}<template v-if="paper.issued?.year"> · {{ paper.issued.year }}</template></p>
      <span class="spacer" />
      <RouterLink class="btn sm" :to="`/paper/${paper.id}`">Open <AppIcon name="chevron-right" :size="13" /></RouterLink>
      <button class="btn quiet icon" type="button" aria-label="Close preview" @click="emit('close')"><AppIcon name="x" /></button>
    </header>

    <div class="ins-scroll">
      <button class="key-eyebrow mono" type="button" title="Copy \cite{…}" @click="copyText(`\\cite{${paper.citationKey}}`, 'Copied')">{{ paper.citationKey }}</button>
      <h2 class="title">{{ paper.title }}</h2>
      <p class="authors">{{ authors || "Unknown author" }}</p>
      <p v-if="venue" class="venue">{{ venue }}</p>

      <div class="ids">
        <a v-if="paper.doi" :href="`https://doi.org/${paper.doi}`" target="_blank" rel="noopener" class="chip">DOI <AppIcon name="external" :size="11" /></a>
        <a v-if="paper.arxivId" :href="`https://arxiv.org/abs/${paper.arxivId}`" target="_blank" rel="noopener" class="chip">arXiv <AppIcon name="external" :size="11" /></a>
        <a v-if="paper.pmid" :href="`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}`" target="_blank" rel="noopener" class="chip">PubMed <AppIcon name="external" :size="11" /></a>
        <a v-if="paper.url && !paper.doi" :href="paper.url" target="_blank" rel="noopener" class="chip">Web <AppIcon name="external" :size="11" /></a>
      </div>

      <section class="block"><StatusControl :paper="paper" /></section>
      <section class="block">
        <label class="field small">Saved because <input v-model="reason" class="input" placeholder="Useful for…" @change="saveReason" @blur="saveReason" /></label>
      </section>
      <section class="block"><PdfPanel :paper="paper" /></section>

      <section class="block cite">
        <button class="btn sm quiet" type="button" @click="copyText(paperToBibtex(paper), 'Copied BibTeX')"><AppIcon name="copy" :size="13" /> BibTeX</button>
      </section>

      <section v-if="paper.abstract" class="block">
        <p class="section-label">Abstract</p>
        <p class="abstract" :class="{ clamp: !abstractOpen }">{{ paper.abstract }}</p>
        <button v-if="paper.abstract.length > 420" class="link-btn small" type="button" @click="abstractOpen = !abstractOpen">{{ abstractOpen ? "Less" : "More" }}</button>
      </section>

      <section class="block">
        <p class="section-label">Tags</p>
        <TagEditor :paper="paper" />
      </section>

      <section class="block notes-block">
        <div class="row">
          <p class="section-label">Notes</p>
          <span class="spacer" />
          <button v-if="editingNotes" class="link-btn small" type="button" @click="editingNotes = false">Done</button>
          <button v-else class="link-btn small" type="button" @click="editingNotes = true">{{ paper.notesMarkdown?.trim() ? "Edit" : "Write notes" }}</button>
        </div>
        <NotesEditor v-if="editingNotes" :key="paper.id" :paper="paper" compact autofocus @keydown.esc.stop="editingNotes = false" />
        <div
          v-else-if="paper.notesMarkdown?.trim()"
          class="prose notes"
          title="Double-click to edit"
          @click="followCite"
          @dblclick="editingNotes = true"
          v-html="notesHtml"
        />
        <p v-else class="faint small empty-notes" title="Double-click to write" @dblclick="editingNotes = true">No notes yet — double-click to write.</p>
      </section>

      <section v-if="mentionedIn.length" class="block">
        <p class="section-label">Mentioned in notes</p>
        <BacklinkList :paper="paper" compact />
      </section>
    </div>
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
  border-left: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
}

.ins-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 8px 20px;
}

.ins-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 32px;
}

.title {
  font-family: var(--font-serif);
  font-size: calc(21px * var(--text-scale));
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.authors {
  margin-top: 8px;
  color: var(--text);
  font-size: calc(13.5px * var(--text-scale));
}

.venue {
  margin-top: 2px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: calc(13.5px * var(--text-scale));
  color: var(--text-2);
}

.ids {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.ids .chip {
  text-decoration: none;
}

.block {
  margin-top: 20px;
}

.cite {
  display: flex;
  align-items: center;
  gap: 6px;
}

.key-eyebrow {
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  margin-bottom: 6px;
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

.abstract {
  font-family: var(--font-serif);
  font-size: calc(14.5px * var(--text-scale));
  line-height: 1.65;
  color: var(--text);
}

.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notes,
.empty-notes {
  cursor: text;
}

.notes {
  font-size: calc(14.5px * var(--text-scale));
  max-height: 260px;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black 80%, transparent);
}

</style>
