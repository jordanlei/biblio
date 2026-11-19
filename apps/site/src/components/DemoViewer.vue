<script setup lang="ts">
// The demo viewer: a dialog with a table of contents on the left and, on the right, the chapter's
// recording with its steps. The step being shown highlights as the video plays; clicking a step
// jumps the video there, and a finished video moves on to the next chapter.
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import AppIcon from "../../../web/src/components/AppIcon.vue";
import { chapters, type Step } from "../demos";
import { SETUP_URL } from "../site";

const CAPTURE_VERSION = "20261119b";
const base = import.meta.env.BASE_URL;
const dialog = ref<HTMLDialogElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const index = ref(0);
const time = ref(0);
const chapter = computed(() => chapters[index.value]);
const activeStep = computed(() => {
  if (!chapter.value.video) return -1;
  let active = 0;
  chapter.value.steps.forEach((step, i) => {
    if ((step.at ?? 0) <= time.value + 0.05) active = i;
  });
  return active;
});
let advance: ReturnType<typeof setTimeout> | undefined;

function open(at = 0) {
  go(at);
  dialog.value?.showModal();
}
function go(at: number) {
  clearTimeout(advance);
  index.value = (at + chapters.length) % chapters.length;
  time.value = 0;
}
function stop() {
  clearTimeout(advance);
}
function seek(step: Step) {
  if (!video.value || step.at === undefined) return;
  video.value.currentTime = step.at;
  void video.value.play().catch(() => {});
}
function ended() {
  // Pause on the last frame a moment, then move on.
  advance = setTimeout(() => go(index.value + 1), 1500);
}
function onKey(event: KeyboardEvent) {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") go(index.value + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(index.value - 1);
  else return;
  event.preventDefault();
}
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close();
}
watch(index, async () => {
  await nextTick();
  void video.value?.play().catch(() => {});
});
onBeforeUnmount(() => clearTimeout(advance));

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="viewer" aria-label="Biblio demos" @click="onClick" @keydown="onKey" @close="stop">
    <nav class="toc" aria-label="Demos">
      <p class="eyebrow">Demos</p>
      <ol>
        <li v-for="(c, i) in chapters" :key="c.id">
          <button type="button" :class="{ on: i === index }" :aria-current="i === index ? 'step' : undefined" @click="go(i)">
            <span class="num">{{ i + 1 }}</span> {{ c.title }}
          </button>
        </li>
      </ol>
    </nav>

    <section class="stage">
      <header>
        <div>
          <p class="eyebrow">{{ index + 1 }} of {{ chapters.length }}</p>
          <h3 class="display">{{ chapter.title }}</h3>
          <p class="summary">{{ chapter.summary }}</p>
        </div>
        <button type="button" class="close" aria-label="Close" @click="dialog?.close()"><AppIcon name="x" :size="18" /></button>
      </header>

      <div v-if="chapter.video" class="screen">
        <video :key="chapter.id" ref="video" :src="`${base}landing/${chapter.video}.webm?v=${CAPTURE_VERSION}`"
          :poster="`${base}landing/${chapter.video}-poster.jpg?v=${CAPTURE_VERSION}`" muted playsinline autoplay
          @timeupdate="time = ($event.target as HTMLVideoElement).currentTime" @ended="ended" />
      </div>

      <ol class="steps" :class="{ timed: chapter.video }">
        <li v-for="(step, i) in chapter.steps" :key="i" :class="{ on: i === activeStep }">
          <button v-if="chapter.video" type="button" @click="seek(step)">{{ step.text }}</button>
          <span v-else>{{ step.text }}</span>
        </li>
      </ol>
      <p v-if="chapter.id === 'extension'" class="fine"><a :href="`${SETUP_URL}#another-device`">How to install the extension</a></p>

      <footer>
        <button type="button" class="btn" @click="go(index - 1)"><AppIcon name="chevron-left" :size="16" /> {{ chapters[(index + chapters.length - 1) % chapters.length].title }}</button>
        <button type="button" class="btn" @click="go(index + 1)">{{ chapters[(index + 1) % chapters.length].title }} <AppIcon name="chevron-right" :size="16" /></button>
      </footer>
    </section>
  </dialog>
</template>

<style scoped>
.viewer {
  width: min(1120px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 32px));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
}

.viewer[open] {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
}

.viewer::backdrop {
  background: rgba(24, 24, 27, 0.45);
}

.toc {
  padding: 22px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
}

.toc .eyebrow {
  padding: 0 10px 10px;
}

.toc ol {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc button {
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: calc(14.5px * var(--text-scale));
  text-align: left;
  cursor: pointer;
}

.toc button:hover {
  background: var(--surface-3);
}

.toc button.on {
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  box-shadow: var(--shadow-subtle);
}

.num {
  width: 1.2em;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto auto;
  gap: 14px;
  min-height: 0;
  padding: 20px 26px 22px;
  overflow-y: auto;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.summary {
  margin-top: 4px;
  color: var(--text-2);
  font-size: calc(15px * var(--text-scale));
}

header h3 {
  margin-top: 2px;
  font-size: calc(24px * var(--text-scale));
  line-height: 1.2;
}

.close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}

.close:hover {
  background: var(--surface-2);
}

.screen {
  display: grid;
  place-items: center;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
}

.screen video {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

.steps {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.steps li {
  display: flex;
  gap: 10px;
  padding: 7px 10px;
  border-left: 3px solid transparent;
  border-radius: 0 6px 6px 0;
  color: var(--text-2);
  font-size: calc(15px * var(--text-scale));
  line-height: 1.5;
  counter-increment: step;
}

.steps li::before {
  content: counter(step);
  flex: none;
  width: 1.2em;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.steps.timed li.on {
  border-left-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}

.steps button {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fine a {
  color: var(--accent);
}

footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

@media (max-width: 760px) {
  .viewer[open] {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .toc {
    padding: 10px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .toc .eyebrow {
    display: none;
  }

  .toc ol {
    display: flex;
    overflow-x: auto;
  }

  .toc button {
    white-space: nowrap;
  }
}
</style>
