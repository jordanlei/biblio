// Code-split chunks. The library view and app shell load up front; these load on first use and
// are prefetched once the app is idle, so navigation still feels instant.
export const lazyViews = {
  login: () => import("./views/LoginView.vue"),
  paper: () => import("./views/PaperView.vue"),
  researchNotes: () => import("./views/ResearchNotesView.vue"),
  settings: () => import("./views/SettingsView.vue"),
  capture: () => import("./views/CaptureView.vue")
};

export const lazyDialogs = {
  add: () => import("./components/AddPapersDialog.vue"),
  help: () => import("./components/HelpDialog.vue"),
  tour: () => import("./components/GuidedTour.vue"),
  palette: () => import("./components/CommandPalette.vue")
};

/** Warm the chunks a signed-in user is likely to need next. */
export function prefetchChunks() {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
  idle(() => {
    for (const load of [lazyViews.paper, lazyDialogs.add, lazyDialogs.palette, lazyViews.settings, lazyDialogs.help]) void load();
  });
}
