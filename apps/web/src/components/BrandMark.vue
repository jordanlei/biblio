<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true" class="brand-mark">
    <rect width="32" height="32" rx="7" fill="#1d5a48" />
    <!-- One stroke: stem, three bars, and two half-round bowls, the lower one wider. -->
    <path d="M10 15.5H15A3.75 3.75 0 0 0 15 8H10V24H17.5A4.25 4.25 0 0 0 17.5 15.5Z" fill="none" stroke="#fff" stroke-width="2.8" />
  </svg>
</template>

<style scoped>
.brand-mark {
  flex: none;
}
</style>
