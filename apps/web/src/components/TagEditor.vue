<script setup lang="ts">
import type { Paper } from "@biblio/core";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { setPaperTag, useLibrary } from "../services/library";
import { toastError } from "../services/ui";

const props = defineProps<{ paper: Paper }>();
const { tagCounts } = useLibrary();
const draft = ref("");
const listId = `tags-${Math.random().toString(36).slice(2)}`;
const suggestions = computed(() => tagCounts.value.map(([tag]) => tag).filter((tag) => !props.paper.tags.includes(tag)));

async function add() {
  const tags = draft.value.split(",").map((t) => t.trim()).filter(Boolean);
  draft.value = "";
  for (const tag of tags) await setPaperTag([props.paper.id], tag, true).catch(toastError);
}
</script>

<template>
  <div class="tag-list editor">
    <span v-for="tag in paper.tags" :key="tag" class="tag removable" :title="tag">
      <RouterLink class="tag-text" :to="{ path: '/library', query: { tag } }">{{ tag }}</RouterLink>
      <button type="button" :aria-label="`Remove tag ${tag}`" @click="setPaperTag([paper.id], tag, false)">×</button>
    </span>
    <input v-model="draft" class="tag-input" :list="listId" placeholder="+ tag" aria-label="Add tag" @keydown.enter.prevent="add" @blur="draft && add()" />
    <datalist :id="listId"><option v-for="s in suggestions" :key="s" :value="s" /></datalist>
  </div>
</template>

<style scoped>
.removable {
  padding-right: 2px;
}

.removable a {
  color: inherit;
  text-decoration: none;
}

.removable a:hover {
  color: var(--text);
}

.removable button {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-left: 2px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}

.removable button:hover {
  background: var(--surface-3);
  color: var(--text);
}

/* Fixed width: growing on focus would re-wrap the row and shift everything below it. */
.tag-input {
  width: 96px;
  height: calc(20px * var(--text-scale));
  padding: 0 6px;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  background: transparent;
  font-size: calc(11.5px * var(--text-scale));
}

.tag-input:focus {
  outline: none;
  border-style: solid;
  border-color: var(--accent);
}
</style>
