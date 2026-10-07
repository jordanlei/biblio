// Build and deploy this copy to its own Firebase project: hosting + Firestore rules.
import { spawnSync } from "node:child_process";
import { requireConfig } from "./lib/config.mjs";

const { projectId, appUrl } = requireConfig();
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("npm", ["run", "build"]);
run("npx", ["firebase", "deploy", "--only", "hosting,firestore:rules", "--project", projectId, "--non-interactive"]);
console.log(`\nDeployed: ${appUrl}`);
