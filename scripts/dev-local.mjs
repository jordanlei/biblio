// One command for local testing without a real Google account:
// Firebase Auth + Firestore emulators, the mock Drive server, and Vite in emulator mode.
// Requires Java 11+ on PATH for the Firestore emulator (e.g. `brew install openjdk`).
import { spawn } from "node:child_process";

const webPort = process.env.WEB_PORT ?? "5173";
let stopping = false;
const children = [];

function start(name, cmd, args, onLine) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const print = (data) =>
    String(data)
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        console.log(`[${name}] ${line}`);
        onLine?.(line);
      });
  child.stdout.on("data", print);
  child.stderr.on("data", print);
  child.on("exit", (code) => {
    console.log(`[${name}] exited with ${code}`);
    // If one service dies (e.g. a port is taken), don't leave the others half-running.
    if (!stopping) stop(code || 1);
  });
  children.push(child);
}

start("drive", "node", ["scripts/dev-drive-server.mjs"]);
let webStarted = false;
start("emulators", "npx", ["firebase", "emulators:start", "--only", "auth,firestore", "--project", "demo-bibliograph"], (line) => {
  // Serve the app only once the emulators accept connections, so "ready" really means ready.
  if (webStarted || !line.includes("All emulators ready")) return;
  webStarted = true;
  start("web", "npm", ["--workspace", "apps/web", "run", "dev", "--", "--mode", "emulator", "--port", webPort, "--strictPort"]);
});

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  // SIGINT lets the Firebase CLI shut its Java emulator down instead of orphaning it.
  const alive = children.filter((child) => child.exitCode === null);
  alive.forEach((child) => child.kill("SIGINT"));
  let pending = alive.length;
  if (!pending) process.exit(code);
  alive.forEach((child) => child.on("exit", () => --pending === 0 && process.exit(code)));
  setTimeout(() => process.exit(code), 15_000).unref();
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
