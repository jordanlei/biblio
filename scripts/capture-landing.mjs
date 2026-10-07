// Captures the home page's screenshots and videos from a real, running demo.
// How to run it, what it produces, and how to add a capture: docs/CAPTURES.md.
//
//   npm run dev:local                                   # emulators + mock Drive + Vite (needs Java)
//   node scripts/capture-landing.mjs [http://localhost:5173]
//
// Signs in to the local emulators as a fresh user and builds a small library through the UI
// (import, tags, shelves, saved reasons, notes with @[links], PDFs from arXiv, a research note),
// then writes apps/site/public/landing/*.jpg and *.webm (the project website).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const APP = process.argv[2] ?? "http://localhost:5173";
const OUT = new URL("../apps/site/public/landing/", import.meta.url).pathname;
const FPS = 20;
mkdirSync(OUT, { recursive: true });
const bib = readFileSync(new URL("../e2e/fixtures/sample.bib", import.meta.url), "utf8") + "\n" + readFileSync(new URL("../samples/sample.bib", import.meta.url), "utf8");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "light" });
// Hide the "Local" test-mode badge in captures.
await context.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = ".brand-row .chip { display: none !important; }";
    document.head.appendChild(style);
  });
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on("dialog", (d) => d.accept());
const pause = (ms = 400) => page.waitForTimeout(ms);
const noToasts = () => page.waitForFunction(() => !document.querySelector(".toast"), undefined, { timeout: 15_000 }).catch(() => {});
const top = () => page.locator(".shell-main").evaluate((el) => el.scrollTo(0, 0)).catch(() => {});

async function shot(name) {
  await noToasts();
  await page.mouse.move(0, 0);
  await pause(500);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: "jpeg", quality: 78 });
  console.log(`✓ ${name}.jpg`);
}

