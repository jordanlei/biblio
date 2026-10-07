<script setup lang="ts">
import type { Paper, ReadingStatus } from "@biblio/core";
import { updatePaper } from "../services/library";
import { readingStatuses } from "../services/scope";
import { toastError } from "../services/ui";

const props = defineProps<{ paper: Paper }>();

function set(status: ReadingStatus) {
  const next = props.paper.readingStatus === status ? undefined : status;
  updatePaper(props.paper.id, { readingStatus: next }, "Change reading status").catch(toastError);
}
</script>

<template>
  <div class="status" role="group" aria-label="Reading status">
    <button
      v-for="s in readingStatuses"
      :key="s.id"
      type="button"
      :class="[s.id, { on: paper.readingStatus === s.id }]"
      :aria-pressed="paper.readingStatus === s.id"
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
