<script setup lang="ts">
import { ref } from "vue";
import { importLibrary, readLibrarySource } from "../services/transfer";
import { askConfirm, toast, toastError } from "../services/ui";
import { useLibrary } from "../services/library";

// "Import a library": a .zip (from Download library, or Google Drive's own folder download) or an
// unzipped library folder. The files are copied into a new Drive folder this copy owns.
const props = defineProps<{ primary?: boolean }>();
const emit = defineEmits<{ imported: [] }>();
const { papers } = useLibrary();

const zipInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const progress = ref("");

async function onChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const chosen = [...(input.files ?? [])];
  input.value = "";
  if (!chosen.length) return;
  try {
    progress.value = "Reading…";
    const entries = await readLibrarySource(chosen);
    if (papers.value.length) {
      const { confirmed } = await askConfirm({
        title: "Switch to the imported library?",
        message: `Bibliograph will copy it into a new folder in your Drive and show it instead of your current ${papers.value.length} papers. Your current library folder stays in Drive, untouched.`,
        confirmLabel: "Import"
      });
      if (!confirmed) return;
    }
    const { papers: count, folderName } = await importLibrary(entries, (done, total) => (progress.value = `Copying to Drive… ${done} of ${total}`));
    toast(`Imported ${count} paper${count === 1 ? "" : "s"} into “${folderName}”.`);
    emit("imported");
  } catch (error) {
    toastError(error, "Couldn't import that library.");
  } finally {
    progress.value = "";
  }
}
</script>

<template>
  <span class="library-import">
    <button class="btn" :class="{ primary: props.primary }" type="button" :disabled="!!progress" @click="zipInput?.click()">
      {{ progress || "Import a library (.zip)" }}
    </button>
    <button v-if="!progress" class="link-btn small" type="button" @click="folderInput?.click()">or choose an unzipped folder</button>
    <input ref="zipInput" class="sr-only" type="file" accept=".zip,application/zip" multiple aria-label="Library .zip file" @change="onChosen" />
    <input ref="folderInput" class="sr-only" type="file" webkitdirectory aria-label="Library folder" @change="onChosen" />
  </span>
</template>

<style scoped>
.library-import {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
</style>
