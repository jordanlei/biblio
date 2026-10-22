// Refresh the vendored Zotero translators from github.com/zotero/translators, then rebuild the
// extension. Publishers change their pages often and Zotero keeps its translators current; run
// this when a site that works in the Zotero Connector doesn't work in Biblio.
//   npm run update:translators
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../vendor/zotero/translators/", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "zotero-translators-"));
const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout.trim();
};
try {
  run("git", ["clone", "--quiet", "--depth", "1", "https://github.com/zotero/translators.git", scratch]);
  const revision = run("git", ["-C", scratch, "log", "-1", "--format=%H (%cs)"]);
  for (const name of readdirSync(target)) if (name.endsWith(".js")) rmSync(join(target, name));
  const files = readdirSync(scratch).filter((name) => name.endsWith(".js"));
  for (const name of files) cpSync(join(scratch, name), join(target, name));
  writeFileSync(join(target, "VERSION"), `zotero/translators ${revision}\n`);
  console.log(`Vendored ${files.length} Zotero translators at ${revision}.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
run("node", [fileURLToPath(new URL("./build.mjs", import.meta.url))], { stdio: "inherit" });
