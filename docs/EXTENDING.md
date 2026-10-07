# Adding your own features

Your copy of Biblio is yours to change. You can edit any file, but if you want upstream updates to
keep merging cleanly, put your own work in **`apps/web/src/custom/`**. Biblio never changes that
folder, so `git pull` from upstream won't conflict with it.

## The idea

Three registries in `apps/web/src/custom/index.ts` are read at startup:

| Registry | What it adds |
| --- | --- |
| `customRoutes` | New pages at your own URLs |
| `customNavItems` | Links to them in the sidebar |
| `customPaperPanels` | Panels on the paper page, each given the `paper` as a prop |

Adding a feature means writing your component in `custom/` and adding one line to a registry.

## A worked example

`apps/web/src/custom/ReadingStats.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useLibrary } from "../services/library";

const { papers } = useLibrary();
const read = computed(() => papers.value.filter((p) => p.readingStatus === "read").length);
</script>

<template>
  <section class="card pad">
    <h2 class="section-label">Reading stats</h2>
    <p>{{ read }} of {{ papers.length }} papers read.</p>
  </section>
</template>
```

Then in `apps/web/src/custom/index.ts`:

```ts
import type { CustomNavItem, CustomRoute } from "./index";

export const customRoutes: CustomRoute[] = [{ path: "/stats", component: () => import("./ReadingStats.vue") }];
export const customNavItems: CustomNavItem[] = [{ to: "/stats", label: "Reading stats", icon: "library" }];
```

That's it. `npm run dev` to try it, `npm run deploy` to publish it to your copy.

## What you can use

Your code is part of the app, so it can use anything the app can:

- **`services/library`** — `useLibrary()` for live papers, folders, research notes, tags, and
  backlinks; plus every write (`updatePaper`, `createResearchNote`, …).
- **`services/drive`** — the connected library folder, for reading and writing your own files in it.
- **`@biblio/core`** — types, citation keys, BibTeX in and out, the library format.
- **`components/AppIcon.vue`** and the shared CSS classes (`.card`, `.btn`, `.section-label`).

Keep anything you want other people to have out of `custom/` and in the normal source, so it can be
contributed upstream.

## Staying up to date with upstream

```sh
git remote add upstream https://github.com/jordanlei/biblio.git
git fetch upstream
git merge upstream/main
```

Because your features are additions in their own folder, a merge usually touches nothing of yours.
If you also changed core files, those are ordinary merges you resolve as usual.

## If you go further

If several people start writing extensions, the registries are the natural seam to turn into a real
plugin API (separate packages, a stable interface). That's deliberately not built yet: a plugin API
designed against one example is usually the wrong API.
