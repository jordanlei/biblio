import vue from "@vitejs/plugin-vue";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";

// Which Firebase project this copy talks to comes from bibliograph.config.json at the repo root
// (written by `npm run setup`), or BIBLIOGRAPH_CONFIG in CI. There is deliberately no fallback:
// a fork that hasn't run setup must not quietly use someone else's project.
// Local test mode (--mode emulator) needs no config: it runs against emulators and a mock Drive.
function bibliographConfig(mode: string) {
  if (mode === "emulator") return null;
  const file = new URL("../../bibliograph.config.json", import.meta.url);
  const raw = process.env.BIBLIOGRAPH_CONFIG || (existsSync(file) ? readFileSync(file, "utf8") : "");
  if (raw.trim()) return JSON.parse(raw);
  throw new Error("No bibliograph.config.json: run `npm run setup` to connect this copy to your own Firebase project (docs/SELF_HOSTING.md), or `npm run dev:local` to try it without one.");
}

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  define: {
    __BIBLIOGRAPH_CONFIG__: JSON.stringify(bibliographConfig(mode))
  },
  server: {
    port: 5173
  }
}));
