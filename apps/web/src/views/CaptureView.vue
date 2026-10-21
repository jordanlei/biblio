<script setup lang="ts">
import type { CapturedPaper, DuplicateResult, Paper, PaperCandidate } from "@biblio/core";
import { decodeCaptureHash, normalizeArxivId } from "@biblio/core";
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import { grabPdf } from "../services/drive";
import { addPaper, checkDuplicate, parseCreators, shortAuthors, useLibrary } from "../services/library";
import { useSession } from "../services/session";

// Landing page for the browser extension's "Save to Biblio". The extension passes the page's
// metadata in the URL hash (never sent to a server); this signed-in page saves it and fetches the PDF.


const route = useRoute();
const session = useSession();
const { loaded, folders, paperById } = useLibrary();

const captured = ref<CapturedPaper | null>(null);
const error = ref("");
const phase = ref<"waiting" | "duplicate" | "probable" | "saving" | "saved">("waiting");
const duplicate = ref<DuplicateResult | null>(null);
const paperId = ref<string | null>(null);
const pdf = ref<{ state: "idle" | "working" | "done" | "failed" | "skipped"; message: string }>({ state: "idle", message: "" });
const selectedCollectionId = ref("");

const paper = computed<Paper | null>(() => (paperId.value ? paperById.value.get(paperId.value) ?? null : null));

function toCandidate(c: CapturedPaper): PaperCandidate {
  const arxivId = normalizeArxivId(c.arxivId || undefined);
  return {
    title: c.title,
    type: arxivId && !c.venue ? "preprint" : c.venue ? "article" : "other",
    authors: parseCreators(c.authors.join("; ")),
    issued: c.year ? { year: c.year } : undefined,
    containerTitle: c.venue || undefined,
    volume: c.volume || undefined,
    issue: c.issue || undefined,
    pages: c.pages || undefined,
    publisher: c.publisher || undefined,
    doi: c.doi || undefined,
    arxivId,
    pmid: c.pmid || undefined,
    abstract: c.abstract || undefined,
    url: c.url,
    openAccessPdfUrl: c.pdfUrl || undefined,
    readingStatus: "toRead",
    source: "extension",
    folderIds: selectedCollectionId.value ? [selectedCollectionId.value] : []
  };
}

async function save() {
  if (!captured.value) return;
  phase.value = "saving";
  try {
    const created = await addPaper(toCandidate(captured.value));
    paperId.value = created.id;
    phase.value = "saved";
    await fetchPdf(created);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't save the paper.";
  }
}

async function fetchPdf(target: Paper) {
  if (target.pdf) return;
  if (!session.profile.value?.driveRootFolderId) {
    pdf.value = { state: "skipped", message: "Connect Google Drive in Settings to save PDFs." };
    return;
  }
  pdf.value = { state: "working", message: "Saving PDF to Drive…" };
  try {
    await grabPdf(target, (message) => (pdf.value = { state: "working", message }));
    pdf.value = { state: "done", message: "PDF saved to Drive" };
  } catch (e) {
    pdf.value = { state: "failed", message: e instanceof Error ? e.message : "Couldn't get the PDF." };
  }
}

/**
 * A capture from the extension is an intentional save action, so normal captures add themselves
 * after duplicate checking. Saving also tries to download the PDF, which is constrained by the
 * PDF fetcher's safe-destination checks.
 */
function start() {
  if (!captured.value || !loaded.value || phase.value !== "waiting") return;
  const candidate = toCandidate(captured.value);
  duplicate.value = checkDuplicate(candidate);
  if (duplicate.value.kind === "exact") {
    paperId.value = duplicate.value.paper!.id;
    phase.value = "duplicate";
  } else if (duplicate.value.kind === "probable") phase.value = "probable";
  else void save();
}

onMounted(() => {
  try {
    captured.value = decodeCaptureHash(route.hash);
    selectedCollectionId.value = captured.value.collectionId ?? "";
  } catch {
    error.value = "This link doesn't contain a paper. Use the Biblio extension's “Save” button on an article page.";
  }
});
watch([loaded, captured], () => {
  if (loaded.value && captured.value && !folders.value.length) start();
}, { immediate: true });
</script>

<template>
  <div class="capture">
    <p class="eyebrow">Save from the web</p>
    <p v-if="error" class="notice error">{{ error }}</p>

    <template v-if="captured">
      <h1 class="display">{{ captured.title }}</h1>
      <p class="muted">{{ [shortAuthors(parseCreators(captured.authors.join("; "))), captured.year, captured.venue].filter(Boolean).join(" · ") }}</p>

      <label v-if="phase === 'waiting' && folders.length" class="collection-picker">
        <span>Add to collection</span>
        <select v-model="selectedCollectionId" aria-label="Add to collection">
          <option value="">No collection</option>
          <option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option>
        </select>
      </label>
      <button v-if="phase === 'waiting' && folders.length" class="btn primary" type="button" @click="start">Add to library</button>

      <ol class="steps">
        <li v-if="phase === 'waiting'"><span class="spinner" /> Checking your library…</li>

        <template v-else-if="phase === 'duplicate'">
          <li class="ok"><AppIcon name="check" /> Already in your library</li>
          <li v-if="pdf.state !== 'idle'" :class="pdf.state">
            <span v-if="pdf.state === 'working'" class="spinner" /><AppIcon v-else :name="pdf.state === 'done' ? 'check' : 'pdf-missing'" /> {{ pdf.message }}
          </li>
        </template>

        <template v-else-if="phase === 'probable'">
          <li>
            This may already be in your library as “{{ duplicate?.paper?.title }}”.
            <div class="row" style="margin-top: 10px">
              <RouterLink class="btn" :to="`/paper/${duplicate?.paper?.id}`">Use existing</RouterLink>
              <button class="btn primary" type="button" @click="save">Add anyway</button>
            </div>
          </li>
        </template>

        <template v-else>
          <li :class="paper ? 'ok' : ''"><span v-if="!paper" class="spinner" /><AppIcon v-else name="check" /> {{ paper ? "Saved to your library" : "Adding to your library…" }}</li>
          <li v-if="pdf.state !== 'idle'" :class="pdf.state">
            <span v-if="pdf.state === 'working'" class="spinner" /><AppIcon v-else :name="pdf.state === 'done' ? 'check' : 'pdf-missing'" /> {{ pdf.message }}
          </li>
        </template>
      </ol>

      <div v-if="paper" class="row">
        <RouterLink class="btn primary" :to="`/paper/${paper.id}`">Open paper</RouterLink>
        <button v-if="phase === 'duplicate' && !paper.pdf && pdf.state === 'idle'" class="btn" type="button" @click="fetchPdf(paper)">Save PDF to Drive</button>
        <RouterLink class="btn quiet" to="/library">Library</RouterLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.capture {
  display: grid;
  gap: 12px;
  width: min(640px, 100%);
  margin: 0 auto;
  padding: 72px 28px;
}

h1 {
  font-size: calc(28px * var(--text-scale));
}

.steps {
  display: grid;
  gap: 10px;
  margin: 12px 0;
  padding: 18px 20px;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.collection-picker {
  display: grid;
  gap: 6px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}

.collection-picker select {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.steps li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
}

.steps li.ok,
.steps li.done {
  color: var(--accent-ink);
}

.steps li.failed,
.steps li.skipped {
  color: var(--warn-ink);
}

.spinner {
  width: 14px;
  height: 14px;
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
</style>
