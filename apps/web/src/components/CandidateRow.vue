<script setup lang="ts">
import type { Paper, PaperCandidate } from "@biblio/core";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { grabPdf } from "../services/drive";
import { addPaper, checkDuplicate, creatorsToText, paperTypeLabels, useLibrary } from "../services/library";
import { readingStatuses } from "../services/scope";
import { useSession } from "../services/session";
import { toastError, ui } from "../services/ui";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ candidate: PaperCandidate; citedBy?: number }>();
const emit = defineEmits<{ added: [paper: Paper] }>();
const router = useRouter();
const session = useSession();
const { paperById } = useLibrary();

const addedId = ref<string | null>(null);
const busy = ref(false);
const pdfState = ref<"idle" | "saving" | "saved" | "failed">("idle");
const pdfStep = ref("");
const expanded = ref(false);
const shelf = ref("toRead");
const savedBecause = ref("");

const added = computed(() => (addedId.value ? paperById.value.get(addedId.value) ?? null : null));
const duplicate = computed(() => (addedId.value ? null : checkDuplicate(props.candidate)));
const authors = computed(() => {
  const all = props.candidate.authors ?? [];
  const text = creatorsToText(all.slice(0, 6)).replace(/; /g, ", ");
  return all.length > 6 ? `${text}, +${all.length - 6} more` : text || "Unknown author";
});

async function add() {
  busy.value = true;
  try {
    const paper = await addPaper({ ...props.candidate, folderIds: [], readingStatus: shelf.value as Paper["readingStatus"], savedBecause: savedBecause.value });
    addedId.value = paper.id;
    emit("added", paper);
    // Grab the PDF straight away when there's somewhere to put it.
    if (session.profile.value?.driveRootFolderId && (paper.openAccessPdfUrl || paper.arxivId || paper.doi)) void savePdf();
  } catch (error) {
    toastError(error);
  } finally {
    busy.value = false;
  }
}

async function savePdf() {
  if (!added.value) return;
  pdfState.value = "saving";
  try {
    await grabPdf(added.value, (step) => (pdfStep.value = step));
    pdfState.value = "saved";
  } catch {
    pdfState.value = "failed";
  }
}

function open(id: string) {
  ui.addOpen = false;
  void router.push(`/paper/${id}`);
}
</script>

<template>
  <article class="candidate" :class="{ done: added }">
    <div class="body">
      <h3 class="title">{{ candidate.title }}</h3>
      <p class="meta">{{ authors }}</p>
      <p class="meta faint">
        <span v-if="candidate.type">{{ paperTypeLabels[candidate.type] }}</span>
        <span v-if="candidate.containerTitle"> · {{ candidate.containerTitle }}</span>
        <span v-if="candidate.issued?.year"> · {{ candidate.issued.year }}</span>
        <span v-if="citedBy"> · {{ citedBy.toLocaleString() }} citations</span>
        <span v-if="candidate.doi"> · DOI {{ candidate.doi }}</span>
        <span v-else-if="candidate.arxivId"> · arXiv {{ candidate.arxivId }}</span>
      </p>
      <p v-if="candidate.abstract" class="abstract" :class="{ clamp: !expanded }" @click="expanded = !expanded">{{ candidate.abstract }}</p>
      <p v-if="duplicate?.kind === 'probable'" class="notice small dup">
        This may already be in your library: “{{ duplicate.paper?.title }}”.
        <button class="link-btn" type="button" @click="open(duplicate.paper!.id)">Use existing</button>
      </p>
      <div v-if="!added && duplicate?.kind !== 'exact'" class="capture-intent">
        <label class="small">
          Shelf
          <select v-model="shelf" class="select sm">
            <option v-for="s in readingStatuses" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </label>
        <label class="small reason">
          Saved because
          <input v-model="savedBecause" class="input sm" placeholder="Useful for…" />
        </label>
      </div>
    </div>
    <div class="actions">
      <template v-if="added">
        <span class="chip accent"><AppIcon name="check" :size="12" /> Added</span>
        <button class="btn sm" type="button" @click="open(added.id)">Open</button>
        <span v-if="pdfState === 'saving'" class="faint small">{{ pdfStep }}</span>
        <template v-else-if="!added.pdf && session.profile.value?.driveRootFolderId">
          <span v-if="pdfState === 'failed'" class="faint small">No downloadable PDF</span>
          <button class="btn sm" type="button" @click="savePdf"><AppIcon name="download" :size="13" /> {{ pdfState === "failed" ? "Try again" : "Find PDF" }}</button>
        </template>
        <a v-if="candidate.openAccessPdfUrl && !added.pdf && pdfState !== 'saving'" class="small" :href="candidate.openAccessPdfUrl" target="_blank" rel="noopener">Open PDF <AppIcon name="external" :size="11" /></a>
        <span v-if="added.pdf" class="chip"><AppIcon name="pdf" :size="12" /> PDF in Drive</span>
      </template>
      <template v-else-if="duplicate?.kind === 'exact'">
        <span class="chip"><AppIcon name="check" :size="12" /> In library</span>
        <button class="btn sm" type="button" @click="open(duplicate.paper!.id)">Open</button>
      </template>
      <button v-else class="btn sm" :class="{ primary: duplicate?.kind !== 'probable' }" type="button" :disabled="busy" @click="add">
        <AppIcon name="plus" :size="13" /> {{ duplicate?.kind === "probable" ? "Add anyway" : "Add" }}
      </button>
      <span v-if="(candidate.openAccessPdfUrl || candidate.arxivId) && !added" class="faint small">Open-access PDF</span>
    </div>
  </article>
</template>

<style scoped>
.candidate {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border);
}

.candidate:last-child {
  border-bottom: 0;
}

.title {
  font-family: var(--font-serif);
  font-size: calc(15.5px * var(--text-scale));
  font-weight: 600;
  line-height: 1.35;
}

.meta {
  margin-top: 3px;
  font-size: calc(12.5px * var(--text-scale));
  color: var(--text-2);
}

.abstract {
  margin-top: 6px;
  font-family: var(--font-serif);
  font-size: calc(13.5px * var(--text-scale));
  line-height: 1.55;
  color: var(--text-2);
  cursor: pointer;
}

.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dup {
  margin-top: 8px;
  display: block;
}

.capture-intent {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.capture-intent label {
  display: grid;
  gap: 3px;
  color: var(--text-3);
}

.capture-intent .reason {
  flex: 1 1 220px;
}

.capture-intent .input.sm {
  width: 100%;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 112px;
}

.done .title {
  color: var(--text-2);
}

@media (max-width: 560px) {
  .candidate {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
}
</style>
