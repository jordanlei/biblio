<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// A capture that only downloads and plays while it's on screen; the poster stands in until then.
// width/height are the capture's CSS size, so the page reserves the right space before the poster loads.
const props = defineProps<{ name: string; label: string; width: number; height: number }>();

const base = import.meta.env.BASE_URL;
const el = ref<HTMLVideoElement | null>(null);
const src = ref<string | undefined>();
let observer: IntersectionObserver | null = null;

onMounted(() => {
  const video = el.value;
  if (!video) return;
  if (!("IntersectionObserver" in window)) {
    src.value = `${import.meta.env.BASE_URL}landing/${props.name}.webm`;
    return;
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        src.value ??= `${import.meta.env.BASE_URL}landing/${props.name}.webm`;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    },
    { rootMargin: "200px 0px", threshold: 0.25 }
  );
  observer.observe(video);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <video ref="el" :src="src" :poster="`${base}landing/${name}-poster.jpg`" :width="width" :height="height" muted loop playsinline preload="none" autoplay :aria-label="label" />
</template>
