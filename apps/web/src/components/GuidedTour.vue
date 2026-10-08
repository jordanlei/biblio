<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { DEFAULT_FOLDER_NAME, connectDriveFolder, createDriveFolder, findOwnLibraries, type DriveFolderSelection, type OwnLibrary } from "../services/drive";
import { connectLibraryFolder } from "../sync/librarySync";
import { useLibrary } from "../services/library";
import { useSession } from "../services/session";
import { openAdd, toast as toastInfo, toastError } from "../services/ui";
import AppIcon from "./AppIcon.vue";
import LibraryImport from "./LibraryImport.vue";

// First-run tour: a spotlight on one part of the UI at a time, a pointer callout beside it, and Skip.
// Steps whose target isn't on screen are skipped automatically.

const emit = defineEmits<{ done: [] }>();
const session = useSession();
const { papers } = useLibrary();

interface Step {
  id: string;
  target?: string;
  title: string;
  body: string;
  when?: () => boolean;
}

const steps: Step[] = [
  {
    id: "welcome",
    title: "Welcome to Biblio",
    body: "A quick tour of where things are — about a minute. You can skip it and replay it from Settings."
  },
  {
    id: "drive",
    target: "drive",
    title: "First, choose where your library lives",
    body: "Your papers, notes, and PDFs are saved as ordinary files in a Google Drive folder you own — readable even without Biblio. Have a library already? Import its .zip, or the folder downloaded from Google Drive.",
    when: () => !session.profile.value?.driveRootFolderId
  },
  { id: "add", target: "add", title: "Add papers", body: "Search by topic, title, or author; paste DOIs or arXiv links; or import a .bib from Zotero or Mendeley. Shortcut: A." },
  { id: "search", target: "search", title: "Find anything in your library", body: "Search titles, authors, abstracts, and notes. Narrow with author:, year:2015-2020, or #tag." },
  { id: "filters", target: "filters", title: "Shelves and filters", body: "Move papers between To read, Skimming, and Read with 1, 2, 3, then filter by shelf, PDF, or notes. Anything more specific is a tag." },
  { id: "list", target: "list", title: "Move with the keyboard", body: "↑ ↓ select · Enter opens · Space checks for bulk actions · ⌫ deletes · ⌘Z undoes. Double-click notes in the preview to edit them." },
  { id: "tags", title: "Organize by tags", body: "Use tags for topics, projects, methods, and questions. A paper can sit in several constellations without being duplicated." },
  { id: "finish", title: "You're ready", body: "Start by bringing in the papers you already have." }
];

const index = ref(0);
const rect = ref<DOMRect | null>(null);
const busy = ref("");
const step = computed(() => steps[index.value]);
const isLast = computed(() => index.value === steps.length - 1);
const total = computed(() => steps.filter((s) => !s.when || s.when()).length);
const position = computed(() => steps.slice(0, index.value + 1).filter((s) => !s.when || s.when()).length);

