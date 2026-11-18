<script setup lang="ts">
import type { DuplicateGroup, Paper } from "@biblio/core";
import { reactive, ref } from "vue";
import { creatorsToText, paperTypeLabels } from "../services/library/library";
import { duplicateGroups, mergeInto } from "../services/library/merge";
import { toast, toastError } from "../services/ui";
import ModalDialog from "./ModalDialog.vue";

const emit = defineEmits<{ close: [] }>();

// Which record survives, per group (keyed by the first paper's id). Defaults to the suggested one.
const keepChoice = reactive<Record<string, string>>({});
const busy = ref<string | null>(null);

const groupId = (group: DuplicateGroup) => group.papers[0].id;
const keepOf = (group: DuplicateGroup) => keepChoice[groupId(group)] ?? group.papers[0].id;

function describe(paper: Paper) {
  const bits = [paperTypeLabels[paper.type], paper.issued?.year, paper.containerTitle, paper.doi ? `DOI ${paper.doi}` : paper.arxivId ? `arXiv ${paper.arxivId}` : undefined];
  return bits.filter(Boolean).join(" · ");
}

function extras(paper: Paper) {
  return [paper.pdf && "PDF", paper.notesMarkdown?.trim() && "notes", paper.tags.length && `${paper.tags.length} tag${paper.tags.length === 1 ? "" : "s"}`].filter(Boolean).join(", ");
}

async function merge(group: DuplicateGroup) {
  const keep = group.papers.find((p) => p.id === keepOf(group))!;
  const drops = group.papers.filter((p) => p.id !== keep.id);
  busy.value = groupId(group);
  try {
    await mergeInto(keep, drops);
    toast(`Merged into “${keep.title}”.`);
  } catch (error) {
    toastError(error);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <ModalDialog title="Duplicates" wide @close="emit('close')">
    <p v-if="!duplicateGroups.length" class="muted">No duplicates found. Papers that share a DOI, arXiv ID or PubMed ID, or a title and first author, show up here.</p>
    <template v-else>
      <p class="muted intro">
        Merging keeps one record and folds the others into it: empty fields, tags, folders, notes and shelf carry over, and every <code>@[key]</code> link points at the record you keep. The others are deleted; their note files go to Drive's trash.
      </p>
      <section v-for="group in duplicateGroups" :key="groupId(group)" class="group">
        <p class="eyebrow">{{ group.reason }}</p>
        <label v-for="paper in group.papers" :key="paper.id" class="choice" :class="{ on: keepOf(group) === paper.id }">
          <input v-model="keepChoice[groupId(group)]" type="radio" :name="groupId(group)" :value="paper.id" :checked="keepOf(group) === paper.id" />
          <span class="body">
            <span class="title">{{ paper.title }}</span>
            <span class="small muted">{{ creatorsToText(paper.authors.slice(0, 3)) }}</span>
            <span class="small faint">{{ describe(paper) }}<template v-if="extras(paper)"> · has {{ extras(paper) }}</template></span>
          </span>
          <span v-if="keepOf(group) === paper.id" class="chip accent">Keep</span>
        </label>
        <div class="row">
          <button class="btn sm primary" type="button" :disabled="busy !== null" @click="merge(group)">{{ busy === groupId(group) ? "Merging…" : `Merge ${group.papers.length} into one` }}</button>
        </div>
      </section>
    </template>
  </ModalDialog>
</template>

<style scoped>
.intro {
  max-width: 40rem;
  margin-bottom: 8px;
}

.group {
  display: grid;
  gap: 6px;
  padding: 14px 0;
  border-top: 1px solid var(--border);
}

.choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}

.choice.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.choice input {
  margin-top: 4px;
}

.body {
  display: grid;
  gap: 2px;
}

.title {
  font-weight: 600;
}
</style>
