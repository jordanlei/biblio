import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The project website (static). SITE_BASE is the path it's served under, e.g. "/bibliograph/" on
// GitHub Pages (set by .github/workflows/site.yml).
export default defineConfig({
  base: process.env.SITE_BASE ?? "/",
  plugins: [vue()],
  build: {
    rollupOptions: {
      // Two pages: the home page and the setup tutorial (served at setup/).
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        setup: fileURLToPath(new URL("setup/index.html", import.meta.url))
      }
    }
  },
  server: { port: 5180 }
});
