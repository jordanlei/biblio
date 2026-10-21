import { createRouter, createWebHistory } from "vue-router";
import { lazyViews } from "./lazy";
import LibraryView from "./views/LibraryView.vue";
import { sessionReady, useSession } from "./services/session";
import { openAdd } from "./services/ui";
import { customRoutes } from "./custom";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/library" },
    { path: "/login", component: lazyViews.login, meta: { public: true } },
    { path: "/library", component: LibraryView },
    { path: "/paper/:id", component: lazyViews.paper },
    { path: "/research-notes/:id?", component: lazyViews.researchNotes },
    { path: "/settings", component: lazyViews.settings },
    { path: "/capture", component: lazyViews.capture },
    // Your own pages (apps/web/src/custom): declared before the catch-all so they resolve.
    ...customRoutes.map((route) => ({ path: route.path, component: route.component })),
    {
      path: "/search",
      redirect: () => {
        openAdd("search");
        return "/library";
      }
    },
    { path: "/:pathMatch(.*)*", redirect: "/library" }
  ]
});

// Resolve auth (and the profile) before any route renders, so deep links and reloads work.
router.beforeEach(async (to) => {
  await sessionReady;
  const { signedIn } = useSession();
  if (!to.meta.public && !signedIn.value) return { path: "/login", query: to.fullPath !== "/library" ? { next: to.fullPath } : {} };
  if (to.path === "/login" && signedIn.value) return (to.query.next as string) || "/library";
  return true;
});
