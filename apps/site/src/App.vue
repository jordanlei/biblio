<script setup lang="ts">
// Biblio's project home page (Firebase Hosting). Biblio isn't a hosted service: this page makes the case,
// shows the features, and sends people to setup/. Captures come from apps/site/scripts/capture.mjs.
import { ref } from "vue";
import AppIcon from "../../web/src/components/AppIcon.vue";
import FaqItem from "./components/FaqItem.vue";
import LandingVideo from "./components/LandingVideo.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { BASE, PRIVACY_URL, REPO_URL, SETUP_URL, docUrl } from "./site";

// The feature grid: each card opens a dialog with its demo. Captures come from capture.mjs.
type Feature = {
  id: string;
  icon: string;
  eyebrow: string;
  title: string;
  text: string;
  video?: { name: string; width: number; height: number };
};
const features: Feature[] = [
  {
    id: "search",
    icon: "search",
    eyebrow: "Search",
    title: "Find papers without leaving.",
    text: "Search papers by topic, title, or author, and note why you’re saving one. You can also paste DOIs or arXiv IDs, import a .bib, or enter a paper manually.",
    video: { name: "search", width: 600, height: 326 }
  },
  {
    id: "organize",
    icon: "library",
    eyebrow: "Organize",
    title: "Three shelves, one keypress.",
    text: "Inbox, Skim, Read — press 1 to 3. New papers wait in the Inbox until you mark them done; anything unmarked is kept for reference. Anything more specific is a tag. Folders hold stable projects.",
    video: { name: "organize", width: 600, height: 618 }
  },
  {
    id: "review",
    icon: "note",
    eyebrow: "Review",
    title: "Notes beside the paper.",
    text: "Write in Markdown next to the abstract and the PDF, without opening another app. Notes save as you type, into your own Drive.",
    video: { name: "review", width: 600, height: 468 }
  },
  {
    id: "link",
    icon: "link",
    eyebrow: "Link",
    title: "Papers that know each other.",
    text: "Type @[ to link a paper from any note. The linked paper then lists every note that mentions it, with the sentence around the link.",
    video: { name: "linking", width: 600, height: 468 }
  },
  {
    id: "write",
    icon: "edit",
    eyebrow: "Write",
    title: "Think across papers.",
    text: "A research note is freeform Markdown for a question or a project. Link the papers that bear on it and they gather themselves.",
    video: { name: "research-notes", width: 600, height: 585 }
  },
  {
    id: "extension",
    icon: "upload",
    eyebrow: "Browser extension",
    title: "Save papers as you browse.",
    text: "On a paper page, the Chrome extension reads the paper’s details with Zotero’s translators and opens your Biblio to save it, with the PDF when one is available — including subscription PDFs your browser can already open."
  }
];

const extensionSteps = [
  { icon: "search", title: "Find a paper", text: "Open an article or PDF in Chrome." },
  { icon: "upload", title: "Save to Biblio", text: "Click the extension, or use the page’s right-click menu." },
  { icon: "drive", title: "It lands in your Inbox", text: "Your app saves the paper, and its PDF, to your Drive." }
];

const extras = [
  { icon: "quote", text: "references.bib, plus one .bib per folder, stays current for LaTeX and Overleaf" },
  { icon: "link", text: "See which papers in your library cite each other" },
  { icon: "inbox", text: "Follow authors and topics; new work arrives in the Inbox" },
  { icon: "copy", text: "Find and merge duplicates, such as a preprint and its published version" },
  { icon: "note", text: "LaTeX math in notes" },
  { icon: "pdf", text: "Find and attach available PDFs" },
  { icon: "clock", text: "Edits queue offline and sync when you reconnect" },
  { icon: "search", text: "⌘K to jump anywhere" },
  { icon: "upload", text: "Import from Zotero, Mendeley, or a .bib" },
  { icon: "settings", text: "Themes, fonts, and text size" }
];

// One feature dialog for the whole grid; open picks which feature it shows.
const dialog = ref<HTMLDialogElement | null>(null);
const active = ref(0);
function openFeature(index: number) {
  active.value = index;
  dialog.value?.showModal();
}
function step(by: number) {
  active.value = (active.value + by + features.length) % features.length;
}
function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close();
}

