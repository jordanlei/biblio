// The deployment config: which Firebase project this copy of Biblio talks to.
// Lives in biblio.config.json at the repo root (gitignored; written by `npm run setup`).
// Every value in it is public by design (it ships in the web app), so it's safe to share,
// but it is per copy: a fork must never inherit another person's project.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CONFIG_PATH = fileURLToPath(new URL("../../biblio.config.json", import.meta.url));

/**
 * @typedef {{
 *   projectId: string,
 *   appUrl: string,
 *   firebase: { apiKey: string, authDomain: string, projectId: string, storageBucket?: string, messagingSenderId: string, appId: string }
 * }} BiblioConfig
 */

/** The config from BIBLIO_CONFIG (JSON, for CI) or biblio.config.json; null if neither. */
export function readConfig() {
  const raw = process.env.BIBLIO_CONFIG || (existsSync(CONFIG_PATH) ? readFileSync(CONFIG_PATH, "utf8") : "");
  if (!raw.trim()) return null;
  const config = JSON.parse(raw);
  for (const key of ["projectId", "appUrl"]) if (!config[key]) throw new Error(`biblio.config.json is missing "${key}".`);
  for (const key of ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"]) {
    if (!config.firebase?.[key]) throw new Error(`biblio.config.json is missing "firebase.${key}".`);
  }
  return /** @type {BiblioConfig} */ (config);
}

export function requireConfig() {
  const config = readConfig();
  if (!config) {
    console.error("No biblio.config.json yet: this copy isn't connected to a Firebase project.\nRun `npm run setup` (see docs/SELF_HOSTING.md), or `npm run dev:local` to try it without one.");
    process.exit(1);
  }
  return config;
}

export function writeConfig(config) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}
