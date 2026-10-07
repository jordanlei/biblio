// Build the Chrome extension for this copy's web app (from biblio.config.json):
// copies apps/extension/ to apps/extension/dist/ with the app URL and app origins filled in.
// The source keeps local-test-mode defaults, so no one's deployment ends up in git.
//   npm run build:extension   (also run by `npm run setup`)
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { requireConfig } from "./lib/config.mjs";

const { appUrl, firebase } = requireConfig();
const src = fileURLToPath(new URL("../apps/extension/", import.meta.url));
const out = fileURLToPath(new URL("../apps/extension/dist/", import.meta.url));
const origin = new URL(appUrl).origin;

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const name of readdirSync(src)) if (/\.(js|json|html|css|png|svg)$/.test(name) && name !== "package.json") copyFileSync(src + name, out + name);

writeFileSync(`${out}app-url.js`, readFileSync(`${out}app-url.js`, "utf8").replace(/const DEFAULT_APP_URL = ".*";/, `const DEFAULT_APP_URL = ${JSON.stringify(origin)};`));

const manifest = JSON.parse(readFileSync(`${out}manifest.json`, "utf8"));
const bridge = manifest.content_scripts.find((entry) => entry.js.includes("bridge.js"));
bridge.matches = [...new Set([`${origin}/*`, `https://${firebase.authDomain}/*`, ...bridge.matches])];
writeFileSync(`${out}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Extension built for ${origin}: load apps/extension/dist in chrome://extensions (Developer mode → Load unpacked).`);
