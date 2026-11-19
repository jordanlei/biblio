<script setup lang="ts">
// The demos, embedded in the page: the features as a table of contents on the left and, on the
// right, the selected one's recording with its steps. The step being shown highlights as the video
// plays; clicking a step jumps there, and a finished video moves on to the next feature. Videos play
// only while the tour is on screen.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppIcon from "../../../web/src/components/AppIcon.vue";
import { chapters, type Step } from "../demos";
import { SETUP_URL } from "../site";

const CAPTURE_VERSION = "20261119b";
const base = import.meta.env.BASE_URL;
const root = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const index = ref(0);
const time = ref(0);
const visible = ref(false);
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
let observer: IntersectionObserver | null = null;

function go(at: number) {
  clearTimeout(advance);
  index.value = (at + chapters.length) % chapters.length;
  time.value = 0;
}
function seek(step: Step) {
  if (!video.value || step.at === undefined) return;
  video.value.currentTime = step.at;
  void video.value.play().catch(() => {});
}
function ended() {
  // Hold the last frame a moment, then move on.
  if (visible.value) advance = setTimeout(() => go(index.value + 1), 1500);
}
function play() {
  if (visible.value) void video.value?.play().catch(() => {});
  else video.value?.pause();
}
watch(index, async () => {
  await nextTick();
  play();
});
watch(visible, play, { flush: "post" });
// A link to a feature (#install, #organize, ...) selects it.
function fromHash() {
  const at = chapters.findIndex((c) => `#${c.id}` === location.hash);
  if (at >= 0) go(at);
}
onMounted(() => {
  fromHash();
  addEventListener("hashchange", fromHash);
  if (!("IntersectionObserver" in window)) return void (visible.value = true);
  observer = new IntersectionObserver(([entry]) => (visible.value = entry.isIntersecting), { threshold: 0.35 });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => {
  removeEventListener("hashchange", fromHash);
  clearTimeout(advance);
  observer?.disconnect();
});
</script>

<template>
  <div ref="root" class="tour">
    <nav class="toc" aria-label="Features">
      <ol>
        <li v-for="(c, i) in chapters" :key="c.id" :id="c.id">
          <button type="button" :class="{ on: i === index }" :aria-current="i === index ? 'step' : undefined" @click="go(i)">
            <span class="num">{{ i + 1 }}</span> {{ c.title }}
          </button>
        </li>
      </ol>
    </nav>

    <section class="stage" aria-live="polite">
      <header>
        <div>
          <h3 class="display">{{ chapter.title }}</h3>
          <p class="summary">{{ chapter.summary }}</p>
        </div>
        <div class="arrows">
          <button type="button" class="arrow" aria-label="Previous feature" @click="go(index - 1)"><AppIcon name="chevron-left" :size="18" /></button>
          <button type="button" class="arrow" aria-label="Next feature" @click="go(index + 1)"><AppIcon name="chevron-right" :size="18" /></button>
        </div>
      </header>

      <div v-if="chapter.video" class="screen">
        <video :key="chapter.id" ref="video" :src="visible || time ? `${base}landing/${chapter.video}.webm?v=${CAPTURE_VERSION}` : undefined"
          :poster="`${base}landing/${chapter.video}-poster.jpg?v=${CAPTURE_VERSION}`" muted playsinline preload="metadata"
          @timeupdate="time = ($event.target as HTMLVideoElement).currentTime" @ended="ended" @loadeddata="play" />
      </div>

      <ol class="steps" :class="{ timed: chapter.video }">
        <li v-for="(step, i) in chapter.steps" :key="i" :class="{ on: i === activeStep }">
          <button v-if="chapter.video" type="button" @click="seek(step)">{{ step.text }}</button>
          <span v-else>{{ step.text }}</span>
        </li>
      </ol>
      <p v-if="chapter.id === 'extension'" class="fine"><a :href="`${SETUP_URL}#another-device`">How to install the extension</a></p>
    </section>
  </div>
</template>

<style scoped>
.tour {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  height: min(680px, calc(100vh - 80px));
  min-height: 520px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.toc {
  padding: 22px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
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
  grid-template-rows: auto minmax(0, 1fr) auto auto;
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

.arrows {
  display: flex;
  gap: 4px;
}

.arrow {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
}

.arrow:hover {
  border-color: var(--accent);
  color: var(--accent);
}

header h3 {
  margin-top: 2px;
  font-size: calc(24px * var(--text-scale));
  line-height: 1.2;
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


@media (max-width: 760px) {
  .tour {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    height: auto;
  }

  .toc {
    padding: 10px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
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
