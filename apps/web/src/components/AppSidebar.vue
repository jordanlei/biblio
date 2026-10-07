<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { usingEmulators } from "../firebase";
import { createFolder, createResearchNote, setPaperFolders, useLibrary } from "../services/library";
import { customNavItems } from "../custom";
import { scopeFromQuery, smartViews } from "../services/scope";
import { signOut, useSession } from "../services/session";
import { openAdd, toastError, ui } from "../services/ui";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import SyncIndicator from "./SyncIndicator.vue";

const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const router = useRouter();
const session = useSession();
const { papers, folders, tagCounts, researchNotes } = useLibrary();

const showAllTags = ref(false);
const accountOpen = ref(false);
const collapsedFolders = ref(new Set<string>());
const dropFolderId = ref<string | null>(null);
const newFolderName = ref("");
const recentNotes = computed(() => [...researchNotes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6));

async function newNote() {
  try {
    const note = await createResearchNote();
    await router.push({ path: `/research-notes/${note.id}`, query: { new: "1" } });
  } catch (error) {
    toastError(error);
  }
}
const newFolderParent = ref<string | null>(null);
// Focus the new-folder input with its placeholder name selected, so typing replaces it.
const vSelectOnMount = { mounted: (el: HTMLInputElement) => el.select() };

const activeScope = computed(() => (route.path === "/library" ? scopeFromQuery(route.query) : null));

const viewCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const view of smartViews) counts[view.id] = papers.value.filter(scopeFromQuery({ view: view.id }).matches).length;
  return counts;
});

const visibleTags = computed(() => (showAllTags.value ? tagCounts.value : tagCounts.value.slice(0, 12)));
const folderRows = computed(() => {
  const rows: Array<{ id: string; name: string; depth: number; count: number; hasChildren: boolean }> = [];
  const children = new Map<string | null, typeof folders.value>();
  for (const folder of folders.value) children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder]);
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of children.get(parentId) ?? []) {
      rows.push({
        id: folder.id,
        name: folder.name,
        depth,
        count: papers.value.filter((p) => p.folderIds.includes(folder.id)).length,
        hasChildren: Boolean(children.get(folder.id)?.length)
      });
      if (!collapsedFolders.value.has(folder.id)) visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
});

function isActive(kind: string, id: string) {
  return activeScope.value?.kind === kind && activeScope.value.id === id;
}

async function handleSignOut() {
  await signOut(); // also clears the on-device cache and returns to the home page
}

