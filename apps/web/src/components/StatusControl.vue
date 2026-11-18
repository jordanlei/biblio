<script setup lang="ts">
import type { Paper } from "@biblio/core";
import { updatePaper } from "../services/library/library";
import { shelfOf, shelfPatch, shelves, type Shelf } from "../services/library/scope";
import { toastError } from "../services/ui";

// Inbox / Skim / Read. Clicking the current one unmarks the paper (the default: kept for reference).
const props = defineProps<{ paper: Paper }>();

function set(shelf: Shelf) {
  updatePaper(props.paper.id, shelfPatch(shelfOf(props.paper) === shelf ? undefined : shelf), "Change reading status").catch(toastError);
}
</script>

<template>
  <div class="status" role="group" aria-label="Reading status">
    <button
      v-for="s in shelves"
      :key="s.id"
      type="button"
      :class="[s.id, { on: shelfOf(paper) === s.id }]"
      :aria-pressed="shelfOf(paper) === s.id"
      :title="`${s.label} (${s.key})`"
      @click="set(s.id)"
    >
      {{ s.label }}
    </button>
  </div>
</template>

<style scoped>
.status {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.status button {
  height: 24px;
  padding: 0 11px;
  border: 0;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--text-2);
  font-size: calc(12px * var(--text-scale));
  font-weight: 500;
  cursor: pointer;
}

.status button:hover {
  color: var(--text);
}

.status button.on {
  background: var(--accent);
  color: var(--accent-text);
}
</style>
