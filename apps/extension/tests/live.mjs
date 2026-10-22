// Live check of the real extension against real paper pages: npm run test:extension:live
// Loads apps/extension/build into Chromium, opens each page in tests/paper-cases.json (and the
// gitignored paper-cases.local.json, if present), and runs exactly what "Save to Biblio" runs:
// the worker's readTab() and, when a case expects a PDF, the in-tab publisher fetch.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const build = fileURLToPath(new URL("../build/", import.meta.url));
const tests = fileURLToPath(new URL("./", import.meta.url));
const read = (name) => (existsSync(`${tests}${name}`) ? JSON.parse(readFileSync(`${tests}${name}`, "utf8")) : []);
const only = process.argv[2];
const cases = [...read("paper-cases.json"), ...read("paper-cases.local.json")].filter((c) => !only || c.url.includes(only));
const seen = new Set();

const profile = mkdtempSync(join(tmpdir(), "biblio-live-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: !process.env.HEADED,
  // Headless Chromium names itself in its user agent, which some publishers refuse outright.
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`, "--disable-blink-features=AutomationControlled"]
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
let failures = 0;
let blocked = 0;
// PubMed, ScienceDirect and others show automated browsers a CAPTCHA that a person's Chrome never
// sees. Those pages can't be judged from here; they are reported, not failed.
const BOT_CHECK = /captcha|just a moment|checking your browser|are you a robot|^(pubmed|pmc)\.ncbi\.nlm\.nih\.gov$/i;

for (const expected of cases) {
  if (seen.has(expected.url)) continue;
  seen.add(expected.url);
  const page = await context.newPage();
  const problems = [];
  let paper = null;
  try {
    await page.goto(expected.url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const title = await page.title();
    if (BOT_CHECK.test(title) || BOT_CHECK.test(await page.evaluate(() => document.body?.innerText.slice(0, 300) ?? ""))) {
      blocked += 1;
      console.log(`- ${expected.url}\n    blocked by a bot check in the automated browser ("${title}"); check it in your own Chrome`);
      await page.close();
      continue;
    }
    const result = await worker.evaluate(async ({ url, wantPdf }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((t) => t.url && (t.url === url || t.url.startsWith(url.split("?")[0])));
      if (!tab) return { error: `no tab for ${url}` };
      const paper = await readTab(tab);
      // The app tries the translator's PDF, then PMC's own address for a PMCID (pdfFetch.ts).
      const pdfUrl = paper?.pdfUrl || (paper?.pmcid ? `https://pmc.ncbi.nlm.nih.gov/articles/${paper.pmcid}/pdf/` : "");
      let pdf = null;
      let pdfError = "";
      if (wantPdf && pdfUrl) {
        // The same path a save takes: capture token, in-tab fetch, worker fetch, challenge retry.
        const captureToken = await registerCapturedPdf(pdfUrl, tab);
        const fetched = await fetchCapturedOrTrusted({ url: pdfUrl, captureToken }).catch((error) => ((pdfError = String(error?.message ?? error)), null));
        pdf = fetched ? Math.round((fetched.base64.length * 3) / 4) : 0;
        if (!fetched) {
          const [peek] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [pdfUrl], func: async (url) => (await (await fetch(url)).text()).slice(0, 4000) }).catch(() => [{}]);
          if (/recaptcha|challengepage|just a moment|are you a robot/i.test(peek?.result ?? "")) pdfError = "bot check";
        }
      }
      return { paper, pdf, pdfUrl, pdfError };
    }, { url: page.url(), wantPdf: Boolean(expected.pdf) });
    if (result.error) throw new Error(result.error);
    paper = result.paper;
    if (!paper?.isPaper) problems.push("no paper detected");
    if (expected.translator && paper?.translator !== expected.translator) problems.push(`translator ${paper?.translator}, expected ${expected.translator}`);
    if (expected.title && paper?.title?.toLowerCase().replace(/\W+/g, " ").trim() !== expected.title.toLowerCase().replace(/\W+/g, " ").trim()) problems.push(`title "${paper?.title}"`);
    if (!paper?.authors?.length) problems.push("no authors");
    if (expected.firstAuthor && !paper?.authors?.[0]?.startsWith(expected.firstAuthor)) problems.push(`first author "${paper?.authors?.[0]}"`);
    if (typeof expected.pdf === "string" && paper?.pdfUrl !== expected.pdf) problems.push(`pdfUrl ${paper?.pdfUrl}, expected ${expected.pdf}`);
    if (expected.pdf && !result.pdfUrl) problems.push("no PDF link");
    if (expected.pdf && result.pdfError === "bot check") {
      paper.pdfNote = ` · PDF ${result.pdfUrl} hit a bot check in the automated browser; check it in your own Chrome`;
    } else if (expected.pdf && result.pdfUrl && !result.pdf) problems.push(`PDF ${result.pdfUrl} didn't download (${result.pdfError})`);
    if (expected.pdf && result.pdf) paper.pdfBytes = result.pdf;
  } catch (error) {
    problems.push(String(error?.message ?? error).split("\n")[0]);
  }
  failures += problems.length ? 1 : 0;
  const summary = paper ? `${paper.translator} · ${paper.authors?.slice(0, 2).join("; ")}${paper.authors?.length > 2 ? " et al." : ""} (${paper.year ?? "?"}) ${paper.title?.slice(0, 60)}${paper.pdfBytes ? ` · PDF ${(paper.pdfBytes / 1e6).toFixed(1)} MB` : ""}${paper.pdfNote ?? ""}` : "";
  console.log(`${problems.length ? "✖" : "✔"} ${expected.url}\n    ${summary}${problems.length ? `\n    ${problems.join("\n    ")}` : ""}`);
  await page.close();
}

await context.close();
rmSync(profile, { recursive: true, force: true });
console.log(`\n${seen.size - failures - blocked}/${seen.size - blocked} pages captured as expected${blocked ? `, ${blocked} blocked by bot checks` : ""}`);
process.exit(failures ? 1 : 0);