// Verified against each product's own documentation, October 2026: docs/COMPARISON.md.
// Only the rows where Biblio differs; the rest are summarized beneath the table.
type Mark = "yes" | "partly" | "no";
const markGlyph: Record<Mark, string> = { yes: "✓", partly: "~", no: "✕" };
const markLabel: Record<Mark, string> = { yes: "Yes", partly: "Partly", no: "No" };
const compareColumns = ["Biblio", "Zotero", "EndNote", "Paperpile"];
const compareRows: Array<{ label: string; cells: Array<{ mark: Mark; note: string }> }> = [
  { label: "Open source", cells: [
    { mark: "yes", note: "MIT — read it, fork it, change it" },
    { mark: "yes", note: "AGPL" },
    { mark: "no", note: "Proprietary" },
    { mark: "no", note: "Proprietary" } ] },
  { label: "Free", cells: [
    { mark: "yes", note: "You host it, so there’s nobody to bill you" },
    { mark: "partly", note: "Paid storage above 300 MB" },
    { mark: "no", note: "Paid licence" },
    { mark: "no", note: "Paid subscription" } ] },
  { label: "You run the app", cells: [
    { mark: "yes", note: "Deployed to your own project; change any part" },
    { mark: "partly", note: "Source is open; sync is Zotero’s service" },
    { mark: "no", note: "Vendor-run" },
    { mark: "no", note: "Vendor-run" } ] },
  { label: "You own the data", cells: [
    { mark: "yes", note: "Papers, notes, tags, links — all in your Drive" },
    { mark: "partly", note: "Files and database on your machine" },
    { mark: "partly", note: "Files and database on your machine" },
    { mark: "no", note: "PDFs in your Drive; the rest is Paperpile’s" } ] },
  { label: "Survives its vendor", cells: [
    { mark: "yes", note: "Files stay in Drive; rebuild a copy from a .zip" },
    { mark: "partly", note: "Local library, but sync needs Zotero’s servers" },
    { mark: "partly", note: "Local library, in a proprietary format" },
    { mark: "no", note: "Library lives on Paperpile’s servers" } ] },
  { label: "Readable storage", cells: [
    { mark: "yes", note: "Plain files named for what they are" },
    { mark: "partly", note: "SQLite; attachments under random keys" },
    { mark: "no", note: "Proprietary .enl library" },
    { mark: "no", note: "Cloud records, reached through the app" } ] },
  { label: "Links between notes", cells: [
    { mark: "yes", note: "@[ links in any note, with backlinks in context" },
    { mark: "partly", note: "“Related” links, separate from note text" },
    { mark: "partly", note: "Citing articles via Web of Science" },
    { mark: "no", note: "Not built in" } ] },
  { label: "Privacy", cells: [
    { mark: "yes", note: "No account, no analytics; lookups go straight from your browser" },
    { mark: "partly", note: "Sync off by default; servers log IPs for 90 days" },
    { mark: "partly", note: "Clarivate’s corporate privacy policy" },
    { mark: "partly", note: "Store listing declares usage data linked to you" } ] }
];
</script>

