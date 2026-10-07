<script setup lang="ts">
import { paperToBibtex } from "@bibliograph/core";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import BacklinkList from "../components/BacklinkList.vue";
import EditDetailsDialog from "../components/EditDetailsDialog.vue";
import NotesEditor from "../components/NotesEditor.vue";
import PdfPanel from "../components/PdfPanel.vue";
import StatusControl from "../components/StatusControl.vue";
import TagEditor from "../components/TagEditor.vue";
import { creatorsToText, downloadBibtex, paperTypeLabels, updatePaper, useLibrary } from "../services/library";
import { askConfirm, copyText, isTypingTarget, toast, toastError, ui, undoAction } from "../services/ui";
import { deletePapersEverywhere } from "../services/deletion";

const route = useRoute();
const router = useRouter();
const { papers, paperById, loaded, backlinkContexts } = useLibrary();

const paper = computed(() => paperById.value.get(route.params.id as string) ?? null);
const editing = ref(false);
const moreOpen = ref(false);
const notes = ref<InstanceType<typeof NotesEditor> | null>(null);
const reason = ref("");

watch(
  () => paper.value?.id,
  async (id) => {
    if (id) ui.selectedId = id;
    reason.value = paper.value?.savedBecause ?? "";
    if (route.hash === "#notes") {
      await nextTick();
      document.getElementById("notes")?.scrollIntoView();
      notes.value?.focus();
    }
  },
  { immediate: true }
);

// Previous/next within the list the user came from (a deep link falls back to the whole library).
const listIds = computed(() =>
  ui.listIds.includes(route.params.id as string) ? ui.listIds : [...papers.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => p.id)
);
const position = computed(() => listIds.value.indexOf(route.params.id as string));
const prevId = computed(() => (position.value > 0 ? listIds.value[position.value - 1] : null));
const nextId = computed(() => (position.value >= 0 && position.value < listIds.value.length - 1 ? listIds.value[position.value + 1] : null));

