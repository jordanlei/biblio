import { createApp } from "vue";
import App from "./App.vue";
import { usingEmulators } from "./firebase";
import { prefetchChunks } from "./lazy";
import { router } from "./router";
import { useSession } from "./services/session";
import "katex/dist/katex.min.css";
import "./styles.css";
import "./services/appearance";
import "./sync/librarySync";

createApp(App).use(router).mount("#app");
void router.isReady().then(() => {
  if (useSession().signedIn.value) prefetchChunks();
});

if (usingEmulators) void import("./services/emulatorHooks").then((hooks) => hooks.installEmulatorHooks());

// Installable app (see public/sw.js). Not in dev or local test mode, where it would cache stale code.
if ("serviceWorker" in navigator && import.meta.env.PROD && !usingEmulators) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      // Check for a new version whenever the app comes back to the foreground.
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void reg.update().catch(() => {}));
    })
    .catch(() => {});
}
