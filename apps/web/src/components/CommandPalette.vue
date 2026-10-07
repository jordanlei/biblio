<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { downloadBibtex, shortAuthors, useLibrary } from "../services/library";
import { isEmptyQuery, parseLocalQuery, scorePaper, fold } from "../services/librarySearch";
import { openAdd, ui } from "../services/ui";
import AppIcon from "./AppIcon.vue";

// ⌘K: jump to any paper or tag, or run a common action, without touching the mouse.

const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const { papers, tagCounts } = useLibrary();
const query = ref("");
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);

interface Item {
  id: string;
  group: "Papers" | "Tags" | "Actions";
  icon: string;
  label: string;
  detail?: string;
  run: () => void;
}

const go = (to: string | Record<string, unknown>) => () => void router.push(to as never);

const actions: Item[] = [
  { id: "a:add", group: "Actions", icon: "plus", label: "Add papers", detail: "A", run: () => openAdd("search") },
  { id: "a:import", group: "Actions", icon: "upload", label: "Import a .bib file", run: () => openAdd("import") },
  { id: "a:all", group: "Actions", icon: "library", label: "All papers", run: go("/library") },
  { id: "a:recent", group: "Actions", icon: "clock", label: "Recently added", run: go({ path: "/library", query: { view: "recent" } }) },
  { id: "a:inbox", group: "Actions", icon: "inbox", label: "Inbox", run: go({ path: "/library", query: { status: "inbox" } }) },
  { id: "a:read-next", group: "Actions", icon: "note", label: "Read next", run: go({ path: "/library", query: { status: "readNext" } }) },
  { id: "a:research-notes", group: "Actions", icon: "note", label: "Research notes", run: go("/research-notes") },
  { id: "a:export", group: "Actions", icon: "download", label: "Export references.bib", run: () => downloadBibtex(papers.value) },
  { id: "a:settings", group: "Actions", icon: "settings", label: "Settings", run: go("/settings") },
  { id: "a:help", group: "Actions", icon: "help", label: "Keyboard shortcuts", detail: "?", run: () => (ui.helpOpen = true) }
];

const items = computed<Item[]>(() => {
  const q = query.value.trim();
  const needle = fold(q);
  const parsed = parseLocalQuery(q);
  const paperItems = (isEmptyQuery(parsed)
    ? [...papers.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    : papers.value
        .map((p) => ({ p, s: scorePaper(p, parsed) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map((r) => r.p)
  ).map<Item>((p) => ({
    id: `p:${p.id}`,
    group: "Papers",
    icon: p.pdf ? "pdf" : "quote",
    label: p.title,
    detail: `${shortAuthors(p.authors)}${p.issued?.year ? ` · ${p.issued.year}` : ""}`,
    run: go(`/paper/${p.id}`)
  }));
  const match = (text: string) => !needle || fold(text).includes(needle);
  const tagItems = tagCounts.value
    .filter(([tag]) => needle && match(tag))
    .slice(0, 5)
    .map<Item>(([tag, count]) => ({ id: `t:${tag}`, group: "Tags", icon: "tag", label: `#${tag}`, detail: String(count), run: go({ path: "/library", query: { tag } }) }));
  const actionItems = actions.filter((a) => match(a.label));
  // Papers first when searching; actions first on an empty palette.
  return needle ? [...paperItems, ...tagItems, ...actionItems] : [...actionItems.slice(0, 4), ...paperItems, ...actionItems.slice(4)];
});

const grouped = computed(() => {
  const groups: Array<{ name: string; entries: Array<{ item: Item; index: number }> }> = [];
  items.value.forEach((item, index) => {
    let group = groups.find((g) => g.name === item.group);
    if (!group) groups.push((group = { name: item.group, entries: [] }));
    group.entries.push({ item, index });
  });
  return groups;
});

watch(query, () => (active.value = 0));
watch(active, async () => {
  await nextTick();
  listEl.value?.querySelector(".item.active")?.scrollIntoView({ block: "nearest" });
});

function run(item?: Item) {
  if (!item) return;
  emit("close");
  item.run();
}

function onKey(event: KeyboardEvent) {
  const count = items.value.length;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    active.value = count ? (active.value + 1) % count : 0;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    active.value = count ? (active.value - 1 + count) % count : 0;
  } else if (event.key === "Enter") {
    event.preventDefault();
    run(items.value[active.value]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("close");
  }
}

onMounted(() => input.value?.focus());
</script>

<template>
  <div class="overlay palette-overlay" @mousedown.self="emit('close')">
    <section class="palette" role="dialog" aria-modal="true" aria-label="Jump to">
      <div class="field">
        <AppIcon name="search" />
        <input
          ref="input"
          v-model="query"
          placeholder="Jump to a paper, tag, or action…"
          aria-label="Jump to"
          role="combobox"
          aria-controls="palette-list"
          :aria-activedescendant="items[active] ? `pal-${active}` : undefined"
          @keydown="onKey"
        />
        <kbd>Esc</kbd>
      </div>
      <div id="palette-list" ref="listEl" class="list" role="listbox">
        <template v-for="group in grouped" :key="group.name">
          <p class="group">{{ group.name }}</p>
          <button
            v-for="{ item, index } in group.entries"
            :id="`pal-${index}`"
            :key="item.id"
            type="button"
            role="option"
            class="item"
            :class="{ active: index === active }"
            :aria-selected="index === active"
            @mousemove="active = index"
            @click="run(item)"
          >
            <AppIcon :name="item.icon" :size="15" />
            <span class="label" :class="{ serif: item.group === 'Papers' }">{{ item.label }}</span>
            <span v-if="item.detail" class="detail">{{ item.detail }}</span>
          </button>
        </template>
        <p v-if="!items.length" class="none">Nothing matches “{{ query }}”.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.palette-overlay {
  padding-top: 14vh;
}

.palette {
  width: min(620px, 100%);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-3);
}

.field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: none;
  font-size: calc(16px * var(--text-scale));
  color: var(--text);
}

.list {
  max-height: min(56vh, 460px);
  overflow-y: auto;
  padding: 6px;
}

.group {
  padding: 8px 10px 4px;
  font-family: var(--font-serif);
  font-variant-caps: all-small-caps;
  font-size: calc(15px * var(--text-scale));
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-2);
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: calc(14px * var(--text-scale));
  text-align: left;
  cursor: pointer;
}

.item.active {
  background: var(--select);
  color: var(--text);
}

.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.label.serif {
  font-family: var(--font-serif);
  font-size: calc(15px * var(--text-scale));
}

.detail {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: calc(12.5px * var(--text-scale));
  color: var(--text-3);
}

.none {
  padding: 18px 12px;
  color: var(--text-3);
}
</style>
