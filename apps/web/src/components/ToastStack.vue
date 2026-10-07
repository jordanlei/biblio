<script setup lang="ts">
import { dismissToast, ui } from "../services/ui";
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.tone">
      <span>{{ t.text }}</span>
      <button v-if="t.action" type="button" @click="t.action.run(); dismissToast(t.id)">{{ t.action.label }}</button>
    </div>
  </div>
</template>
