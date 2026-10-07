// Set up your own copy of Bibliograph: your own Firebase project, database, sign-in, and site.
//
//   npm install
//   npm run setup                      # interactive
//   npm run setup -- --project my-id   # use (or create) this project
//   npm run setup -- --dry-run         # show what would happen; change nothing
//   npm run setup -- --no-deploy       # configure only
//   npm run setup -- --github          # also deploy on every push to main (GitHub Actions)
//
// Safe to rerun: every step checks what already exists first. See docs/SELF_HOSTING.md.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { readConfig, writeConfig } from "./lib/config.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const DRY = flag("dry-run");
const REQUIRED_APIS = ["firestore.googleapis.com", "drive.googleapis.com", "identitytoolkit.googleapis.com"];

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (question, fallback = "") => (await rl.question(`${question}${fallback ? ` [${fallback}]` : ""} `)).trim() || fallback;
const yes = async (question, fallback = true) => /^y/i.test(await ask(`${question} (y/n)`, fallback ? "y" : "n"));

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
let stepNo = 0;
const step = (title) => console.log(`\n${bold(`${++stepNo}. ${title}`)}`);
const ok = (message) => console.log(`   ✓ ${message}`);
const note = (message) => console.log(`   ${dim(message)}`);
const would = (message) => console.log(`   → would ${message}`);

/** Run the Firebase CLI and return its JSON result (throws with the CLI's message on failure). */
function firebase(...cliArgs) {
  let out;
  try {
    out = execFileSync("npx", ["firebase", ...cliArgs, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
  } catch (error) {
    out = error.stdout || "";
    if (!out.trim()) throw new Error(`firebase ${cliArgs[0]} failed: ${String(error.stderr || error.message).trim()}`);
  }
  const parsed = JSON.parse(out.slice(out.indexOf("{")));
  if (parsed.status !== "success") throw new Error(`firebase ${cliArgs[0]}: ${parsed.error ?? "failed"}`);
  return parsed.result;
}

/** Firebase CLI with the terminal attached (for login, which opens a browser). */
function firebaseInteractive(...cliArgs) {
  const result = spawnSync("npx", ["firebase", ...cliArgs], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`firebase ${cliArgs.join(" ")} failed.`);
}

function openInBrowser(url) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawnSync(opener, [url], { stdio: "ignore" });
}

// --- Google Cloud REST, as the account you signed in to the Firebase CLI with ----------------
// A few things have no Firebase CLI command (turning on the Drive API, checking Google sign-in). Setup calls Google's APIs for those using the Firebase CLI's own
// sign-in on this machine; nothing is sent anywhere else. If that isn't possible, setup prints the
// console page for each step instead.

let tokenPromise;
function accessToken() {
  tokenPromise ??= (async () => {
    const auth = createRequire(import.meta.url)("firebase-tools/lib/auth.js");
    const account = auth.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) throw new Error("not signed in to the Firebase CLI");
    const token = await auth.getAccessToken(account.tokens.refresh_token, []);
    if (!token?.access_token) throw new Error("no access token");
    return token.access_token;
  })();
  return tokenPromise;
}

async function google(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data.error?.message ?? `${method} ${url} → ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Wait for a long-running Google operation. `base` is the API's versioned root URL. */
async function finished(base, operation) {
  let op = operation;
  for (let i = 0; !op.done && i < 60; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    op = await google("GET", `${base}/${op.name}`);
  }
  if (op.error) throw new Error(op.error.message);
  return op.response ?? op;
}

// --- Steps ------------------------------------------------------------------------------------

async function signIn() {
  step("Sign in to Google (Firebase CLI)");
  let accounts = firebase("login:list");
  if (!accounts.length) {
    if (DRY) return would("run `firebase login` (opens your browser)");
    note("A browser window will open. Sign in with the Google account that should own your copy.");
    firebaseInteractive("login");
    accounts = firebase("login:list");
  }
  const email = accounts[0]?.user?.email;
  ok(`Signed in as ${email}`);
  return email;
}

function suggestedProjectId(email) {
  const base = (email ?? "me").split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 14) || "me";
  return `bibliograph-${base}-${randomBytes(2).toString("hex")}`.replace(/^[^a-z]+/, "");
}

async function chooseProject(email) {
  step("Your Firebase project");
  const existing = readConfig();
  const projects = firebase("projects:list");
  let projectId = option("project");
  if (!projectId) {
    if (existing && projects.some((p) => p.projectId === existing.projectId)) {
      note(`This copy is already set up for ${existing.projectId}.`);
      projectId = (await yes(`Keep using ${existing.projectId}?`)) ? existing.projectId : "";
    }
    if (!projectId) {
      note("Pick a new project ID (6–30 characters: lowercase letters, digits, hyphens). It becomes your address: <id>.web.app.");
      if (projects.length) note(`Or type one you already have: ${projects.map((p) => p.projectId).slice(0, 5).join(", ")}${projects.length > 5 ? ", …" : ""}`);
      projectId = await ask("Project ID:", suggestedProjectId(email));
    }
  }
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error(`"${projectId}" isn't a valid project ID.`);

  if (projects.some((p) => p.projectId === projectId)) {
    ok(`Using your existing project ${projectId}`);
  } else if (DRY) {
    would(`create the Firebase project ${projectId}`);
  } else {
    note(`Creating ${projectId}… (this can take a minute)`);
    try {
      firebase("projects:create", projectId, "--display-name", "Bibliograph");
    } catch (error) {
      console.error(`\n   Couldn't create the project: ${error.message}`);
      console.error("   If this is your first Firebase project, accept the terms at https://console.firebase.google.com once, then rerun setup.");
      throw error;
    }
    ok(`Created ${projectId}`);
  }
  return projectId;
}

