<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ title: string; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const root = ref<HTMLElement | null>(null);

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  const el = root.value;
  (el?.querySelector<HTMLElement>("[autofocus]") ?? el?.querySelector<HTMLElement>("input, textarea, select, button.primary"))?.focus();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="emit('close')">
    <section ref="root" class="modal" :class="{ wide: props.wide }" role="dialog" aria-modal="true" :aria-label="props.title">
      <header class="modal-head">
        <h2>{{ props.title }}</h2>
        <span class="spacer" />
        <slot name="head" />
        <button class="btn quiet icon" type="button" aria-label="Close" @click="emit('close')"><AppIcon name="x" /></button>
      </header>
      <div class="modal-body"><slot /></div>
      <footer v-if="$slots.foot" class="modal-foot"><slot name="foot" /></footer>
    </section>
  </div>
</template>
