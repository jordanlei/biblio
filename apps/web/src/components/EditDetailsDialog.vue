<script setup lang="ts">
import type { Paper, PaperType } from "@biblio/core";
import { normalizeArxivId, normalizeDoi } from "@biblio/core";
import { computed, reactive, ref } from "vue";
import { creatorsToText, paperTypeLabels, paperTypes, parseCreators, renameCitationKey, updatePaper, useLibrary } from "../services/library";
import { toast, toastError, undoAction } from "../services/ui";
import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{ paper: Paper }>();
const emit = defineEmits<{ close: [] }>();
const { paperByKey, backlinkContexts } = useLibrary();
const p = props.paper;

const form = reactive({
  title: p.title,
  authors: creatorsToText(p.authors),
  editors: creatorsToText(p.editors ?? []),
  type: p.type as PaperType,
  year: p.issued?.year ? String(p.issued.year) : "",
  month: p.issued?.month ? String(p.issued.month) : "",
  containerTitle: p.containerTitle ?? "",
  volume: p.volume ?? "",
  issue: p.issue ?? "",
  pages: p.pages ?? "",
  publisher: p.publisher ?? "",
  publisherPlace: p.publisherPlace ?? "",
  doi: p.doi ?? "",
  arxivId: p.arxivId ?? "",
  pmid: p.pmid ?? "",
  url: p.url ?? "",
  abstract: p.abstract ?? "",
  citationKey: p.citationKey
});
const saving = ref(false);

const keyError = computed(() => {
  const key = form.citationKey.trim();
  if (!key) return "A citation key is required.";
  if (!/^[A-Za-z0-9_.:-]+$/.test(key)) return "Use letters, digits, and _ . : - only.";
  const owner = paperByKey.value.get(key);
  if (owner && owner.id !== p.id) return `Already used by “${owner.title}”.`;
  return "";
});
// Notes (paper notes and research notes) that link this key.
const references = computed(() => new Set((backlinkContexts.value.get(p.citationKey) ?? []).map((entry) => entry.sourceId)).size);
const oldCite = `\\cite{${p.citationKey}}`;

const opt = (value: string) => value.trim() || undefined;

async function save() {
  if (!form.title.trim() || keyError.value) return;
  saving.value = true;
  try {
    const year = Number.parseInt(form.year, 10);
    const month = Number.parseInt(form.month, 10);
    await updatePaper(p.id, {
      title: form.title.trim(),
      authors: parseCreators(form.authors),
      editors: form.editors.trim() ? parseCreators(form.editors) : undefined,
      type: form.type,
      issued: Number.isFinite(year) ? { year, ...(Number.isFinite(month) ? { month } : {}) } : undefined,
      containerTitle: opt(form.containerTitle),
      volume: opt(form.volume),
      issue: opt(form.issue),
      pages: opt(form.pages),
      publisher: opt(form.publisher),
      publisherPlace: opt(form.publisherPlace),
      doi: normalizeDoi(form.doi),
      arxivId: normalizeArxivId(form.arxivId),
      pmid: opt(form.pmid),
      url: opt(form.url),
      abstract: opt(form.abstract)
    }, "Edit details");
    const newKey = form.citationKey.trim();
    if (newKey !== p.citationKey) {
      const update =
        references.value > 0 &&
        confirm(`This key is referenced by ${references.value} note${references.value === 1 ? "" : "s"}. Update those references to @[${newKey}]?`);
      await renameCitationKey(p, newKey, update);
    }
    toast("Details saved.", { action: undoAction });
    emit("close");
  } catch (error) {
    toastError(error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <ModalDialog title="Edit details" wide @close="emit('close')">
    <form id="edit-details" class="form" @submit.prevent="save">
      <label class="field">Title <textarea v-model="form.title" class="textarea serif" rows="2" required /></label>
      <label class="field">Authors <span class="faint">— separate with “;”. “Family, Given” or “Given Family”.</span>
        <input v-model="form.authors" class="input" />
      </label>
      <div class="field-row">
        <label class="field">Type
          <select v-model="form.type" class="select">
            <option v-for="t in paperTypes" :key="t" :value="t">{{ paperTypeLabels[t] }}</option>
          </select>
        </label>
        <label class="field">Year <input v-model="form.year" class="input" inputmode="numeric" /></label>
        <label class="field">Month <input v-model="form.month" class="input" inputmode="numeric" placeholder="1–12" /></label>
      </div>
      <label class="field">Journal / proceedings / book <input v-model="form.containerTitle" class="input" /></label>
      <div class="field-row">
        <label class="field">Volume <input v-model="form.volume" class="input" /></label>
        <label class="field">Issue <input v-model="form.issue" class="input" /></label>
        <label class="field">Pages <input v-model="form.pages" class="input" /></label>
      </div>
      <div class="field-row">
        <label class="field">Publisher <input v-model="form.publisher" class="input" /></label>
        <label class="field">Place <input v-model="form.publisherPlace" class="input" /></label>
      </div>
      <label class="field">Editors <input v-model="form.editors" class="input" /></label>
      <div class="field-row">
        <label class="field">DOI <input v-model="form.doi" class="input mono" /></label>
        <label class="field">arXiv <input v-model="form.arxivId" class="input mono" /></label>
        <label class="field">PMID <input v-model="form.pmid" class="input mono" /></label>
      </div>
      <label class="field">URL <input v-model="form.url" class="input" /></label>
      <label class="field">Abstract <textarea v-model="form.abstract" class="textarea serif" rows="5" /></label>
      <label class="field">Citation key
        <input v-model="form.citationKey" class="input mono" :aria-invalid="Boolean(keyError)" />
        <span v-if="keyError" class="err">{{ keyError }}</span>
        <span v-else-if="form.citationKey.trim() !== paper.citationKey" class="warn">
          Changing the key breaks existing <code>{{ oldCite }}</code> in your manuscripts<template v-if="references">, and {{ references }} note link{{ references === 1 ? "" : "s" }}</template>.
        </span>
        <span v-else class="faint">Keys never change automatically when you edit other details.</span>
      </label>
    </form>
    <template #foot>
      <button class="btn quiet" type="button" @click="emit('close')">Cancel</button>
      <button class="btn primary" type="submit" form="edit-details" :disabled="saving || !!keyError || !form.title.trim()">{{ saving ? "Saving…" : "Save" }}</button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.form {
  display: grid;
  gap: 12px;
}

.err {
  color: var(--danger);
}

.warn {
  color: var(--warn-ink);
}

code {
  font-family: var(--font-mono);
}
</style>
