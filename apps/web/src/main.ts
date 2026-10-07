import { createApp } from "vue";
import App from "./App.vue";
import { usingEmulators } from "./firebase";
import { prefetchChunks } from "./lazy";
import { router } from "./router";
import { useSession } from "./services/session";
import "./styles.css";
import "./services/appearance";
import "./sync/librarySync";

createApp(App).use(router).mount("#app");
void router.isReady().then(() => {
  if (useSession().signedIn.value) prefetchChunks();
});

if (usingEmulators) void import("./services/emulatorHooks").then((hooks) => hooks.installEmulatorHooks());