async function webApp(projectId) {
  step("Web app registration");
  if (DRY && !firebase("projects:list").some((p) => p.projectId === projectId)) {
    would("register a web app and read its config");
    return null;
  }
  let apps = firebase("apps:list", "WEB", "--project", projectId);
  if (!apps.length) {
    if (DRY) {
      would("register a web app named Bibliograph");
      return null;
    }
    firebase("apps:create", "WEB", "Bibliograph", "--project", projectId);
    apps = firebase("apps:list", "WEB", "--project", projectId);
  }
  const app = apps.find((a) => /bibliograph/i.test(a.displayName ?? "")) ?? apps[0];
  const result = firebase("apps:sdkconfig", "WEB", app.appId, "--project", projectId);
  const sdk = result.sdkConfig ?? JSON.parse(String(result.fileContents).slice(String(result.fileContents).indexOf("{"), String(result.fileContents).lastIndexOf("}") + 1));
  ok(`Web app ${app.displayName ?? app.appId}`);
  return {
    apiKey: sdk.apiKey,
    authDomain: sdk.authDomain ?? `${projectId}.firebaseapp.com`,
    projectId: sdk.projectId ?? projectId,
    storageBucket: sdk.storageBucket,
    messagingSenderId: sdk.messagingSenderId,
    appId: sdk.appId
  };
}

async function enableApis(projectId) {
  step("Google APIs (Firestore, Drive, sign-in)");
  if (DRY) return would(`turn on ${REQUIRED_APIS.join(", ")}`);
  try {
    const op = await google("POST", `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`, { serviceIds: REQUIRED_APIS });
    if (!op.done) await finished("https://serviceusage.googleapis.com/v1", op);
    ok("APIs on");
    return true;
  } catch (error) {
    note(`Couldn't turn them on automatically (${error.message}).`);
    console.log("   Turn on the Google Drive API here, then come back:");
    console.log(`     https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${projectId}`);
    await ask("Press Enter when it says “API enabled”.");
    return false;
  }
}

async function firestore(projectId) {
  step("Firestore database");
  let databases = [];
  try {
    databases = firebase("firestore:databases:list", "--project", projectId);
  } catch {
    // A brand-new project may not have the Firestore API reachable yet; treat as none.
  }
  if (databases.some((db) => String(db.name).endsWith("/(default)"))) return ok("Database exists");
  note("Where should your database live? nam5 (United States), eur3 (Europe), or any single region such as asia-northeast1.");
  const location = DRY ? "nam5" : await ask("Location:", "nam5");
  if (DRY) return would(`create the (default) database in ${location}`);
  firebase("firestore:databases:create", "(default)", "--location", location, "--project", projectId);
  ok(`Database created (${location})`);
}

async function googleSignIn(projectId) {
  step("Google sign-in");
  if (DRY) return would("check that Google sign-in is on, and if not, open the Firebase console page to turn it on");
  const check = async () => {
    try {
      const config = await google("GET", `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com`);
      return config.enabled === true;
    } catch (error) {
      return error.status === 404 ? false : null; // null: can't tell
    }
  };
  let state = await check();
  if (state) return ok("Google sign-in is on");
  const url = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  console.log("   Google doesn't let setup turn this on for you; it's one click:");
  console.log(`     1. Open ${url}`);
  console.log("        (click “Get started” first if Authentication is new)");
  console.log("     2. Choose Google → Enable, pick your email as the support email → Save.");
  openInBrowser(url);
  for (let tries = 0; tries < 5; tries += 1) {
    await ask("Press Enter once it's saved.");
    state = await check();
    if (state !== false) break;
    note("It still looks off. Make sure you pressed Save, then try again.");
  }
  if (state) ok("Google sign-in is on");
  else note("Couldn't confirm it; if sign-in fails later, check that page again.");
}

function hostingSite(projectId) {
  step("Hosting site");
  let sites = [];
  try {
    const result = firebase("hosting:sites:list", "--project", projectId);
    sites = Array.isArray(result) ? result : (result.sites ?? []);
  } catch {
    // New projects may not list sites yet.
  }
  const own = sites.find((s) => String(s.name).endsWith(`/sites/${projectId}`)) ?? sites[0];
  if (own) {
    const id = String(own.name).split("/").pop();
    ok(`https://${id}.web.app`);
    return `https://${id}.web.app`;
  }
  if (DRY) {
    would(`create the site ${projectId}.web.app`);
    return `https://${projectId}.web.app`;
  }
  firebase("hosting:sites:create", projectId, "--project", projectId);
  ok(`https://${projectId}.web.app`);
  return `https://${projectId}.web.app`;
}