<template>
  <main class="landing">
    <SiteHeader />

    <section class="hero">
      <div class="pitch">
        <h1 class="display">A reference manager that's actually yours.</h1>
        <p class="lede">Open-source code you run yourself. Your papers, notes, and PDFs stay in your own Google Drive, as files you can read without it.</p>
        <div class="cta">
          <div class="row">
            <a class="btn primary lg" :href="SETUP_URL">Set up your own</a>
            <a class="btn lg" :href="REPO_URL">View the code</a>
          </div>
          <p class="fine">Self-hosted in your own Google account.</p>
        </div>
      </div>
      <figure class="hero-visual shot">
        <img :src="`${BASE}landing/library.jpg?v=20261119b`" width="2560" height="1600" alt="Biblio's paper library and detail panel, shown with sample papers." />
      </figure>
    </section>

    <section class="features" id="features">
      <p class="eyebrow">What it does</p>
      <h2 class="display">Collect, read, and connect papers.</h2>
      <div class="feature-grid">
        <button v-for="(item, i) in features" :key="item.id" :id="item.id" type="button" class="feature-card" @click="openFeature(i)">
          <span class="thumb" :class="{ steps: !item.video }">
            <img v-if="item.video" :src="`${BASE}landing/${item.video.name}-poster.jpg?v=20261119b`" alt="" loading="lazy" />
            <span v-else class="thumb-steps"><AppIcon v-for="s in extensionSteps" :key="s.title" :name="s.icon" :size="22" /></span>
          </span>
          <span class="card-copy">
            <span class="eyebrow"><AppIcon :name="item.icon" :size="14" /> {{ item.eyebrow }}</span>
            <strong>{{ item.title }}</strong>
            <span class="watch">{{ item.video ? "Watch the demo" : "How it works" }} →</span>
          </span>
        </button>
      </div>

      <ul class="extras">
        <li v-for="item in extras" :key="item.text"><AppIcon :name="item.icon" :size="16" /> {{ item.text }}</li>
      </ul>
    </section>

    <dialog ref="dialog" class="feature-dialog" aria-labelledby="feature-title" @click="closeOnBackdrop">
      <div class="dialog-body">
        <div class="dialog-head">
          <p class="eyebrow">{{ features[active].eyebrow }}</p>
          <button type="button" class="icon-btn" aria-label="Close" @click="dialog?.close()"><AppIcon name="x" :size="18" /></button>
        </div>
        <h3 id="feature-title" class="display">{{ features[active].title }}</h3>
        <p class="dialog-text">{{ features[active].text }}</p>
        <figure v-if="features[active].video" class="shot">
          <LandingVideo :key="features[active].id" :name="features[active].video!.name" :width="features[active].video!.width"
            :height="features[active].video!.height" :label="features[active].text" />
        </figure>
        <ol v-else class="extension-steps">
          <li v-for="s in extensionSteps" :key="s.title"><AppIcon :name="s.icon" :size="20" /><span><strong>{{ s.title }}</strong><small>{{ s.text }}</small></span></li>
        </ol>
        <p v-if="!features[active].video" class="fine">Chrome only. Setup builds it for your address; install it on each computer in developer mode.
          <a :href="`${SETUP_URL}#another-device`">Install it</a></p>
        <div class="dialog-nav">
          <button type="button" class="btn" @click="step(-1)"><AppIcon name="chevron-left" :size="16" /> {{ features[(active + features.length - 1) % features.length].eyebrow }}</button>
          <button type="button" class="btn" @click="step(1)">{{ features[(active + 1) % features.length].eyebrow }} <AppIcon name="chevron-right" :size="16" /></button>
        </div>
      </div>
    </dialog>

    <section id="how-it-works" class="how">
      <h2 class="display">How it works</h2>
      <p class="lead">Biblio isn't a service you sign up for. It's code that sets up your own reference manager, inside your own Google account.</p>

      <div class="arch">
        <div class="box code">
          <AppIcon name="link" :size="18" />
          <strong>This code</strong>
          <small>Open source, on GitHub</small>
        </div>

        <div class="deploys"><span>deploys</span></div>

        <div class="yours">
          <p class="yours-label">Everything below is in your own Google account</p>
          <div class="pair">
            <div class="box">
              <AppIcon name="settings" :size="18" />
              <strong>Your Firebase</strong>
              <small>Hosting, sign-in, and a search index</small>
            </div>
            <div class="box">
              <AppIcon name="drive" :size="18" />
              <strong>Your Drive</strong>
              <small>The library itself, as plain files</small>
            </div>
          </div>
          <div class="link-up" aria-hidden="true"></div>
          <div class="box app">
            <AppIcon name="search" :size="18" />
            <strong>Your web app</strong>
            <small>At <code>your-id.web.app</code> — talks straight to both. No server in between.</small>
          </div>
        </div>
      </div>

      <p class="aside">
        Paper lookups go to public catalogs from your browser. Your copy uses Firebase for sign-in and its search index, and Google Drive for your library.
        <a :href="PRIVACY_URL">Read the privacy details</a>
      </p>
    </section>

    <section class="compare" id="compare">
      <p class="eyebrow">Compared</p>
      <h2 class="display">Where Biblio is different.</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">What it does</span></th>
              <th v-for="name in compareColumns" :key="name" scope="col" :class="{ us: name === 'Biblio' }">{{ name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td v-for="(cell, i) in row.cells" :key="i" :class="{ us: i === 0 }">
                <span class="mark" :class="cell.mark" :aria-label="markLabel[cell.mark]">{{ markGlyph[cell.mark] }}</span>
                <span class="note">{{ cell.note }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="compare-notes">
        <p><strong>The same in all four:</strong> searching for papers, a browser extension for saving them, and BibTeX — though Biblio’s .bib is always current, with no export step.</p>
        <p class="ahead"><strong>Where the others are ahead:</strong> Word and Google Docs plugins, PDF annotation, and mobile apps.</p>
        <p class="fine">Checked against each product’s own documentation, October 2026. <a :href="docUrl('COMPARISON.md')">Sources</a></p>
      </div>
    </section>

    <section class="run">
      <div class="run-head">
        <p class="eyebrow">Set up your own</p>
        <h2 class="display">Set up your own Biblio.</h2>
        <p>You need a Google account, Node.js, and git. The setup tutorial walks through creating and deploying your own copy.</p>
      </div>
      <pre class="terminal">git clone {{ REPO_URL }}.git
cd biblio
npm install
npm run setup</pre>
      <div class="run-cta">
        <a class="btn primary lg" :href="SETUP_URL">Open the setup tutorial</a>
        <a class="link" :href="`${REPO_URL}/fork`">Fork it first</a>
      </div>
    </section>

    <section class="faq-section">
      <h2 class="display">Questions</h2>
      <div class="faq">
        <FaqItem question="Is this really free?">
          The app is open source and can run on Google’s free Spark plan, subject to its usage limits. The browser extension includes AGPL-licensed Zotero components.
        </FaqItem>
        <FaqItem question="What happens if this project is abandoned?">
          Your copy runs in your own Google account, and your library remains in Drive as files you can read or export. You also have the code to maintain your copy.
        </FaqItem>
        <FaqItem question="Do I need to know how to code?">
          No programming is required. Setup uses the command line, and the <a :href="SETUP_URL">tutorial</a> walks through every screen. Knowing how to code just means you can also change things.
        </FaqItem>
        <FaqItem question="Can I move my library between copies?">
          Yes. Download it as a .zip from Settings and import it into the other copy. If you have no working copy at all, download the folder from Google Drive — that's a .zip too — and import that.
        </FaqItem>
        <FaqItem question="What does Biblio see of my Drive?">
          Only the files it creates. That's Google's narrowest Drive permission, which is also why signing in shows no warning screen.
        </FaqItem>
        <FaqItem question="Who can see my library?">
          Your copy uses your Google account and your own Firebase project. There is no central Biblio service or analytics. Paper lookups go straight from your browser to public catalogs, which see your IP and what you asked
          about — <a :href="PRIVACY_URL">the privacy page</a> spells out exactly what is and isn't private.
        </FaqItem>
        <FaqItem question="Why only three reading shelves?">
          Because more shelves become a filing problem of their own. Inbox, Skim, and Read cover how much attention a paper needs, and an unmarked paper is simply kept for reference; everything else, such as a project or topic, can be a tag or folder.
        </FaqItem>
        <FaqItem question="Can I add my own features?">
          Yes, and keep them through updates. Your code goes in <code>apps/web/src/custom/</code>, which upstream never touches, and can add pages, sidebar links, and panels. See <a :href="docUrl('EXTENDING.md')">EXTENDING.md</a>.
        </FaqItem>
        <FaqItem question="Is there a browser extension?">
          Yes, for Chrome. On a paper page it reads the paper’s details with Zotero’s own translators and opens your Biblio to save it, with the PDF when one is available. It reads a page only when you click it. Setup builds it for your copy’s address; install it on each computer in developer mode (<a :href="`${SETUP_URL}#another-device`">how</a>).
        </FaqItem>
        <FaqItem question="Can I use it on my phone?">
          It's a web app, so it opens on a phone, but it's built for a desk. There's no mobile app, and no PDF annotation or Word plugin yet.
        </FaqItem>
      </div>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.landing {
  --max: 1160px;
  min-height: 100vh;
  background: var(--bg);
  overflow-x: hidden;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 56px;
  align-items: center;
  max-width: calc(var(--max) + 160px);
  margin: 0 auto;
  padding: 40px 32px 88px;
}

h1 {
  font-size: calc(clamp(36px, 4.4vw, 58px) * var(--text-scale));
  line-height: 1.04;
  letter-spacing: -0.025em;
}

.lede {
  margin-top: 22px;
  max-width: 34ch;
  font-family: var(--font-serif);
  font-size: calc(20px * var(--text-scale));
  line-height: 1.5;
  color: var(--text-2);
}

.cta {
  display: grid;
  justify-items: start;
  gap: 10px;
  margin: 30px 0 14px;
}

.fine {
  font-size: calc(13.5px * var(--text-scale));
  color: var(--text-3);
}

.shot {
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.shot img,
.shot :deep(video) {
  display: block;
  width: 100%;
  height: auto;
}

.hero-visual {
  position: relative;
  margin: 0;
}

.how,
.features,
.compare,
.run,
.faq-section {
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px;
  border-top: 1px solid var(--border);
}

.how h2,
.features h2,
.compare h2,
.faq-section h2 {
  margin: 8px 0 22px;
  font-size: calc(clamp(26px, 2.8vw, 36px) * var(--text-scale));
  line-height: 1.15;
}

.lead {
  max-width: 60ch;
  margin-bottom: 32px;
  font-family: var(--font-serif);
  font-size: calc(19px * var(--text-scale));
  line-height: 1.5;
  color: var(--text-2);
}

/* Code → your copy → your Drive. */

.run-cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-top: 24px;
}

.lead a,
.more a,
.run-cta a.link {
  color: var(--accent);
}

.more {
  margin-top: 18px;
}

.faq {
  display: grid;
  gap: 4px;
  max-width: 760px;
}

.faq dt {
  margin-top: 16px;
  color: var(--text);
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 650;
}

.faq dd {
  margin: 0;
  font-size: calc(15.5px * var(--text-scale));
  line-height: 1.6;
  color: var(--text-2);
}

/* The architecture diagram: this code → your Firebase + your Drive ↔ your web app. */
.arch {
  display: grid;
  justify-items: center;
  margin: 32px 0 20px;
}

.box {
  display: grid;
  justify-items: center;
  gap: 2px;
  width: min(320px, 100%);
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
  text-align: center;
}

.box :deep(svg) {
  margin-bottom: 4px;
  color: var(--accent);
}

.box strong {
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 650;
}

.box small {
  color: var(--text-2);
  font-size: calc(13.5px * var(--text-scale));
  line-height: 1.45;
}

.box code {
  font-size: 0.92em;
}

/* "deploys", on a downward arrow. */
.deploys {
  position: relative;
  width: 2px;
  height: 58px;
  background: var(--accent);
}

.deploys::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: -5px;
  border: 6px solid transparent;
  border-top: 8px solid var(--accent);
  border-bottom: 0;
}

.deploys span {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  white-space: nowrap;
  color: var(--accent);
  font-size: calc(13px * var(--text-scale));
  font-weight: 600;
}

.yours {
  display: grid;
  justify-items: center;
  width: 100%;
  padding: 16px;
  border: 2px dashed var(--accent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--select) 50%, transparent);
}

.yours-label {
  margin-bottom: 14px;
  color: var(--text-2);
  font-size: calc(13px * var(--text-scale));
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 300px));
  justify-content: center;
  gap: 16px;
}

