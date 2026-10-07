<script setup lang="ts">
// One question. <details> gives us the open/close behaviour, keyboard support, and
// find-in-page for free; the marker is replaced with our own chevron.
defineProps<{ question: string }>();
</script>

<template>
  <details class="faq-item">
    <summary>
      <span>{{ question }}</span>
      <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </summary>
    <div class="answer"><slot /></div>
  </details>
</template>

<style scoped>
.faq-item {
  border-bottom: 1px solid var(--border);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  color: var(--text);
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 650;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary:hover {
  color: var(--accent);
}

.chev {
  flex: none;
  color: var(--text-3);
  transition: transform 0.15s ease;
}

[open] .chev {
  transform: rotate(180deg);
}

.answer {
  padding: 0 0 18px;
  max-width: 68ch;
  font-size: calc(15.5px * var(--text-scale));
  line-height: 1.6;
  color: var(--text-2);
}

.answer :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: 0.86em;
  color: var(--text);
}

.answer :deep(a) {
  color: var(--accent);
}
</style>
