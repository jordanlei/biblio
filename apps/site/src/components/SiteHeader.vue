<script setup lang="ts">
import BrandMark from "../../../web/src/components/BrandMark.vue";
import { BASE, PRIVACY_URL, REPO_URL, SETUP_URL } from "../site";
</script>

<template>
  <header class="top">
    <a class="brand" :href="BASE"><BrandMark :size="30" /> Biblio</a>
    <span class="spacer" />
    <nav class="links">
      <a :href="`${BASE}#how-it-works`">How it works</a>
      <a :href="PRIVACY_URL">Privacy</a>
      <a :href="SETUP_URL">Setup tutorial</a>
      <a :href="REPO_URL">GitHub</a>
    </nav>
  </header>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 1160px;
  margin: 0 auto;
  padding: 22px 32px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-family: var(--font-serif);
  font-size: calc(20px * var(--text-scale));
  font-weight: 650;
  text-decoration: none;
}

.links {
  display: flex;
  gap: 20px;
  font-size: calc(14.5px * var(--text-scale));
}

.links a {
  color: var(--text-2);
  text-decoration: none;
}

.links a:hover {
  color: var(--text);
}

@media (max-width: 640px) {
  .top {
    padding: 16px;
  }

  .links a:first-child {
    display: none;
  }

  .links {
    gap: 14px;
  }
}
</style>