.pair .box {
  width: auto;
}

/* The line joining the pair above to the app below. */
.link-up {
  width: 2px;
  height: 34px;
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}

.box.app {
  width: min(420px, 100%);
  border-color: var(--accent);
}

.arch {
  margin: 28px 0 18px;
}

.extras {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 32px;
  margin: 8px 0 0;
  padding: 24px 0 0;
  border-top: 1px solid var(--border);
  list-style: none;
}

.extras li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-2);
  font-size: calc(14.5px * var(--text-scale));
}

.extras :deep(svg) {
  flex: none;
  color: var(--accent);
}

.faq {
  max-width: 820px;
  border-top: 1px solid var(--border);
}

.lead a,
.aside a,
.run-cta a.link {
  color: var(--accent);
}

.aside {
  margin-top: 20px;
  color: var(--text-3);
  font-size: calc(14.5px * var(--text-scale));
  line-height: 1.6;
}

code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: 0.86em;
  color: var(--text);
}

.cta .row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.run {
  padding-bottom: 96px;
}

.run-head {
  max-width: 640px;
}

.run-head h2 {
  margin: 8px 0 14px;
  font-size: calc(clamp(26px, 2.8vw, 36px) * var(--text-scale));
  line-height: 1.15;
}

.run-head p:not(.eyebrow) {
  font-size: calc(17px * var(--text-scale));
  line-height: 1.6;
  color: var(--text-2);
}