function toggleFolder(id: string) {
  const next = new Set(collapsedFolders.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedFolders.value = next;
}

function startFolder(parentId: string | null) {
  newFolderParent.value = parentId;
  newFolderName.value = "New folder";
  if (parentId) {
    const next = new Set(collapsedFolders.value);
    next.delete(parentId);
    collapsedFolders.value = next;
  }
}

async function addFolder() {
  const name = newFolderName.value.trim();
  if (!name) return;
  const folder = await createFolder(name, newFolderParent.value);
  newFolderName.value = "";
  await router.push({ path: "/library", query: { folder: folder.id } });
}

async function dropOnFolder(folderId: string, event: DragEvent) {
  dropFolderId.value = null;
  const raw = event.dataTransfer?.getData("application/x-biblio-papers");
  if (!raw) return;
  event.preventDefault();
  await setPaperFolders(JSON.parse(raw) as string[], folderId, true);
}
</script>

<template>
  <aside class="sidebar" @click="($event.target as HTMLElement).closest('a') && emit('navigate')">
    <div class="brand-row">
      <RouterLink to="/library" class="brand"><BrandMark :size="26" /> Biblio</RouterLink>
      <span v-if="usingEmulators" class="chip accent" title="Firebase emulators + mock Drive">Local</span>
    </div>

    <button class="btn primary block add-btn" data-tour="add" type="button" @click="openAdd('search')">
      <AppIcon name="plus" /> Add papers <span class="spacer" /><kbd class="kbd-on-accent">A</kbd>
    </button>

    <button class="jump" type="button" @click="ui.paletteOpen = true">
      <AppIcon name="search" :size="14" /> <span>Jump to…</span> <span class="spacer" /> <kbd>⌘K</kbd>
    </button>

    <nav class="nav-group" aria-label="Library views">
      <RouterLink
        v-for="view in smartViews"
        :key="view.id"
        class="nav-item"
        :class="{ active: isActive('view', view.id) }"
        :to="view.id === 'all' ? '/library' : { path: '/library', query: { view: view.id } }"
      >
        <AppIcon :name="view.icon" /> <span class="label">{{ view.label }}</span>
        <span class="count tnum">{{ viewCounts[view.id] }}</span>
      </RouterLink>
    </nav>

    <section class="nav-group">
      <div class="group-head">
        <RouterLink class="group-link" to="/research-notes">Notes</RouterLink>
        <button class="btn quiet icon mini" type="button" aria-label="New note" title="New note" @click="newNote"><AppIcon name="plus" :size="13" /></button>
      </div>
      <RouterLink
        v-for="note in recentNotes"
        :key="note.id"
        class="nav-item"
        :class="{ active: route.path === `/research-notes/${note.id}` }"
        :to="`/research-notes/${note.id}`"
      >
        <AppIcon name="note" /> <span class="label">{{ note.title }}</span>
      </RouterLink>
      <RouterLink v-if="researchNotes.length > recentNotes.length" class="nav-item more" to="/research-notes">All {{ researchNotes.length }} notes</RouterLink>
      <p v-if="!researchNotes.length" class="hint">Notes for questions and projects. Link papers with @[.</p>
    </section>

    <section class="nav-group">
      <div class="group-head">
        <span>Folders</span>
        <button class="btn quiet icon mini" type="button" aria-label="New folder" title="New folder" @click="newFolderName ? (newFolderName = '') : startFolder(null)"><AppIcon name="plus" :size="13" /></button>
      </div>
      <form v-if="newFolderName" class="nav-item" @submit.prevent="addFolder">
        <input v-model="newFolderName" v-select-on-mount class="input folder-input" :aria-label="newFolderParent ? 'Subfolder name' : 'Folder name'" @keydown.esc="newFolderName = ''" />
      </form>
      <template v-if="folderRows.length">
        <div
          v-for="folder in folderRows"
          :key="folder.id"
          class="nav-item folder-row"
          :class="{ active: isActive('folder', folder.id), drop: dropFolderId === folder.id }"
          :style="{ paddingLeft: `${8 + folder.depth * 14}px` }"
          @dragover.prevent="dropFolderId = folder.id"
          @dragleave="dropFolderId = null"
          @drop="dropOnFolder(folder.id, $event)"
        >
          <button class="twisty" :class="{ hidden: !folder.hasChildren, open: !collapsedFolders.has(folder.id) }" type="button" aria-label="Toggle folder" @click="toggleFolder(folder.id)">
            <AppIcon name="chevron-right" :size="12" />
          </button>
          <RouterLink class="folder-link" :to="{ path: '/library', query: { folder: folder.id } }">
            <AppIcon name="folder" :size="14" /> <span class="label">{{ folder.name }}</span>
          </RouterLink>
          <span class="count tnum">{{ folder.count }}</span>
          <span class="row-actions">
            <button type="button" aria-label="New subfolder" title="New subfolder" @click="startFolder(folder.id)"><AppIcon name="plus" :size="12" /></button>
          </span>
        </div>
      </template>
      <p v-else class="hint">Use folders for stable projects or broad areas.</p>
    </section>

    <section v-if="customNavItems.length" class="nav-group">
      <RouterLink v-for="item in customNavItems" :key="item.to" class="nav-item" :class="{ active: route.path === item.to }" :to="item.to">
        <AppIcon :name="item.icon" /> <span class="label">{{ item.label }}</span>
      </RouterLink>
    </section>

    <section class="nav-group">
      <div class="group-head"><span>Tags</span></div>
      <template v-if="tagCounts.length">
        <RouterLink
          v-for="[tag, count] in visibleTags"
          :key="tag"
          class="nav-item"
          :class="{ active: isActive('tag', tag) }"
          :to="{ path: '/library', query: { tag } }"
        >
          <span class="hash">#</span> <span class="label">{{ tag }}</span> <span class="count tnum">{{ count }}</span>
        </RouterLink>
        <button v-if="tagCounts.length > 12" class="nav-item more" type="button" @click="showAllTags = !showAllTags">
          {{ showAllTags ? "Show fewer" : `Show all ${tagCounts.length} tags` }}
        </button>
      </template>
      <p v-else class="hint">Tags appear when you add them to papers.</p>
    </section>

    <div class="sidebar-foot">
      <SyncIndicator />
      <div class="account">
        <button class="nav-item" :class="{ active: route.path === '/settings' }" type="button" aria-haspopup="menu" :aria-expanded="accountOpen" @click="accountOpen = !accountOpen">
          <span class="avatar">{{ (session.user.value?.displayName ?? session.user.value?.email ?? "?").slice(0, 1).toUpperCase() }}</span>
          <span class="label">{{ session.user.value?.displayName ?? session.user.value?.email }}</span>
          <AppIcon name="more" />
        </button>
        <div v-if="accountOpen" class="account-menu card" role="menu">
          <p class="small faint">{{ session.user.value?.email }}</p>
          <RouterLink class="nav-item" role="menuitem" to="/settings" @click="accountOpen = false"><AppIcon name="settings" /> Settings</RouterLink>
          <button class="nav-item" role="menuitem" type="button" @click="ui.helpOpen = true; accountOpen = false"><AppIcon name="help" /> Keyboard shortcuts</button>
          <button class="nav-item" role="menuitem" type="button" @click="handleSignOut"><AppIcon name="logout" /> Sign out</button>
        </div>
        <div v-if="accountOpen" class="menu-scrim" @click="accountOpen = false" />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100vh;
  padding: 16px 12px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-serif);
  font-size: calc(19px * var(--text-scale));
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text);
  text-decoration: none;
}

