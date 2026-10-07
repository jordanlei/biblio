<script setup lang="ts">
import type { Paper } from "@biblio/core";
import { ref, watch } from "vue";
import { attachPdf, connectDriveFolder, createDriveFolder, driveFileExists, driveOpenUrl, grabPdf, removePdf } from "../services/drive";
import { findPdfSources, type PdfSource } from "../services/pdfFetch";
import { useSession } from "../services/session";
import { askConfirm, toast, toastError, undoAction } from "../services/ui";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ paper: Paper }>();
const session = useSession();
const fileInput = ref<HTMLInputElement | null>(null);
const busy = ref("");
const over = ref(false);
const missing = ref(false);
const failure = ref("");
const sources = ref<PdfSource[]>([]);

watch(
  () => [props.paper.id, props.paper.pdf?.driveFileId] as const,
  async ([, fileId]) => {
    missing.value = false;
    failure.value = "";
    sources.value = [];
    if (fileId) missing.value = (await driveFileExists(fileId)) === false;
  },
  { immediate: true }
);

async function upload(file?: File | null) {
  if (!file) return;
  busy.value = "Uploading to Drive…";
  try {
    await attachPdf(props.paper, file);
    missing.value = false;
    failure.value = "";
    toast("PDF saved to your Drive.");
  } catch (error) {
    toastError(error);
  } finally {
    busy.value = "";
    if (fileInput.value) fileInput.value.value = "";
  }
}

async function find() {
  failure.value = "";
  try {
    const from = await grabPdf(props.paper, (step) => (busy.value = step));
    missing.value = false;
    toast(`PDF saved to your Drive (from ${from.label}).`);
  } catch (error) {
    failure.value = error instanceof Error ? error.message : "Couldn't get the PDF.";
    sources.value = await findPdfSources(props.paper).catch(() => []);
  } finally {
    busy.value = "";
  }
}

async function connectDrive() {
  busy.value = "Creating your Research Library folder…";
  try {
    await connectDriveFolder(await createDriveFolder());
  } catch (error) {
    toastError(error);
  } finally {
    busy.value = "";
  }
}

async function remove(skipConfirm = false) {
  if (!skipConfirm) {
    const { confirmed } = await askConfirm({
      title: "Remove this PDF?",
      message: "The PDF will be moved to your Google Drive trash. You can undo this.",
      confirmLabel: "Remove PDF",
      danger: true
    });
    if (!confirmed) return;
  }
  busy.value = "Removing…";
  try {
    await removePdf(props.paper);
    toast("PDF moved to your Drive trash.", { action: undoAction });
  } catch (error) {
    toastError(error, "Couldn't move the PDF to the Drive trash; nothing was changed.");
  } finally {
    busy.value = "";
  }
}

function onDrop(event: DragEvent) {
  over.value = false;
  void upload(event.dataTransfer?.files[0]);
}
</script>

<template>
  <div
    class="pdf"
    :class="{ over }"
    @dragover.prevent="over = Boolean($event.dataTransfer?.types.includes('Files'))"
    @dragleave="over = false"
    @drop.prevent="onDrop"
  >
    <input ref="fileInput" class="sr-only" type="file" accept="application/pdf,.pdf" @change="upload(($event.target as HTMLInputElement).files?.[0])" />

    <p v-if="busy" class="status"><span class="spinner" /> {{ busy }}</p>

    <template v-else-if="paper.pdf && missing">
      <p class="notice small"><AppIcon name="pdf-missing" /> <span>PDF unavailable — <strong>{{ paper.pdf.filename }}</strong> is no longer in Drive.</span></p>
      <div class="row wrap">
        <button class="btn sm primary" type="button" @click="find">Find it again</button>
        <button class="btn sm" type="button" @click="fileInput?.click()">Choose file…</button>
        <button class="btn sm quiet" type="button" @click="remove(true)">Forget it</button>
      </div>
    </template>

    <template v-else-if="paper.pdf">
      <div class="row wrap">
        <a class="btn primary" :href="driveOpenUrl(paper.pdf.driveFileId)" target="_blank" rel="noopener"><AppIcon name="pdf" /> Open PDF</a>
        <button class="btn sm quiet" type="button" @click="fileInput?.click()">Replace</button>
        <button class="btn sm quiet" type="button" @click="remove()">Remove…</button>
      </div>
      <p class="faint small file">{{ paper.pdf.filename }} · in Google Drive</p>
    </template>

    <template v-else-if="session.profile.value?.driveRootFolderId">
      <div class="row wrap">
        <button class="btn primary" type="button" @click="find"><AppIcon name="download" :size="15" /> Find PDF</button>
        <button class="btn quiet" type="button" @click="fileInput?.click()">Choose file…</button>
      </div>
      <div v-if="failure" class="failure">
        <p class="small">{{ failure }}</p>
        <ul v-if="sources.length" class="sources">
          <li v-for="s in sources" :key="s.url">
            <a :href="s.url" target="_blank" rel="noopener">Open at {{ s.label }} <AppIcon name="external" :size="11" /></a>
          </li>
        </ul>
      </div>
      <p class="drop-hint faint small"><AppIcon name="upload" :size="13" /> Or drop a PDF anywhere here.</p>
    </template>

    <template v-else>
      <p class="muted small">PDFs are saved to your Google Drive.</p>
      <button class="btn sm primary" type="button" @click="connectDrive"><AppIcon name="drive" :size="14" /> Connect Google Drive</button>
    </template>
  </div>
</template>

<style scoped>
.pdf {
  display: grid;
  gap: 8px;
  border-radius: var(--radius);
}

.pdf.over {
  outline: 2px dashed var(--accent);
  outline-offset: 4px;
  background: var(--accent-soft);
}

.drop-hint {
  display: flex;
  align-items: center;
  gap: 6px;
}

.failure {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--warn-soft);
  color: var(--warn-ink);
}

.sources {
  display: grid;
  gap: 3px;
  margin: 0;
  padding-left: 16px;
  font-size: calc(12.5px * var(--text-scale));
}

.file {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
  font-size: calc(13px * var(--text-scale));
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
