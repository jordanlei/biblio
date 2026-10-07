import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// The project website (static). SITE_BASE is the path it's served under, e.g. "/bibliograph/" on
// GitHub Pages (set by .github/workflows/site.yml).
export default defineConfig({
  base: process.env.SITE_BASE ?? "/",
  plugins: [vue()],
  server: { port: 5180 }
});
