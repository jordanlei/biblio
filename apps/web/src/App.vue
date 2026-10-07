<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppIcon from "./components/AppIcon.vue";
import AppSidebar from "./components/AppSidebar.vue";
import BrandMark from "./components/BrandMark.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import { lazyDialogs } from "./lazy";


import ToastStack from "./components/ToastStack.vue";
import { useLibrary } from "./services/library";
import { updateProfile, useSession } from "./services/session";
import { isTypingTarget, openAdd, runUndo, toastError, ui } from "./services/ui";

const AddPapersDialog = defineAsyncComponent(lazyDialogs.add);
const HelpDialog = defineAsyncComponent(lazyDialogs.help);
const GuidedTour = defineAsyncComponent(lazyDialogs.tour);
const CommandPalette = defineAsyncComponent(lazyDialogs.palette);

const route = useRoute();
const drawerOpen = ref(false);
const session = useSession();
const { loaded } = useLibrary();
const showTour = computed(
  () => route.path === "/library" && loaded.value && Boolean(session.profile.value) && !session.profile.value?.onboardingCompleted && !ui.addOpen
);

function endTour() {
  updateProfile({ onboardingCompleted: true }).catch(toastError);
}
watch(() => route.fullPath, () => (drawerOpen.value = false));

function onKey(event: KeyboardEvent) {
  if (route.meta.public) return;
  // ⌘K / Ctrl+K works everywhere, even while typing.
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    ui.paletteOpen = !ui.paletteOpen;
    return;
  }
  if (isTypingTarget(event.target)) return;
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z" && !document.querySelector(".overlay")) {
    event.preventDefault();
    void runUndo();
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (ui.addOpen || ui.helpOpen || document.querySelector(".overlay, .tour")) return;
  if (event.key === "a") {
    event.preventDefault();
    openAdd("search");
  } else if (event.key === "?") {
    event.preventDefault();
    ui.helpOpen = true;
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <RouterView v-if="route.meta.public" />
  <div v-else class="shell" :class="{ 'drawer-open': drawerOpen }">
    <header class="mobile-bar">
      <button class="btn quiet icon" type="button" aria-label="Open navigation" @click="drawerOpen = !drawerOpen"><AppIcon name="menu" /></button>
      <BrandMark :size="22" />
      <span class="display" style="font-size: calc(17px * var(--text-scale))">Biblio</span>
      <span class="spacer" />
      <button class="btn primary sm" type="button" @click="openAdd('search')"><AppIcon name="plus" :size="14" /> Add</button>
    </header>
    <div class="sidebar-slot"><AppSidebar @navigate="drawerOpen = false" /></div>
    <div v-if="drawerOpen" class="drawer-scrim" @click="drawerOpen = false" />
    <main class="shell-main">
      <RouterView />
    </main>
    <AddPapersDialog v-if="ui.addOpen" @close="ui.addOpen = false" />
    <HelpDialog v-if="ui.helpOpen" @close="ui.helpOpen = false" />
    <GuidedTour v-if="showTour" @done="endTour" />
    <ConfirmDialog />
    <CommandPalette v-if="ui.paletteOpen" @close="ui.paletteOpen = false" />
  </div>
  <ToastStack />
</template>

<style scoped>
@media (max-width: 820px) {
  .sidebar-slot {
    position: fixed;
    z-index: 30;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(300px, 86vw);
    transform: translateX(-100%);
    transition: transform 0.18s ease;
  }

  .drawer-open .sidebar-slot {
    transform: none;
    box-shadow: var(--shadow-lg);
  }

  .drawer-scrim {
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(20, 24, 22, 0.35);
  }
}
</style>
