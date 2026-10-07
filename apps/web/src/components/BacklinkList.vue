<script setup lang="ts">
import type { Paper } from "@bibliograph/core";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { shortAuthors, useLibrary } from "../services/library";
import { snippetText } from "../services/notes";

// "Mentioned in notes": every paper note and research note that links this paper, with the
// sentence or bullet around the link.
const props = defineProps<{ paper: Paper; compact?: boolean }>();
const { backlinkContexts, paperByKey } = useLibrary();

const entries = computed(() => (backlinkContexts.value.get(props.paper.citationKey) ?? []).filter((entry) => entry.sourceId !== props.paper.id));
</script>

<template>
  <ul v-if="entries.length" class="backlinks" :class="{ compact }">
    <li v-for="entry in entries" :key="`${entry.sourceId}:${entry.snippet}`">
      <template v-if="entry.source.kind === 'note'">
        <RouterLink :to="`/research-notes/${entry.source.note.id}`" class="title"><AppIcon name="note" :size="13" class="kind" /> {{ entry.source.note.title }}</RouterLink>
        <span class="faint small"> — research note</span>
      </template>
      <template v-else>
        <RouterLink :to="`/paper/${entry.source.paper.id}`" class="title">{{ entry.source.paper.title }}</RouterLink>
        <span class="faint small"> — {{ shortAuthors(entry.source.paper.authors) }}<template v-if="entry.source.paper.issued?.year">, {{ entry.source.paper.issued.year }}</template></span>
      </template>
      <p>{{ snippetText(entry.snippet, paperByKey) }}</p>
    </li>
  </ul>
</template>

<style scoped>
.backlinks {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.title {
  color: var(--text);
  font-family: var(--font-serif);
}

.kind {
  margin-bottom: -2px;
  color: var(--accent);
}

.backlinks p {
  margin-top: 3px;
  color: var(--text-2);
  font-size: calc(13.5px * var(--text-scale));
  line-height: 1.45;
}
</style>