/** Pixel width from a JPEG's start-of-frame header. */
function jpegWidth(buf) {
  for (let i = 2; i < buf.length; ) {
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return buf.readUInt16BE(i + 7);
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("not a JPEG");
}

/**
 * Record `steps` as OUT/<name>.webm (+ <name>-poster.jpg of the final state). Frames come from
 * Chrome's screencast as JPEGs and are encoded with Playwright's bundled ffmpeg (VP8 WebM).
 * `crop` ({x, y, width, height} in CSS px) keeps only the part of the screen the demo is about.
 */
async function record(name, steps, { width = 1180, height = 740, crop } = {}) {
  const frames = mkdtempSync(join(tmpdir(), `bibliograph-${name}-`));
  await page.setViewportSize({ width, height });
  const region = crop ?? { x: 0, y: 0, width, height };
  const r = Object.fromEntries(Object.entries(region).map(([k, v]) => [k, Math.round(v)]));
  r.width = Math.min(r.width, width - r.x);
  r.height = Math.min(r.height, height - r.y);
  const cdp = await context.newCDPSession(page);
  let index = 0;
  let last = null;
  const start = Date.now();
  const flush = () => {
    // Hold each frame until the next one so the video keeps real-time pacing at a fixed rate.
    const due = Math.round(((Date.now() - start) / 1000) * FPS);
    while (last && index < due) writeFileSync(join(frames, `f${String(index++).padStart(5, "0")}.jpg`), last);
  };
  cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    flush();
    last = Buffer.from(data, "base64");
  });
  await cdp.send("Page.enable");
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width * 2, maxHeight: height * 2, everyNthFrame: 1 });
  await steps();
  await cdp.send("Page.stopScreencast");
  flush();
  await cdp.detach();

  // The bundled ffmpeg is minimal: it reads piped JPEGs (mjpeg) and writes VP8 WebM.
  const dir = readdirSync(join(process.env.HOME, "Library/Caches/ms-playwright")).find((d) => d.startsWith("ffmpeg-"));
  const bin = process.env.FFMPEG ?? join(process.env.HOME, "Library/Caches/ms-playwright", dir, "ffmpeg-mac");
  const files = readdirSync(frames).sort();
  // Chrome may send frames smaller than the 2x we ask for, so scale the crop to the real frame size.
  const k = jpegWidth(readFileSync(join(frames, files[0]))) / width;
  const c = Object.fromEntries(Object.entries(r).map(([key, v]) => [key, Math.floor((v * k) / 2) * 2]));
  execFileSync(
    bin,
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0", "-vf", `crop=${c.width}:${c.height}:${c.x}:${c.y},scale=${Math.min(r.width * 2, 1200) & ~1}:-2`, "-c:v", "libvpx", "-b:v", "2000k", "-qmin", "4", "-qmax", "28", "-an", join(OUT, `${name}.webm`)],
    { input: Buffer.concat(files.map((f) => readFileSync(join(frames, f)))), maxBuffer: 1 << 30 }
  );
  await page.screenshot({ path: join(OUT, `${name}-poster.jpg`), type: "jpeg", quality: 82, clip: r });
  rmSync(frames, { recursive: true, force: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log(`✓ ${name}.webm (${files.length} frames)`);
}

/** Region of the screen between the sidebar and the inspector (or the right edge). */
const listRegion = (height) =>
  page.evaluate((height) => {
    const left = document.querySelector(".sidebar").getBoundingClientRect().right;
    const right = document.querySelector(".inspector")?.getBoundingClientRect().left ?? innerWidth;
    return { x: left, y: 0, width: right - left, height };
  }, height);

/** Flash a keycap with what the key did, so key presses are visible in the video. */
const keycap = (key, label, region) =>
  page.evaluate(
    ({ key, label, region }) => {
      let el = document.getElementById("__keycap");
      if (!el) {
        el = document.createElement("div");
        el.id = "__keycap";
        el.innerHTML = "<kbd></kbd><span></span>";
        document.body.appendChild(el);
        el.style.cssText =
          "position:fixed;z-index:9999;display:flex;gap:10px;align-items:center;padding:7px 14px 7px 7px;border-radius:10px;background:rgba(28,24,20,.9);color:#fff;font:600 15px/1 Inter,system-ui,sans-serif;transform:translateX(-50%);transition:opacity .25s;pointer-events:none";
        el.firstChild.style.cssText = "display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:6px;background:#fff;color:#1c1814;font:700 15px ui-monospace,monospace;box-shadow:0 2px 0 #b9b2a6";
      }
      el.firstChild.textContent = key;
      el.lastChild.textContent = label;
      el.style.left = `${region.x + region.width / 2}px`;
      el.style.top = `${region.y + region.height - 64}px`;
      el.style.opacity = "1";
      clearTimeout(window.__keycapTimer);
      window.__keycapTimer = setTimeout(() => (el.style.opacity = "0"), 1000);
    },
    { key, label, region }
  );

const row = (title) => page.locator(".entry").filter({ has: page.locator(".title", { hasText: title }) });
const inspector = () => page.locator(".inspector");

// --- Build the demo library through the UI ---------------------------------------------------
await page.goto(APP);
await page.waitForFunction(() => "__bibliographTestSignIn" in window);
await page.evaluate(() => window.__bibliographTestSignIn(`demo.${Date.now()}@example.com`, "Rosalind Researcher"));
await page.goto(`${APP}/library`);
await page.getByRole("button", { name: "Start" }).click();
await page.getByRole("button", { name: /Create “Bibliograph Library”/ }).click();
await page.getByText("Skip tour").click();
await page.locator(".tour").waitFor({ state: "detached" });

await page.keyboard.press("a");
await page.getByRole("tab", { name: "Import .bib" }).click();
await page.getByText("…or paste BibTeX").click();
await page.locator("details.paste textarea").fill(bib);
await page.getByRole("button", { name: /Import 8 papers/ }).click();
await page.locator(".entry").nth(7).waitFor();
await noToasts();

async function tag(name, titles) {
  await page.locator("a.nav-item", { hasText: "All papers" }).click();
  for (const title of titles) await row(title).locator(".check").click({ force: true });
  await page.locator(".bulk input[aria-label='Tag selected papers']").fill(name);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Clear" }).click();
}
await tag("population-dynamics", ["LFADS", "Inferring single-trial", "Recurrent Switching"]);
await tag("reading-group", ["Attention Is All You Need", "Human-level control", "Conflict monitoring"]);

async function reason(title, text) {
  await row(title).click();
  const field = inspector().getByLabel("Saved because");
  await field.fill(text);
  await field.press("Tab");
  await pause(200);
}
await reason("LFADS", "Baseline model for my single-trial analysis");
await reason("Recurrent Switching", "How to compare multiple brain regions");
await reason("Inferring single-trial", "Motor cortex validation of LFADS");

async function note(title, parts) {
  await row(title).click();
  await inspector().getByRole("button", { name: /Write notes|Edit/ }).click();
  const area = inspector().locator("textarea");
  for (const part of parts) {
    if (part.startsWith("@[")) {
      await area.pressSequentially(part, { delay: 15 });
      await page.locator(".suggest li").first().waitFor();
      await page.keyboard.press("Enter");
      await pause(150);
    } else await area.pressSequentially(part, { delay: 2 });
  }
  await inspector().getByText("Saved", { exact: true }).waitFor();
  await inspector().getByRole("button", { name: "Done" }).click();
}
await note("LFADS", [
  "Sequential auto-encoder that infers **single-trial** latent dynamics from spikes.\n\n",
  "- Applied to motor cortex in ",
  "@[pand",
  "\n- For multi-region recordings, compare the switching approach in ",
  "@[glaser",
  "\n"
]);

async function findPdf(title) {
  await row(title).click();
  await inspector().getByRole("button", { name: "Find PDF" }).click();
  await inspector().getByRole("link", { name: "Open PDF" }).waitFor({ timeout: 60_000 });
}
await findPdf("LFADS");
await findPdf("Attention Is All You Need");
await page.locator('[data-sync-status][data-phase="saved"]').waitFor({ timeout: 30_000 });
await page.locator("a.nav-item", { hasText: "All papers" }).click();

// --- Video: triage the inbox with number keys -------------------------------------------------
// Wider window so titles fit beside the inspector; the video keeps only the paper list.
await page.setViewportSize({ width: 1440, height: 860 });
await page.locator(".filters").getByRole("button", { name: "Inbox", exact: true }).click();
await top();
await row("Attention Is All You Need").click();
await noToasts();
const inboxRegion = await listRegion(640);
await record(
  "inbox",
  async () => {
    await pause(1000);
    // Each paper leaves the inbox as it's shelved.
    const moves = [
      ["Attention Is All You Need", "5", "Read"],
      ["Human-level control", "3", "Skimming"],
      ["Conflict monitoring", "6", "Reference"],
      ["Reinforcement Learning", "6", "Reference"],
      ["Planning as Inference", "7", "Parked"],
      ["Recurrent Switching", "2", "Read next"]
    ];
    for (const [title, key, label] of moves) {
      await row(title).click();
      await pause(500);
      await page.keyboard.press(key);
      await keycap(key, label, inboxRegion);
      await pause(1100);
    }
    await pause(600);
    await page.locator(".filters").getByRole("button", { name: "Inbox", exact: true }).click(); // back to everything
    await top();
    await pause(2200); // quiet shelves (Reference, Parked) render dimmed
  },
  { width: 1440, height: 860, crop: inboxRegion }
);
await page.setViewportSize({ width: 1280, height: 800 });
for (const [title, key] of [["Inferring single-trial", "4"], ["LFADS", "5"]]) {
  await row(title).click();
  await page.keyboard.press(key);
}
await noToasts();

// --- Screenshot --------------------------------------------------------------------------------
await row("LFADS").click();
await top();
await shot("library");

// --- Video: write a note that links another paper, then follow the link -----------------------
await page.goto(`${APP}/library`);
await row("Inferring single-trial").dblclick();
await page.locator("h1.title").waitFor();
await page.getByRole("button", { name: "Write" }).click();
await top();
await page.setViewportSize({ width: 1180, height: 740 });
const noteColumn = await page.locator(".notes-editor").evaluate((el) => {
  const box = el.getBoundingClientRect();
  return { x: box.x - 24, y: 0, width: box.width + 48, height: innerHeight };
});
await record(
  "linking",
  async () => {
    const area = page.locator(".notes-editor textarea");
    await area.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await pause(900);
    await area.click();
    await area.pressSequentially("Applies the model from ", { delay: 40 });
    await area.pressSequentially("@[sus", { delay: 160 });
    await pause(1600); // the paper picker
    await page.keyboard.press("Enter");
    await area.pressSequentially(" to motor cortex.", { delay: 40 });
    await pause(700);
    await page.getByRole("button", { name: "Preview" }).click();
    await pause(1400);
    const cite = page.locator(".notes-editor .prose a.cite");
    await cite.hover();
    await pause(800);
    await cite.click();
    // On the linked paper: where it's mentioned, with the sentence around it.
    const mentioned = page.getByText("Mentioned in notes").first();
    await mentioned.waitFor();
    await pause(600);
    await mentioned.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    await pause(3000);
  },
  { crop: noteColumn }
);

// --- Video: a research note is just Markdown that links papers --------------------------------
await page.goto(`${APP}/research-notes`);
await page.getByRole("button", { name: "New note" }).first().waitFor();
await page.setViewportSize({ width: 1180, height: 800 });
const notePane = await page.locator(".notes-list").evaluate((el) => {
  const right = el.getBoundingClientRect().right;
  return { x: right, y: 0, width: innerWidth - right, height: innerHeight };
});
await record(
  "research-notes",
  async () => {
    await pause(700);
    await page.locator(".note-main").getByRole("button", { name: "New note" }).click();
    await page.locator(".title-input").waitFor();
    await pause(400);
    await page.keyboard.type("Single-trial population dynamics", { delay: 35 });
    await page.keyboard.press("Enter");
    const text = page.locator(".notes-editor textarea");
    const link = async (query) => {
      await text.pressSequentially(query, { delay: 110 });
      await page.locator(".suggest li").first().waitFor();
      await pause(700);
      await page.keyboard.press("Enter");
    };
    await text.pressSequentially("How much of the latent dynamics can we recover from one trial?\n\n- ", { delay: 22 });
    await link("@[sus");
    await text.pressSequentially(" recovers them from spikes alone\n- Shown in motor cortex: ", { delay: 22 });
    await link("@[pand");
    await text.pressSequentially("\n- For several regions, compare ", { delay: 22 });
    await link("@[glas");
    await pause(500);
    await page.locator(".notes-editor").getByRole("button", { name: "Preview" }).click();
    await pause(900);
    await page.locator(".linked").evaluate((el) => el.scrollIntoView({ block: "end", behavior: "smooth" }));
    await pause(2600);
  },
  { width: 1180, height: 800, crop: notePane }
);

await browser.close();
