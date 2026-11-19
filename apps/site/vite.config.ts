import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The project website is served at the root of its separate Firebase Hosting site.
export default defineConfig({
  base: process.env.SITE_BASE ?? "/",
  plugins: [vue()],
  build: {
    rollupOptions: {
      // Pages: home, the setup tutorial (setup/), and data & privacy (privacy/).
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        setup: fileURLToPath(new URL("setup/index.html", import.meta.url)),
        privacy: fileURLToPath(new URL("privacy/index.html", import.meta.url))
      }
    }
  },
  server: { port: 5180 }
});
