// Provider-boundary check: core library/sync logic must not depend on storage or backend SDKs,
// and UI code must reach providers only through services. Run by `npm test`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rules = [
  { dir: "packages/core/src", forbid: [/^firebase(\/|$)/, /^vue$/, /^@google/, /^googleapis/, /apps\/web/], why: "core must stay provider- and framework-agnostic" },
  { dir: "apps/web/src/components", forbid: [/^firebase(\/|$)/, /adapters\//], why: "UI talks to services, not SDKs or adapters" },
  { dir: "apps/web/src/views", forbid: [/^firebase(\/|$)/, /adapters\//], why: "UI talks to services, not SDKs or adapters" },
  { dir: "apps/web/src/sync", forbid: [/^firebase(\/|$)/], why: "sync wiring uses adapters, never SDKs directly" }
];

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|vue)$/.test(name) ? [path] : [];
  });

const problems = [];
for (const rule of rules) {
  for (const file of files(rule.dir)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = match[1] ?? match[2];
      if (rule.forbid.some((pattern) => pattern.test(spec))) problems.push(`${relative(process.cwd(), file)} imports "${spec}" — ${rule.why}`);
    }
  }
}

if (problems.length) {
  console.error(`Provider-boundary violations:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Provider boundaries OK (${rules.length} rules).`);
