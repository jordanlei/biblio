<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true" class="brand-mark">
    <rect width="32" height="32" rx="7" fill="#1d5a48" />
    <path d="M10 8h7.5a4.5 4.5 0 0 1 1.7 8.7A4.8 4.8 0 0 1 17.8 24H10z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" />
    <path d="M10 16h7.6" stroke="#fff" stroke-width="2.4" />
  </svg>
</template>

<style scoped>
.brand-mark {
  flex: none;
}
</style>
