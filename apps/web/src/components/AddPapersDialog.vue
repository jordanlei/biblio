<script setup lang="ts">
import { parseBibtex, type PaperCandidate, type PaperType } from "@bibliograph/core";
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { addPaper, checkDuplicate, importPapers, paperTypeLabels, paperTypes, parseCreators } from "../services/library";
import { lookupIdentifier, parseIdentifier } from "../services/lookup";
import { toast, toastError, ui, type AddTab } from "../services/ui";
import AppIcon from "./AppIcon.vue";
import CandidateRow from "./CandidateRow.vue";
import PaperSearch from "./PaperSearch.vue";
import ModalDialog from "./ModalDialog.vue";

const emit = defineEmits<{ close: [] }>();
const router = useRouter();

const tabs: Array<{ id: AddTab; label: string }> = [
  { id: "search", label: "Search" },
  { id: "identifiers", label: "DOIs & arXiv IDs" },
  { id: "import", label: "Import .bib" },
  { id: "manual", label: "Enter manually" }
];

// --- Identifiers (bulk) ---
const idText = ref("");
const idResults = ref<Array<{ input: string; candidate?: PaperCandidate; error?: string }>>([]);
const resolving = ref(false);

async function resolveIdentifiers() {
  const lines = idText.value.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
  idResults.value = [];
  resolving.value = true;
  for (const input of lines) {
    const identifier = parseIdentifier(input);
    if (!identifier) {
      idResults.value.push({ input, error: "Not a DOI, arXiv ID, or PMID." });
      continue;
    }
    try {
      idResults.value.push({ input, candidate: await lookupIdentifier(identifier) });
    } catch (error) {
      idResults.value.push({ input, error: error instanceof Error ? error.message : "Lookup failed." });
    }
  }
  resolving.value = false;
}

const idAddable = computed(() => idResults.value.filter((r) => r.candidate && checkDuplicate(r.candidate).kind === "none"));

async function addAllIdentifiers() {
  const candidates = idAddable.value.map((r) => ({ ...r.candidate!, folderIds: [], readingStatus: "inbox" as const }));
  try {
    const created = await importPapers(candidates);
    toast(`Added ${created.length} paper${created.length === 1 ? "" : "s"}.`);
    idText.value = "";
    idResults.value = [];
  } catch (error) {
    toastError(error);
  }
}

// --- Import .bib ---
const bibText = ref("");
const bibName = ref("");
const skipProbable = ref(true);
const importKeywords = ref(false);
const importing = ref(false);
const dragOver = ref(false);

const parsed = computed(() => {
  if (!bibText.value.trim()) return null;
  const candidates = parseBibtex(bibText.value);
  const groups = { fresh: [] as PaperCandidate[], exact: [] as PaperCandidate[], probable: [] as PaperCandidate[] };
  for (const candidate of candidates) {
    const kind = checkDuplicate(candidate).kind;
    (kind === "none" ? groups.fresh : kind === "exact" ? groups.exact : groups.probable).push(candidate);
  }
  return { total: candidates.length, ...groups };
});

const parsedKeywordCount = computed(() => {
  if (!parsed.value) return 0;
  return [...parsed.value.fresh, ...parsed.value.probable].filter((candidate) => candidate.tags?.length).length;
});

async function readBibFile(file?: File | null) {
  if (!file) return;
  bibName.value = file.name;
  bibText.value = await file.text();
}

async function runImport() {
  if (!parsed.value) return;
  const chosen = [...parsed.value.fresh, ...(skipProbable.value ? [] : parsed.value.probable)];
  importing.value = true;
  try {
    const created = await importPapers(chosen.map((c) => ({ ...c, tags: importKeywords.value ? c.tags ?? [] : [], folderIds: [], readingStatus: "inbox" as const })));
    toast(`Imported ${created.length} paper${created.length === 1 ? "" : "s"}.`, {
      action: { label: "View", run: () => router.push({ path: "/library", query: { view: "recent" } }) }
    });
    emit("close");
  } catch (error) {
    toastError(error);
  } finally {
    importing.value = false;
  }
}