function run(script, extra = []) {
  const result = spawnSync("node", [script, ...extra], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${script} failed.`);
}

async function github(config) {
  step("Deploy on every push (GitHub Actions)");
  const gh = spawnSync("gh", ["auth", "status"], { stdio: "ignore" });
  if (gh.error || gh.status !== 0) {
    note("Needs the GitHub CLI, signed in: https://cli.github.com → `gh auth login`. Skipping.");
    return;
  }
  const repo = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { encoding: "utf8" }).stdout.trim();
  if (!repo) return note("This folder isn't a GitHub repository yet (push your fork first). Skipping.");
  if (DRY) return would(`create a deploy service account in ${config.projectId} and store its key and your config as secrets of ${repo}`);
  note(`Pushes to main on ${repo} will build, test, and deploy to ${config.projectId}.`);
  if (!(await yes("Set it up?"))) return;

  const projectId = config.projectId;
  const accountId = "bibliograph-deploy";
  const email = `${accountId}@${projectId}.iam.gserviceaccount.com`;
  const iam = "https://iam.googleapis.com/v1";
  try {
    await google("POST", `${iam}/projects/${projectId}/serviceAccounts`, { accountId, serviceAccount: { displayName: "Bibliograph deploys (GitHub Actions)" } });
  } catch (error) {
    if (error.status !== 409) throw error; // 409: already exists
  }
  // Just enough to deploy hosting and Firestore rules.
  const roles = ["roles/firebasehosting.admin", "roles/firebaserules.admin", "roles/serviceusage.serviceUsageConsumer", "roles/firebase.viewer"];
  const crm = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`;
  const policy = await google("POST", `${crm}:getIamPolicy`, {});
  const member = `serviceAccount:${email}`;
  for (const role of roles) {
    const binding = policy.bindings?.find((b) => b.role === role);
    if (binding) {
      if (!binding.members.includes(member)) binding.members.push(member);
    } else (policy.bindings ??= []).push({ role, members: [member] });
  }
  await google("POST", `${crm}:setIamPolicy`, { policy });

  let key;
  try {
    key = await google("POST", `${iam}/projects/${projectId}/serviceAccounts/${email}/keys`, {});
  } catch (error) {
    note(`Google didn't allow a deploy key (${error.message}). Some organizations block them; personal accounts usually don't.`);
    return;
  }
  const keyJson = Buffer.from(key.privateKeyData, "base64").toString("utf8");
  const set = (kind, name, body) => {
    const result = spawnSync("gh", [kind, "set", name, "--repo", repo], { input: body, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`gh ${kind} set ${name} failed: ${result.stderr}`);
  };
  set("secret", "FIREBASE_SERVICE_ACCOUNT", keyJson);
  set("variable", "BIBLIOGRAPH_CONFIG", JSON.stringify(config));
  ok(`Secrets saved to ${repo}. The next push to main deploys (see .github/workflows/deploy.yml).`);
}

// --- Main -------------------------------------------------------------------------------------

async function main() {
  console.log(bold("\nSet up your own Bibliograph\n"));
  console.log(DRY ? "Dry run: nothing will be created or changed.\n" : "Every step checks what exists first, so it's safe to rerun.\n");

  const email = await signIn();
  const projectId = await chooseProject(email);
  const firebaseConfig = await webApp(projectId);
  const apisOn = await enableApis(projectId);
  await firestore(projectId);
  const appUrl = hostingSite(projectId);

  if (!DRY && firebaseConfig) {
    step("Save bibliograph.config.json");
    writeConfig({ projectId, appUrl, firebase: firebaseConfig });
    ok("Saved (gitignored: it describes this copy only)");
    run("scripts/configure-extension.mjs");
  }

  await googleSignIn(projectId);

  if (!flag("no-deploy")) {
    step("Build and deploy");
    if (DRY) would("build the app and deploy hosting + Firestore rules");
    else run("scripts/deploy.mjs");
  }

  if (flag("github") || (!DRY && (await yes("\nAlso deploy automatically on every push to GitHub?", false)))) {
    const config = readConfig();
    if (config) await github(config);
    else if (DRY) await github({ projectId });
  }

  console.log(`\n${bold("Done.")} ${DRY ? "(dry run)" : `Open ${appUrl} and sign in.`}`);
  if (!apisOn && !DRY) note("If the app says the Drive API is off, turn it on with the link above and reload.");
  console.log(dim("Change the code, try it with `npm run dev`, publish with `npm run deploy`. More: docs/SELF_HOSTING.md\n"));
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error.message}\n  Fix the problem above and rerun \`npm run setup\` — finished steps are skipped.`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