function targetEl(s: Step) {
  return s.target ? document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`) : null;
}

function usable(i: number) {
  const s = steps[i];
  if (s.when && !s.when()) return false;
  if (!s.target) return true;
  const el = targetEl(s);
  return Boolean(el && el.getClientRects().length);
}

async function go(delta: number) {
  let next = index.value + delta;
  while (next > 0 && next < steps.length - 1 && !usable(next)) next += delta;
  if (next >= steps.length) return finish();
  index.value = Math.max(0, next);
  await nextTick();
  measure();
}

function measure() {
  const el = targetEl(step.value);
  if (!el) {
    rect.value = null;
    return;
  }
  el.scrollIntoView({ block: "nearest" });
  rect.value = el.getBoundingClientRect();
}

const PAD = 6;
const spot = computed(() => {
  const r = rect.value;
  if (!r) return null;
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
});

// Place the callout beside the target: right if there's room, else below, else above.
const callout = computed(() => {
  const s = spot.value;
  const width = 340;
  if (!s) return { style: { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: `${Math.min(width + 80, window.innerWidth - 32)}px` }, side: "none" };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (s.left + s.width + 16 + width < vw) {
    const left = `${s.left + s.width + 16}px`;
    // Targets low on the screen (e.g. the sidebar footer) anchor the callout's bottom so it never overflows.
    if (s.top + s.height / 2 > vh / 2) {
      const bottom = Math.max(16, vh - (s.top + s.height));
      const fromBottom = vh - (s.top + s.height / 2) - bottom - 7;
      return { style: { bottom: `${bottom}px`, left, width: `${width}px` }, side: "right", arrowBottom: Math.max(fromBottom, 14) };
    }
    const top = Math.max(16, s.top);
    return { style: { top: `${top}px`, left, width: `${width}px` }, side: "right", arrow: Math.min(Math.max(s.top + s.height / 2 - top - 7, 14), 220) };
  }
  const left = Math.min(Math.max(16, s.left), vw - width - 16);
  if (s.top + s.height + 16 + 220 < vh) {
    return { style: { top: `${s.top + s.height + 14}px`, left: `${left}px`, width: `${width}px` }, side: "below", arrow: Math.min(Math.max(s.left + 24 - left, 14), width - 24) };
  }
  return { style: { bottom: `${vh - s.top + 14}px`, left: `${left}px`, width: `${width}px` }, side: "above", arrow: Math.min(Math.max(s.left + 24 - left, 14), width - 24) };
});

async function createFolder() {
  busy.value = "create";
  try {
    await connectDriveFolder(await createDriveFolder(DEFAULT_FOLDER_NAME));
    await go(1);
  } catch (error) {
    toastError(error, "Couldn't create the Drive folder.");
  } finally {
    busy.value = "";
  }
}

// Libraries this copy made before (e.g. its index was reset): offered as "Reconnect". Checked
// quietly, without a sign-in popup; if there's no Drive token yet, the option just isn't shown.
const ownLibraries = ref<OwnLibrary[]>([]);
watch(
  () => step.value.id,
  async (id) => {
    if (id !== "drive" || ownLibraries.value.length) return;
    ownLibraries.value = await findOwnLibraries(false).catch(() => []);
  },
  { immediate: true }
);

async function reconnect(folder: DriveFolderSelection) {
  busy.value = "reconnect";
  try {
    const { loaded } = await connectLibraryFolder(folder, () => true);
    if (loaded !== null) toastInfo(`Loaded ${loaded} papers from “${folder.name}”.`);
    await go(1);
  } catch (error) {
    toastError(error, "Couldn't open that library.");
  } finally {
    busy.value = "";
  }
}

function finish(openImport = false) {
  emit("done");
  if (openImport) openAdd(papers.value.length ? "search" : "import");
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    finish();
  } else if (event.key === "ArrowRight" || event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (isLast.value) finish(true);
    else void go(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    event.stopPropagation();
    void go(-1);
  }
}

const remeasure = () => measure();
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", remeasure);
  window.addEventListener("scroll", remeasure, true);
  measure();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", remeasure);
  window.removeEventListener("scroll", remeasure, true);
});
watch(() => papers.value.length, () => nextTick(measure));
</script>

<template>
  <div class="tour" role="dialog" aria-modal="true" :aria-label="step.title">
    <div class="scrim" :class="{ dim: !spot }" />
    <div v-if="spot" class="spot" :style="{ top: `${spot.top}px`, left: `${spot.left}px`, width: `${spot.width}px`, height: `${spot.height}px` }" />

    <section class="callout" :class="`side-${callout.side}`" :style="callout.style">
      <span
        v-if="callout.side !== 'none'"
        class="arrow"
        :style="callout.side === 'right' ? ('arrowBottom' in callout ? { bottom: `${callout.arrowBottom}px` } : { top: `${callout.arrow}px` }) : { left: `${callout.arrow}px` }"
      />
      <p class="eyebrow">{{ position }} of {{ total }}</p>
      <h2>{{ step.title }}</h2>
      <p class="body">{{ step.body }}</p>

      <div v-if="step.id === 'drive'" class="actions">
        <button class="btn primary" type="button" :disabled="!!busy" @click="createFolder">
          <AppIcon name="folder-plus" /> {{ busy === "create" ? "Creating…" : `Create “${DEFAULT_FOLDER_NAME}”` }}
        </button>
        <button v-for="folder in ownLibraries" :key="folder.id" class="btn" type="button" :disabled="!!busy" @click="reconnect(folder)">
          Reconnect “{{ folder.name }}” <span class="faint">· {{ folder.papers }} paper{{ folder.papers === 1 ? "" : "s" }}</span>
        </button>
        <LibraryImport @imported="go(1)" />
      </div>

      <footer>
        <button class="link-btn skip" type="button" @click="finish()">Skip tour</button>
        <span class="spacer" />
        <button v-if="index > 0" class="btn quiet sm" type="button" @click="go(-1)">Back</button>
        <button v-if="isLast" class="btn primary sm" type="button" @click="finish(true)">{{ papers.length ? "Add papers" : "Import my papers" }}</button>
        <button v-else-if="step.id === 'drive'" class="btn sm" type="button" @click="go(1)">Later</button>
        <button v-else class="btn primary sm" type="button" @click="go(1)">{{ index === 0 ? "Start" : "Next" }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 70;
}

.scrim {
  position: absolute;
  inset: 0;
}

.scrim.dim {
  background: rgba(24, 18, 12, 0.5);
}

.spot {
  position: fixed;
  border-radius: 8px;
  box-shadow:
    0 0 0 2px var(--accent),
    0 0 0 9999px rgba(24, 18, 12, 0.5);
  pointer-events: none;
  transition: all 0.22s ease;
}

.callout {
  position: fixed;
  display: grid;
  gap: 8px;
  padding: 18px 20px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  transition:
    top 0.22s ease,
    left 0.22s ease;
}

.callout h2 {
  font-family: var(--font-serif);
  font-size: calc(20px * var(--text-scale));
  font-weight: 600;
  line-height: 1.25;
}

.body {
  color: var(--text-2);
  font-size: calc(14px * var(--text-scale));
  line-height: 1.55;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.skip {
  color: var(--text-3);
  font-weight: 400;
  font-size: calc(13px * var(--text-scale));
}

.arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  transform: rotate(45deg);
}

.side-right .arrow {
  left: -8px;
  border-top-color: transparent;
  border-right-color: transparent;
}

.side-below .arrow {
  top: -8px;
  border-right-color: transparent;
  border-bottom-color: transparent;
}

.side-above .arrow {
  bottom: -8px;
  border-top-color: transparent;
  border-left-color: transparent;
}
</style>