// --- Manual ---
const manual = reactive({ title: "", authors: "", year: "", type: "article" as PaperType, venue: "", doi: "", url: "", savedBecause: "" });

async function addManual() {
  if (!manual.title.trim()) return;
  try {
    const paper = await addPaper({
      title: manual.title,
      type: manual.type,
      authors: parseCreators(manual.authors),
      issued: manual.year ? { year: Number(manual.year) } : undefined,
      containerTitle: manual.venue || undefined,
      doi: manual.doi || undefined,
      url: manual.url || undefined,
      folderIds: [],
      readingStatus: "inbox",
      savedBecause: manual.savedBecause || undefined,
      source: "manual"
    });
    emit("close");
    await router.push(`/paper/${paper.id}`);
  } catch (error) {
    toastError(error);
  }
}

async function selectTab(tab: AddTab) {
  ui.addTab = tab;
  await nextTick();
  document.querySelector<HTMLElement>(".add-panel [data-autofocus]")?.focus();
}

onMounted(() => selectTab(ui.addTab));
</script>

<template>
  <ModalDialog title="Add papers" wide @close="emit('close')">
    <nav class="tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        type="button"
        class="tab"
        :class="{ active: ui.addTab === tab.id }"
        :aria-selected="ui.addTab === tab.id"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="ui.addTab === 'search'" class="add-panel">
      <PaperSearch />
      <p class="faint small">Have many already? <button class="link-btn" type="button" @click="selectTab('import')">Import a .bib file</button> from Zotero, Mendeley, or Overleaf.</p>
    </section>

    <section v-else-if="ui.addTab === 'identifiers'" class="add-panel">
      <label class="field">
        Paste DOIs, arXiv IDs, PMIDs, or links (one per line)
        <textarea v-model="idText" data-autofocus class="textarea mono" rows="5" placeholder="10.1038/nature14539&#10;https://arxiv.org/abs/1706.03762&#10;PMID 31452104" />
      </label>
      <div class="row">
        <button class="btn primary" type="button" :disabled="resolving || !idText.trim()" @click="resolveIdentifiers">{{ resolving ? "Looking up…" : "Look up" }}</button>
        <button v-if="idAddable.length > 1" class="btn" type="button" @click="addAllIdentifiers">Add all {{ idAddable.length }} new</button>
      </div>
      <div v-if="idResults.length" class="results">
        <template v-for="(r, i) in idResults" :key="i">
          <CandidateRow v-if="r.candidate" :candidate="r.candidate" />
          <p v-else class="notice error small"><span class="mono">{{ r.input }}</span> — {{ r.error }}</p>
        </template>
      </div>
    </section>

    <section v-else-if="ui.addTab === 'import'" class="add-panel">
      <label
        class="dropzone"
        :class="{ over: dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="dragOver = false; readBibFile($event.dataTransfer?.files[0])"
      >
        <AppIcon name="upload" :size="22" />
        <strong>{{ bibName || "Drop a .bib file here, or click to choose" }}</strong>
        <span class="faint small">Export from Zotero (Better BibTeX keeps your citation keys), Mendeley, JabRef, or Overleaf.</span>
        <input class="sr-only" type="file" accept=".bib,.bibtex,.txt,text/plain,application/x-bibtex" data-autofocus @change="readBibFile(($event.target as HTMLInputElement).files?.[0])" />
      </label>
      <details class="paste">
        <summary class="small muted">…or paste BibTeX</summary>
        <textarea v-model="bibText" class="textarea mono" rows="6" placeholder="@article{key, title = {…}, …}" />
      </details>
      <div v-if="parsed" class="preview card">
        <p class="display" style="font-size: calc(18px * var(--text-scale))">{{ parsed.total }} entr{{ parsed.total === 1 ? "y" : "ies" }} found</p>
        <ul class="stats">
          <li><strong>{{ parsed.fresh.length }}</strong> new</li>
          <li><strong>{{ parsed.exact.length }}</strong> already in your library (skipped)</li>
          <li v-if="parsed.probable.length">
            <strong>{{ parsed.probable.length }}</strong> possible duplicates —
            <label class="inline"><input v-model="skipProbable" type="checkbox" /> skip them</label>
          </li>
        </ul>
        <p class="faint small">Citation keys from the file are kept; clashes get a letter suffix. PDFs aren't imported — attach them to papers later.</p>
        <label v-if="parsedKeywordCount" class="inline option">
          <input v-model="importKeywords" type="checkbox" />
          Import BibTeX keywords as tags for {{ parsedKeywordCount }} {{ parsedKeywordCount === 1 ? "entry" : "entries" }}
        </label>
        <p v-if="parsedKeywordCount" class="faint small">Off by default so tags stay intentional; you can add tags after import from each paper.</p>
        <button class="btn primary" type="button" :disabled="importing || !(parsed.fresh.length + (skipProbable ? 0 : parsed.probable.length))" @click="runImport">
          {{ importing ? "Importing…" : `Import ${parsed.fresh.length + (skipProbable ? 0 : parsed.probable.length)} papers` }}
        </button>
      </div>
    </section>

    <section v-else class="add-panel">
      <p class="notice ok small">Tip: pasting a DOI or arXiv link into <button class="link-btn" type="button" @click="selectTab('search')">Search</button> fills all of this in for you.</p>
      <form class="manual" @submit.prevent="addManual">
        <label class="field">Title <input v-model="manual.title" data-autofocus class="input" required /></label>
        <label class="field">Authors <input v-model="manual.authors" class="input" placeholder="Ada Lovelace; Hopper, Grace" /></label>
        <div class="field-row">
          <label class="field">Year <input v-model="manual.year" class="input" inputmode="numeric" /></label>
          <label class="field">Type
            <select v-model="manual.type" class="select">
              <option v-for="t in paperTypes" :key="t" :value="t">{{ paperTypeLabels[t] }}</option>
            </select>
          </label>
        </div>
        <label class="field">Journal / venue <input v-model="manual.venue" class="input" /></label>
        <div class="field-row">
          <label class="field">DOI <input v-model="manual.doi" class="input" /></label>
          <label class="field">URL <input v-model="manual.url" class="input" /></label>
        </div>
        <label class="field">Saved because <input v-model="manual.savedBecause" class="input" placeholder="Useful for…" /></label>
        <div><button class="btn primary" type="submit" :disabled="!manual.title.trim()">Add paper</button></div>
      </form>
    </section>
  </ModalDialog>
