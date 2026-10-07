<script setup lang="ts">
import { ref, watch } from "vue";
import { confirmState } from "../services/ui";
import ModalDialog from "./ModalDialog.vue";

const option = ref(false);
watch(
  () => confirmState.request,
  (request) => (option.value = request?.option?.checked ?? false)
);

function answer(confirmed: boolean) {
  confirmState.request?.resolve({ confirmed, option: option.value });
}
</script>

<template>
  <ModalDialog v-if="confirmState.request" :title="confirmState.request.title" @close="answer(false)">
    <form id="confirm-form" class="body" @submit.prevent="answer(true)">
      <p>{{ confirmState.request.message }}</p>
      <label v-if="confirmState.request.option" class="option">
        <input v-model="option" type="checkbox" />
        <span>{{ confirmState.request.option.label }}</span>
      </label>
    </form>
    <template #foot>
      <button class="btn quiet" type="button" @click="answer(false)">Cancel</button>
      <button class="btn" :class="confirmState.request.danger ? 'danger solid' : 'primary'" type="submit" form="confirm-form" autofocus>
        {{ confirmState.request.confirmLabel }}
      </button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.body {
  display: grid;
  gap: 14px;
  color: var(--text-2);
  line-height: 1.55;
}

.option {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  cursor: pointer;
}

.option input {
  margin-top: 3px;
  accent-color: var(--danger);
}
</style>