const venue = computed(() => {
  const p = paper.value;
  if (!p) return "";
  return [p.containerTitle, p.volume && `vol. ${p.volume}${p.issue ? `(${p.issue})` : ""}`, p.pages && `pp. ${p.pages}`].filter(Boolean).join(", ");
});
const mentionedIn = computed(() => (paper.value ? (backlinkContexts.value.get(paper.value.citationKey) ?? []).filter((entry) => entry.sourceId !== paper.value!.id) : []));
const details = computed(() => {
  const p = paper.value;
  if (!p) return [];
  const rows: Array<[string, string | undefined]> = [
    ["Type", paperTypeLabels[p.type]],
    ["Published", p.issued?.year ? [p.issued.year, p.issued.month, p.issued.day].filter(Boolean).join("-") : undefined],
    ["Venue", p.containerTitle],
    ["Volume", p.volume],
    ["Issue", p.issue],
    ["Pages", p.pages],
    ["Publisher", [p.publisher, p.publisherPlace].filter(Boolean).join(", ") || undefined],
    ["Editors", p.editors?.length ? creatorsToText(p.editors) : undefined],
    ["DOI", p.doi],
    ["arXiv", p.arxivId],
    ["PMID", p.pmid],
    ["Added", new Date(p.createdAt).toLocaleDateString()],
    ["Source", p.source]
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
});

function go(id: string | null) {
  if (id) void router.push(`/paper/${id}`);
}

function onKey(event: KeyboardEvent) {
  if (isTypingTarget(event.target) || document.querySelector(".overlay") || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "[") go(prevId.value);
  else if (event.key === "]") go(nextId.value);
  else if (event.key === "Escape") void router.push(ui.listRoute);
  else if (event.key === "c" && paper.value) void copyText(`\\cite{${paper.value.citationKey}}`);
  else if (event.key === "e") editing.value = true;
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

function saveReason() {
  const target = paper.value;
  if (!target) return;
  const value = reason.value.trim();
  updatePaper(target.id, { savedBecause: value || undefined }, "Change saved reason").catch(toastError);
}

async function removePaper() {
  const target = paper.value;
  if (!target) return;
  const { confirmed } = await askConfirm({
    title: "Delete this paper?",
    message: `“${target.title}” will be removed from your library, and its PDF and notes moved to your Google Drive trash. You can undo this.`,
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) return;
  const fallback = nextId.value ?? prevId.value;
  try {
    // Leave the page first: once the record is gone this view has nothing to show.
    ui.selectedId = fallback;
    await router.push(ui.listRoute);
    await deletePapersEverywhere([target]);
    toast("Paper deleted.", { action: undoAction });
  } catch (error) {
    toastError(error, "Couldn't move the files to the Drive trash, so nothing was deleted.");
  }
}
</script>

<template>
  <div v-if="!loaded" class="page-loading faint">Loading…</div>
  <div v-else-if="!paper" class="empty-state">
    <h2>Paper not found</h2>
    <p>It may have been deleted.</p>
    <RouterLink class="btn" to="/library">Back to library</RouterLink>
  </div>
  <div v-else class="paper-page">
    <nav class="crumbs">
      <RouterLink class="btn quiet sm" :to="ui.listRoute"><AppIcon name="arrow-left" :size="14" /> {{ ui.listLabel }}</RouterLink>
      <template v-if="position >= 0">
        <span class="faint small tnum">{{ position + 1 }} of {{ listIds.length }}</span>
        <button class="btn quiet icon" type="button" :disabled="!prevId" title="Previous paper ( [ )" aria-label="Previous paper" @click="go(prevId)"><AppIcon name="chevron-left" /></button>
        <button class="btn quiet icon" type="button" :disabled="!nextId" title="Next paper ( ] )" aria-label="Next paper" @click="go(nextId)"><AppIcon name="chevron-right" /></button>
      </template>
      <span class="spacer" />
      <button class="btn sm" type="button" @click="copyText(`\\cite{${paper.citationKey}}`)"><AppIcon name="quote" :size="13" /> Copy \cite</button>
      <button class="btn sm" type="button" @click="editing = true"><AppIcon name="edit" :size="13" /> Edit details</button>
      <div class="more">
        <button class="btn quiet icon" type="button" aria-label="More actions" @click="moreOpen = !moreOpen"><AppIcon name="more" /></button>
        <div v-if="moreOpen" class="menu card" @mouseleave="moreOpen = false" @click="moreOpen = false">
          <button type="button" @click="copyText(paperToBibtex(paper), 'Copied BibTeX')"><AppIcon name="copy" :size="14" /> Copy BibTeX</button>
          <button type="button" @click="downloadBibtex([paper], `${paper.citationKey}.bib`)"><AppIcon name="download" :size="14" /> Export BibTeX</button>
          <button type="button" class="danger" @click="removePaper"><AppIcon name="trash" :size="14" /> Delete paper…</button>
        </div>
      </div>
    </nav>

    <div class="cols">
      <article class="main">
        <button class="key-eyebrow mono" type="button" title="Copy \cite{…}" @click="copyText(`\\cite{${paper.citationKey}}`)">{{ paper.citationKey }}</button>
        <p class="eyebrow">{{ paperTypeLabels[paper.type] }}<template v-if="paper.issued?.year"> · {{ paper.issued.year }}</template></p>
        <h1 class="display title">{{ paper.title }}</h1>
        <p class="authors">{{ creatorsToText(paper.authors).replace(/; /g, ", ") || "Unknown author" }}</p>
        <p v-if="venue" class="venue">{{ venue }}</p>
        <div class="ids">
          <a v-if="paper.doi" class="chip" :href="`https://doi.org/${paper.doi}`" target="_blank" rel="noopener">doi.org/{{ paper.doi }} <AppIcon name="external" :size="11" /></a>
          <a v-if="paper.arxivId" class="chip" :href="`https://arxiv.org/abs/${paper.arxivId}`" target="_blank" rel="noopener">arXiv:{{ paper.arxivId }} <AppIcon name="external" :size="11" /></a>
          <a v-if="paper.pmid" class="chip" :href="`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}`" target="_blank" rel="noopener">PMID {{ paper.pmid }} <AppIcon name="external" :size="11" /></a>
          <a v-if="paper.url" class="chip" :href="paper.url" target="_blank" rel="noopener">Web page <AppIcon name="external" :size="11" /></a>
        </div>

        <section v-if="paper.abstract" class="section">
          <h2 class="section-label">Abstract</h2>
          <p class="abstract">{{ paper.abstract }}</p>
        </section>

        <section id="notes" class="section">
          <h2 class="section-label">Notes</h2>
          <NotesEditor ref="notes" :key="paper.id" :paper="paper" />
        </section>

        <section v-if="mentionedIn.length" class="section">
          <h2 class="section-label">Mentioned in notes</h2>
          <BacklinkList :paper="paper" />
        </section>
      </article>

      <aside class="side">
        <section class="card pad">
          <h2 class="section-label">Reading</h2>
          <StatusControl :paper="paper" />
        </section>

        <section class="card pad">
          <h2 class="section-label">Saved because</h2>
          <input v-model="reason" class="input" placeholder="Useful for…" @change="saveReason" @blur="saveReason" />
        </section>

        <section class="card pad">
          <h2 class="section-label">PDF</h2>
          <PdfPanel :paper="paper" />
        </section>

        <section class="card pad">
          <h2 class="section-label">Cite</h2>
          <button class="btn sm quiet" type="button" @click="copyText(paperToBibtex(paper), 'Copied BibTeX')"><AppIcon name="copy" :size="13" /> BibTeX</button>
          <p class="faint small" style="margin-top: 6px">Stable cite key — editing details won't change it.</p>
        </section>

        <section class="card pad">
          <h2 class="section-label">Tags</h2>
          <TagEditor :paper="paper" />
        </section>

        <section class="card pad">
          <div class="row"><h2 class="section-label">Details</h2><span class="spacer" /><button class="link-btn small" type="button" @click="editing = true">Edit</button></div>
          <dl class="details">
            <template v-for="[label, value] in details" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </template>
          </dl>
        </section>
      </aside>
    </div>

    <EditDetailsDialog v-if="editing" :paper="paper" @close="editing = false" />
  </div>
</template>

<style scoped>
.page-loading {
  padding: 40px;
}

.paper-page {
  padding: 14px 28px 64px;
}

.crumbs {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -14px -28px 0;
  padding: 10px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.crumbs > .btn:first-child {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more {
  position: relative;
}

.menu {
  position: absolute;
  z-index: 10;
  top: 34px;
  right: 0;
  display: grid;
  min-width: 190px;
  padding: 4px;
  box-shadow: var(--shadow);
}

.menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  background: none;
  font-size: calc(13px * var(--text-scale));
  text-align: left;
  cursor: pointer;
}

.menu button:hover {
  background: var(--surface-2);
}

.menu .danger {
  color: var(--danger);
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(260px, 320px);
  gap: 48px;
  justify-content: center;
  margin-top: 28px;
}

.title {
  margin-top: 8px;
  font-size: calc(clamp(26px, 3vw, 34px) * var(--text-scale));
}

.authors {
  margin-top: 12px;
  font-size: calc(15px * var(--text-scale));
}

.venue {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--text-2);
}

.ids {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.ids .chip {
  text-decoration: none;
}

.section {
  margin-top: 32px;
}

.abstract {
  font-family: var(--font-serif);
  font-size: calc(16px * var(--text-scale));
  line-height: 1.75;
}


.side {
  display: grid;
  gap: 12px;
  align-content: start;
}

.pad {
  padding: 14px 16px;
}

.key-eyebrow {
  display: inline-flex;
  align-items: center;
  width: 100%;
  max-width: 100%;
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

.details {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 5px 12px;
  margin: 0;
  font-size: calc(12.5px * var(--text-scale));
}

.details dt {
  color: var(--text-3);
}

.details dd {
  margin: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }

  .side {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}

@media (max-width: 820px) {
  .paper-page {
    padding: 0 16px 48px;
  }

  .crumbs {
    top: 52px;
    margin: 0 -16px;
    padding: 8px 16px;
    flex-wrap: wrap;
  }
}
</style>
