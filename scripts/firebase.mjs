// `firebase <args>` against this copy's own project (from biblio.config.json).
//   npm run firebase -- deploy --only hosting
import { spawnSync } from "node:child_process";
import { requireConfig } from "./lib/config.mjs";

const { projectId } = requireConfig();
const result = spawnSync("npx", ["firebase", ...process.argv.slice(2), "--project", projectId], { stdio: "inherit" });
process.exit(result.status ?? 1);