</template>

<style scoped>
.target {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
}

.target .select {
  width: auto;
  max-width: 200px;
  height: 30px;
}

.tabs {
  display: flex;
  gap: 2px;
  margin: 0 -18px 16px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tab {
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-2);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.tab.active {
  border-bottom-color: var(--accent);
  color: var(--text);
}

.add-panel {
  display: grid;
  gap: 12px;
  min-height: 300px;
  align-content: start;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-box {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-3);
}

.search-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.bare {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: none;
  font-size: calc(15px * var(--text-scale));
  color: var(--text);
}

.search-row .btn {
  height: 40px;
}

.results {
  display: grid;
  max-height: 56vh;
  overflow-y: auto;
}

.hints {
  display: grid;
  gap: 8px;
  padding: 8px 2px;
  color: var(--text-2);
  font-size: calc(13.5px * var(--text-scale));
}

.hints ul {
  display: grid;
  gap: 4px;
  padding-left: 18px;
}

code {
  font-family: var(--font-mono);
  font-size: 0.86em;
}

.dropzone {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 32px 16px;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  color: var(--text-2);
  text-align: center;
  cursor: pointer;
}

.dropzone.over,
.dropzone:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.paste summary {
  cursor: pointer;
}

.paste .textarea {
  margin-top: 8px;
}

.preview {
  display: grid;
  gap: 10px;
  justify-items: start;
  padding: 16px;
}

.stats {
  display: grid;
  gap: 4px;
  padding-left: 18px;
}

.inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.manual {
  display: grid;
  gap: 12px;
}
</style>