.terminal {
  margin: 0;
  padding: 18px 22px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
  font-family: var(--font-mono);
  font-size: calc(13.5px * var(--text-scale));
  line-height: 1.7;
}

.extension-steps {
  display: grid;
  gap: 12px;
}
.extension-steps > div {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.extension-steps :deep(svg) { flex: none; color: var(--accent); }
.extension-steps span { display: grid; gap: 4px; }
.extension-steps small { color: var(--text-2); font-size: calc(14px * var(--text-scale)); line-height: 1.45; }


.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* What it does: a grid of cards; each opens the feature dialog. */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 36px;
}

.feature-card {
  display: grid;
  grid-template-rows: auto 1fr;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.feature-card:hover,
.feature-card:focus-visible {
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

.thumb {
  display: block;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top left;
}

.thumb-steps {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 28px;
  color: var(--accent);
}

.card-copy {
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 16px 18px 18px;
}

.card-copy .eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-copy strong {
  font-family: var(--font-serif);
  font-size: calc(18px * var(--text-scale));
  font-weight: 600;
  line-height: 1.3;
}

.watch {
  color: var(--accent);
  font-size: calc(13.5px * var(--text-scale));
}

.feature-dialog {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
  overflow: auto;
}

.feature-dialog .shot :deep(video) {
  width: auto;
  max-width: 100%;
  max-height: 52vh;
  margin: 0 auto;
}

.feature-dialog .shot {
  box-shadow: none;
}

.feature-dialog::backdrop {
  background: rgba(24, 24, 27, 0.45);
}

.dialog-body {
  display: grid;
  gap: 14px;
  padding: 22px 26px 24px;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-body h3 {
  font-size: calc(26px * var(--text-scale));
  line-height: 1.2;
}

.dialog-text {
  max-width: 62ch;
  color: var(--text-2);
  font-size: calc(16px * var(--text-scale));
  line-height: 1.6;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}

.icon-btn:hover {
  background: var(--surface-2);
}

.dialog-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.extension-steps {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.extension-steps li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.extension-steps :deep(svg) { flex: none; color: var(--accent); }
.extension-steps span { display: grid; gap: 3px; }
.extension-steps small { color: var(--text-2); font-size: calc(14px * var(--text-scale)); line-height: 1.45; }

/* Comparison: Biblio's column tinted, marks as chips so differences read at a glance. */
.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: calc(14px * var(--text-scale));
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

thead th {
  font-family: var(--font-serif);
  font-size: calc(16px * var(--text-scale));
  font-weight: 600;
}

tbody th {
  width: 17%;
  font-weight: 600;
}

td {
  width: 20.75%;
  color: var(--text-3);
}

.us {
  background: var(--accent-soft);
  color: var(--text);
}

thead th.us {
  border-radius: 10px 10px 0 0;
  color: var(--accent-ink);
}

.mark {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-bottom: 6px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.note {
  display: block;
  line-height: 1.45;
}

.mark.yes {
  background: var(--accent);
  color: var(--accent-text);
}

.mark.partly {
  border: 1.5px solid var(--text-3);
  color: var(--text-2);
}

.mark.no {
  background: var(--surface-2);
  color: var(--text-3);
}

.compare-notes {
  display: grid;
  gap: 10px;
  max-width: 72ch;
  margin-top: 22px;
  color: var(--text-2);
  font-size: calc(15px * var(--text-scale));
  line-height: 1.55;
}

.compare-notes .ahead {
  padding: 12px 16px;
  border-left: 3px solid var(--text-3);
  background: var(--surface-2);
  border-radius: 0 8px 8px 0;
}

.compare-notes a {
  color: var(--accent);
}

@media (max-width: 900px) {
  .hero,
  .extension,
  .feature,
  
  
  .how,
  .capabilities,
  .extension,
  .features,
  .faq-section,
  .run {
    padding: 40px 16px;
  }

   .extras,
  .pair {
    grid-template-columns: 1fr;
  }

  
}

@media (max-width: 560px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
