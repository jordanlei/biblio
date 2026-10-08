<script setup lang="ts">
import BrandMark from "../../../web/src/components/BrandMark.vue";
import { PRIVACY_URL, REPO_URL, SETUP_URL } from "../site";
</script>

<template>
  <footer class="foot">
    <BrandMark :size="18" /> Biblio · open source (MIT) · · <a :href="SETUP_URL">Setup tutorial</a> · <a :href="PRIVACY_URL">Privacy</a> · <a :href="REPO_URL">GitHub</a>
  </footer>
</template>

<style scoped>
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: calc(13px * var(--text-scale));
  text-align: center;
}

.foot a {
  color: var(--accent);
}
</style>
