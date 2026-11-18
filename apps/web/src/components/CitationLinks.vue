<script setup lang="ts">
import type { Paper } from "@biblio/core";
import { computed, onMounted, watch } from "vue";
import { RouterLink } from "vue-router";
import { citationInfo, citationsFailed, citationsLoading, refreshCitations } from "../services/library/citations";
import { shortAuthors, useLibrary } from "../services/library/library";

// "Citations": which papers in the library this one cites, and which cite it (OpenAlex).
const props = defineProps<{ paper: Paper }>();
const { papers } = useLibrary();
const info = computed(() => citationInfo(props.paper));

onMounted(() => void refreshCitations());
// New papers added while open get looked up too.
watch(() => papers.value.length, () => void refreshCitations());

const count = (n: number) => n.toLocaleString();
</script>

<template>
  <div class="citations">
    <p v-if="info.state === 'none' || info.state === 'unknown'" class="faint small">
      {{ info.state === "none" ? "Not enough to look this paper up by." : "Not in OpenAlex, by DOI or by title." }}
      Look elsewhere:
      <a :href="`https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`" target="_blank" rel="noopener">Google Scholar</a> ·
      <a :href="`https://www.semanticscholar.org/search?q=${encodeURIComponent(paper.title)}`" target="_blank" rel="noopener">Semantic Scholar</a>
    </p>
    <p v-else-if="info.state === 'pending'" class="faint small">{{ citationsFailed ? "Couldn't reach OpenAlex; will retry." : citationsLoading ? "Looking up citations…" : "Not looked up yet." }}</p>
    <template v-else>
      <div v-for="list in [{ label: 'Cites', papers: info.cites }, { label: 'Cited by', papers: info.citedBy }]" :key="list.label" class="list">
        <p class="small muted">{{ list.label }} <span class="tnum">{{ list.papers.length }}</span> in your library</p>
        <ul v-if="list.papers.length">
          <li v-for="p in list.papers" :key="p.id">
            <RouterLink :to="`/paper/${p.id}`" class="title">{{ p.title }}</RouterLink>
            <span class="faint small"> — {{ shortAuthors(p.authors) }}<template v-if="p.issued?.year">, {{ p.issued.year }}</template></span>
          </li>
        </ul>
      </div>
      <p class="faint small">Cites {{ count(info.referenceCount) }} works · cited by {{ count(info.citedByCount) }} · OpenAlex</p>
    </template>
  </div>
</template>

<style scoped>
.citations {
  display: grid;
  gap: 10px;
}

.list ul {
  display: grid;
  gap: 6px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.title {
  color: var(--text);
}
</style>