.jump {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  margin-top: -8px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-3);
  font-size: calc(13px * var(--text-scale));
  cursor: pointer;
}

.jump:hover {
  border-color: var(--border-strong);
  color: var(--text-2);
}

.add-btn {
  justify-content: flex-start;
  height: 36px;
}

.kbd-on-accent {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
}

.nav-group {
  display: grid;
  gap: 1px;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  padding: 0 4px 0 8px;
  font-family: var(--font-serif);
  font-variant-caps: all-small-caps;
  font-size: calc(15px * var(--text-scale));
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-2);
}

.mini {
  width: 22px;
  height: 22px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: calc(13.5px * var(--text-scale));
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--surface-3);
  color: var(--text);
}

.nav-item.active {
  background: var(--surface);
  color: var(--text);
  font-weight: 550;
  box-shadow: 0 0 0 1px var(--border);
}

.nav-item.drop {
  background: var(--accent-soft);
  box-shadow: 0 0 0 2px var(--accent);
}

.nav-item:disabled {
  opacity: 0.5;
  cursor: default;
}

.nav-item.more {
  color: var(--text-3);
  font-size: calc(12.5px * var(--text-scale));
}

.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: calc(12px * var(--text-scale));
  color: var(--text-3);
}

.hash {
  width: 16px;
  text-align: center;
  color: var(--text-3);
}

.folder-row {
  gap: 2px;
}

.folder-link {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.twisty {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  transition: transform 0.12s;
}

.twisty.open {
  transform: rotate(90deg);
}

.twisty.hidden {
  visibility: hidden;
}

.row-actions {
  display: none;
  gap: 1px;
}

.folder-row:hover .row-actions {
  display: flex;
}

.folder-row:hover .count {
  display: none;
}

.row-actions button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}

.row-actions button:hover {
  background: var(--surface);
  color: var(--text);
}

.folder-input {
  height: 26px;
  font-size: calc(13px * var(--text-scale));
}

.group-link {
  color: inherit;
  text-decoration: none;
}

.group-link:hover {
  color: var(--text);
}

.nav-item.more {
  color: var(--text-3);
  font-size: calc(12.5px * var(--text-scale));
}

.hint {
  padding: 2px 8px;
  font-size: calc(12.5px * var(--text-scale));
  color: var(--text-3);
}

.sidebar-foot {
  display: grid;
  gap: 1px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.drive-warn {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  background: var(--warn-soft);
  color: var(--warn-ink);
  font-size: calc(12.5px * var(--text-scale));
  font-weight: 500;
  text-decoration: none;
}

.account {
  position: relative;
}

.avatar {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-size: calc(11px * var(--text-scale));
  font-weight: 700;
}

.menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 19;
}

.account-menu {
  position: absolute;
  z-index: 20;
  bottom: 36px;
  left: 0;
  right: 0;
  display: grid;
  gap: 2px;
  padding: 8px;
  box-shadow: var(--shadow);
}

.account-menu p {
  padding: 0 8px 4px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 820px) {
  .sidebar {
    height: 100%;
  }
}
</style>
