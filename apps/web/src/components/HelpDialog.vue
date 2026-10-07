<script setup lang="ts">
import ModalDialog from "./ModalDialog.vue";

const emit = defineEmits<{ close: [] }>();

const shortcuts: Array<[string[], string]> = [
  [["⌘", "K"], "Jump to anything"],
  [["/"], "Search"],
  [["↑", "↓"], "Move through papers"],
  [["Enter"], "Open paper"],
  [["Space"], "Select for bulk actions"],
  [["1", "2", "3"], "To read · Skimming · Read"],
  [["⌫"], "Delete"],
  [["⌘", "Z"], "Undo"],
  [["A"], "Add papers"]
];
</script>

<template>
  <ModalDialog title="Keyboard shortcuts" @close="emit('close')">
    <div class="help">
      <dl class="keys">
        <template v-for="[keys, label] in shortcuts" :key="label">
          <dt><kbd v-for="k in keys" :key="k">{{ k }}</kbd></dt>
          <dd>{{ label }}</dd>
        </template>
      </dl>
      <div class="tips">
        <p>Type <code>@[</code> in notes to link another paper.</p>
        <p>Search with <code>author:</code>, <code>year:2015-2020</code>, or <code>#tag</code>.</p>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.help {
  display: grid;
  gap: 18px;
}

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 14px;
  align-items: center;
  margin: 0;
}

.keys dt {
  display: flex;
  gap: 3px;
}

.keys dd {
  margin: 0;
  color: var(--text-2);
}

.tips {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  font-size: calc(13.5px * var(--text-scale));
  color: var(--text-2);
}

.tips strong {
  color: var(--text);
}

code {
  font-family: var(--font-mono);
  font-size: 0.86em;
}

@media (max-width: 640px) {
  .help {
    grid-template-columns: 1fr;
  }
}
</style>
