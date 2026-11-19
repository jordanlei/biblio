<script setup lang="ts">
// Biblio's project home page (Firebase Hosting). Biblio isn't a hosted service: this page makes the case,
// shows the features, and sends people to setup/. Captures come from apps/site/scripts/capture.mjs.
import AppIcon from "../../web/src/components/AppIcon.vue";
import { features } from "./features";
import FaqItem from "./components/FaqItem.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { BASE, PRIVACY_URL, REPO_URL, SETUP_URL, docUrl } from "./site";


// Bump when the captures in public/landing/ are re-recorded, so browsers fetch the new files.
const CAPTURES = "20261120";

// The library's files as they sit in Drive (docs/LIBRARY_FORMAT.md), with the demo library's names.
const driveTree = [
  { depth: 0, dir: true, name: "Biblio Library", icon: "folder", note: "" },
  { depth: 1, name: "library.json", icon: "note", note: "every paper, as CSL-JSON" },
  { depth: 1, name: "references.bib", icon: "quote", note: "the same papers, as BibTeX" },
  { depth: 1, name: "biblio.json", icon: "settings", note: "folders and format version" },
  { depth: 1, name: "README.md", icon: "note", note: "what this folder is" },
  { depth: 1, dir: true, name: "bib", icon: "folder", note: "one .bib per folder" },
  { depth: 1, dir: true, name: "notes", icon: "folder", note: "" },
  { depth: 2, name: "sussilloLFADSLatentFactor2016.md", icon: "note", note: "notes on a paper" },
  { depth: 2, name: "Single-trial population dynamics.md", icon: "note", note: "a research note" },
  { depth: 1, dir: true, name: "papers", icon: "folder", note: "" },
  { depth: 2, name: "sussilloLFADSLatentFactor2016.pdf", icon: "pdf", note: "" },
  { depth: 2, name: "vaswaniAttentionNeed2017.pdf", icon: "pdf", note: "" }
];

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
    { mark: "no", note: "Paid license" },
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
    { mark: "no", note: "Metadata and notes in a SQLite database; PDFs in folders with random 8-character names" },
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
        <p class="eyebrow hero-kicker">A reference manager for actual research</p>
        <h1 class="display">Make room for the work between papers.</h1>
        <p class="lede">Biblio is a quiet, open-source library for collecting papers, writing notes, and keeping your research in files you can always reach.</p>
        <div class="cta">
          <div class="row">
            <a class="btn primary lg" :href="SETUP_URL">Set up your own</a>
            <a class="text-link" href="#features">See what it does</a>
          </div>
        </div>
      </div>
      <div class="hero-visual">
        <figure class="shot">
          <img :src="`${BASE}landing/library.jpg?v=${CAPTURES}`" width="2560" height="1600" alt="Biblio's paper library and detail panel, shown with sample papers." />
        </figure>
        <figure class="phone">
          <img :src="`${BASE}landing/phone-library.jpg?v=${CAPTURES}`" width="780" height="1688" alt="The same library in Biblio's installed app on a phone." />
        </figure>
      </div>
    </section>

    <ul class="highlights">
      <li><AppIcon name="drive" :size="18" /><strong>Your files, your account</strong><span>Plain files in a Drive folder you control.</span></li>
      <li><AppIcon name="library" :size="18" /><strong>One library everywhere</strong><span>Use it on a laptop, in a browser, or on your phone.</span></li>
      <li><AppIcon name="settings" :size="18" /><strong>Open and adaptable</strong><span>MIT-licensed code, readable storage, no lock-in.</span></li>
    </ul>

    <section class="pillars" id="features">
      <div v-for="(f, i) in features" :id="f.id" :key="f.id" class="pillar" :class="{ flip: i % 2 === 1 }">
        <div class="pillar-copy">
          <p class="eyebrow">{{ f.eyebrow }}</p>
          <h2 class="display">{{ f.title }}</h2>
          <p class="pillar-text">{{ f.text }}</p>
          <ul class="checks">
            <li v-for="point in f.points" :key="point"><AppIcon name="check" :size="16" /> {{ point }}</li>
          </ul>
        </div>
        <figure v-if="f.image" class="shot pillar-media">
          <img :src="`${BASE}landing/${f.image}.jpg?v=${CAPTURES}`" :alt="f.title" loading="lazy" />
        </figure>
        <figure v-else-if="f.visual === 'drive'" class="pillar-media drive" aria-label="The library's files in Google Drive">
          <ul class="tree">
            <li v-for="item in driveTree" :key="item.name" :class="{ dir: item.dir }" :style="{ paddingLeft: `${18 + item.depth * 22}px` }">
              <AppIcon :name="item.dir ? 'folder' : item.icon" :size="16" /> <span>{{ item.name }}</span><small>{{ item.note }}</small>
            </li>
          </ul>
        </figure>
        <figure v-else class="pillar-media plugin" aria-hidden="true">
          <div class="browser">
            <div class="browser-bar"><span class="dots"><i /><i /><i /></span><span class="url">journals.example.org/article/…</span><span class="ext"><AppIcon name="upload" :size="15" /></span></div>
            <div class="browser-page">
              <div class="popup"><strong>Saved to Biblio</strong><span>Latent dynamics of motor cortex · PDF attached</span><em>In your Inbox</em></div>
              <i class="line w80" /><i class="line w60" /><i class="line w90" /><i class="line w70" /><i class="line w85" />
            </div>
          </div>
        </figure>
      </div>
    </section>

    <section class="install" id="install">
      <div class="install-grid">
      <div>
      <h2 class="display">Installable Web App</h2>
      <ol class="install-steps">
        <li><AppIcon name="external" :size="20" /><strong>Open your Biblio</strong><span>In Chrome or Edge on a computer, or Safari on an iPhone.</span></li>
        <li><AppIcon name="download" :size="20" /><strong>Install it</strong><span>Click the install icon in the address bar, or Share → Add to Home Screen.</span></li>
        <li><AppIcon name="library" :size="20" /><strong>Use it</strong><span>It opens in its own window, with the same library on every device.</span></li>
      </ol>
      </div>
      <figure class="phone">
        <img :src="`${BASE}landing/phone-paper.jpg?v=${CAPTURES}`" width="780" height="1688" alt="A paper's details and notes in Biblio's installed app on a phone." loading="lazy" />
      </figure>
      </div>
    </section>

    <section id="how-it-works" class="how">
      <h2 class="display">How it works</h2>
      <p class="lead">There is no Biblio service. The code deploys your own copy into your Google account.</p>

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

      <p class="aside"><a :href="PRIVACY_URL">What stays private</a></p>
    </section>

    <section class="compare" id="compare">
      <p class="eyebrow">If you are choosing a home for your library</p>
      <h2 class="display">A different set of trade-offs.</h2>
      <p class="lead compare-intro">Biblio is not trying to replace every part of a mature reference manager. It is for researchers who value ownership, readable files, and a workflow they can change.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">What it does</span></th>
              <th v-for="name in compareColumns" :key="name" scope="col" :class="{ us: name === 'Biblio' }">{{ name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows.slice(0, 5)" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td v-for="(cell, i) in row.cells" :key="i" :class="{ us: i === 0 }">
                <span class="mark" :class="cell.mark" :aria-label="markLabel[cell.mark]">{{ markGlyph[cell.mark] }}</span>
                <span class="note">{{ cell.note }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="fine compare-notes">This is the short version: ownership and storage are where Biblio is most different. The others are ahead on Word and Google Docs plugins, PDF annotation, and mature mobile apps. <a :href="docUrl('COMPARISON.md')">See the sourced notes</a> for the full comparison and caveats.</p>
    </section>

    <section class="run">
      <div class="run-head">
        <h2 class="display">Setup</h2>
        <p>Needs a Google account, Node.js, and git.</p>
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
          Yes. Install it from the browser (Share → Add to Home Screen) and it opens like an app, with the same library as your computer. It's designed for a desk first, though: there's no PDF annotation or Word plugin yet.
        </FaqItem>
      </div>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.landing {
  --max: 1080px;
  /* Side gutters that grow with the window, so content never runs to the edges. */
  --gutter: clamp(24px, 6vw, 96px);
  min-height: 100vh;
  background: var(--bg);
  overflow-x: hidden;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 56px;
  align-items: center;
  max-width: calc(var(--max) + 2 * var(--gutter));
  margin: 0 auto;
  padding: 48px var(--gutter) 88px;
}

h1 {
  font-size: calc(clamp(32px, 3.3vw, 46px) * var(--text-scale));
  line-height: 1.1;
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
.install,
.compare,
.run,
.faq-section {
  max-width: calc(var(--max) + 2 * var(--gutter));
  margin: 0 auto;
  padding: 104px var(--gutter);
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
  padding: 12px 0 0;
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

/* Under the hero: four short highlights. */
.highlights {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  max-width: calc(var(--max) + 2 * var(--gutter));
  margin: 0 auto 56px;
  padding: 0 var(--gutter);
  list-style: none;
}

.highlights li > :is(a, span),
.highlights li {
  color: var(--text);
  text-decoration: none;
}

.highlights li {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.highlights li:has(a):hover {
  border-color: var(--accent);
}

.highlights li,
.highlights a {
  display: grid;
  gap: 6px;
  align-content: start;
}

.highlights :deep(svg) {
  margin-bottom: 6px;
  color: var(--accent);
}

.highlights span {
  color: var(--text-2);
  font-size: calc(14px * var(--text-scale));
  line-height: 1.45;
}

/* Features: one section each, copy beside its demo, alternating sides, with room to breathe. */
.pillars {
  display: grid;
  gap: 140px;
  max-width: calc(var(--max) + 2 * var(--gutter));
  margin: 0 auto;
  padding: 120px var(--gutter);
  border-top: 1px solid var(--border);
}

.pillar {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 72px;
  align-items: center;
}

.pillar.flip .pillar-copy {
  order: 2;
}

.pillar h2 {
  margin: 12px 0 18px;
  font-size: calc(clamp(30px, 3.4vw, 44px) * var(--text-scale));
  line-height: 1.12;
  letter-spacing: -0.015em;
}

.pillar-text {
  max-width: 44ch;
  margin-bottom: 22px;
  color: var(--text-2);
  font-size: calc(18px * var(--text-scale));
  line-height: 1.55;
}

.checks {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.checks li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  color: var(--text);
  font-size: calc(16px * var(--text-scale));
  line-height: 1.5;
}

.checks :deep(svg) {
  flex: none;
  position: relative;
  top: 2px;
  color: var(--accent);
}

.pillar-media {
  margin: 0;
}

.hero-visual {
  position: relative;
  margin: 0 0 0 0;
  padding-bottom: 40px;
}

/* A phone screenshot in a thin device frame. */
.phone {
  width: 220px;
  margin: 0;
  overflow: hidden;
  border: 8px solid #18181b;
  border-radius: 34px;
  background: #18181b;
  box-shadow: var(--shadow-lg);
}

.phone img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 26px;
}

.hero-visual .phone {
  position: absolute;
  right: -24px;
  bottom: -8px;
  width: 170px;
}

.install-grid .phone {
  width: 260px;
}

.install-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 64px;
  align-items: center;
}

.install-grid .install-steps {
  grid-template-columns: 1fr;
}

/* The Drive section: the library's real file layout. */
.drive .tree {
  margin: 0;
  padding: 14px 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  font-size: calc(14.5px * var(--text-scale));
}

.drive .tree li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 7px;
  padding-bottom: 7px;
  padding-right: 18px;
}

.drive .tree li.dir span {
  font-weight: 600;
}

.drive .tree :deep(svg) {
  flex: none;
  color: var(--accent);
}

.drive .tree small {
  margin-left: auto;
  padding-left: 16px;
  color: var(--text-3);
  font-size: calc(13px * var(--text-scale));
  white-space: nowrap;
}

/* The plugin has no recording: a drawn browser with the extension's confirmation. */
.plugin .browser {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.browser-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.dots {
  display: flex;
  gap: 6px;
}

.dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border-strong);
}

.url {
  flex: 1;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-3);
  font-size: 13px;
}

.ext {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-text);
}

.browser-page {
  position: relative;
  display: grid;
  gap: 14px;
  padding: 120px 40px 48px;
}

.line {
  height: 10px;
  border-radius: 5px;
  background: var(--surface-3);
}

.w60 { width: 60%; }
.w70 { width: 70%; }
.w80 { width: 80%; }
.w85 { width: 85%; }
.w90 { width: 90%; }

.popup {
  position: absolute;
  top: 16px;
  right: 16px;
  display: grid;
  gap: 4px;
  width: 280px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  font-size: 14px;
}

.popup span {
  color: var(--text-2);
}

.popup em {
  color: var(--accent-ink);
  font-style: normal;
  font-weight: 600;
}

/* Installing as an app: three steps. */
.install h2 {
  margin: 10px 0 32px;
  font-size: calc(clamp(28px, 3vw, 40px) * var(--text-scale));
  line-height: 1.15;
}

.install-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.install-steps li {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.install-steps :deep(svg) {
  margin-bottom: 6px;
  color: var(--accent);
}

.install-steps span {
  color: var(--text-2);
  font-size: calc(15px * var(--text-scale));
  line-height: 1.5;
}

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
  padding: 18px 20px;
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
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.note {
  display: block;
  margin-top: 6px;
  line-height: 1.5;
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
  margin-top: 28px;
  max-width: 72ch;
  margin-top: 22px;
  color: var(--text-2);
  font-size: calc(15px * var(--text-scale));
  line-height: 1.55;
}


.compare-notes a {
  color: var(--accent);
}

/* Landing-page rhythm: fewer edges, longer pauses, and a little more editorial contrast. */
.landing {
  --max: 1160px;
  --gutter: clamp(28px, 7vw, 112px);
  background: #fbfaf8;
}

.top {
  padding-top: 30px;
  padding-bottom: 30px;
}

.hero {
  grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr);
  gap: clamp(64px, 9vw, 128px);
  padding-top: clamp(80px, 12vw, 150px);
  padding-bottom: clamp(120px, 15vw, 190px);
}

.hero-kicker {
  margin-bottom: 22px;
  color: var(--accent-ink);
}

h1 {
  max-width: 10ch;
  font-size: calc(clamp(44px, 5.2vw, 74px) * var(--text-scale));
  line-height: 1.02;
  letter-spacing: -0.045em;
}

.lede {
  max-width: 35ch;
  margin-top: 30px;
  font-size: calc(21px * var(--text-scale));
  line-height: 1.58;
}

.cta {
  margin-top: 38px;
}

.text-link {
  align-self: center;
  color: var(--accent-ink);
  font-size: calc(15px * var(--text-scale));
  font-weight: 600;
  text-decoration: none;
}

.text-link:hover { text-decoration: underline; }

.hero-visual .shot {
  border-radius: 18px;
}

.highlights {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  margin-bottom: 0;
  padding-bottom: 116px;
}

.highlights li {
  min-height: 124px;
  padding: 25px 2px 0;
  border-width: 1px 0 0;
  border-radius: 0;
  background: transparent;
}

.pillars {
  gap: clamp(150px, 16vw, 240px);
  padding-top: clamp(140px, 16vw, 220px);
  padding-bottom: clamp(140px, 16vw, 220px);
  background: #f2f4f8;
}

.pillar {
  grid-template-columns: minmax(0, .84fr) minmax(0, 1.16fr);
  gap: clamp(68px, 9vw, 130px);
}

.pillar h2 {
  max-width: 12ch;
  font-size: calc(clamp(34px, 4vw, 56px) * var(--text-scale));
  letter-spacing: -0.035em;
}

.pillar-text { font-size: calc(19px * var(--text-scale)); }

.how, .install, .compare, .run, .faq-section {
  padding-top: clamp(120px, 14vw, 190px);
  padding-bottom: clamp(120px, 14vw, 190px);
}

.compare { background: #fbfaf8; }
.compare-intro { max-width: 52ch; margin-bottom: 44px; }
.compare h2 { max-width: 12ch; font-size: calc(clamp(34px, 4vw, 52px) * var(--text-scale)); }

@media (max-width: 900px) {
  .hero { gap: 56px; padding-top: 72px; }
  .highlights { grid-template-columns: 1fr; padding-bottom: 80px; }
  .pillars { padding-top: 100px; padding-bottom: 100px; }
}

@media (max-width: 900px) {
  .highlights {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pillars {
    gap: 80px;
    padding-block: 64px;
  }

  .pillar,
  .pillar.flip {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .pillar.flip .pillar-copy {
    order: 0;
  }

  .hero,
  .extension,
  .feature,
  
  
  .how,
  .install,
  .compare,
  .faq-section,
  .run {
    padding-block: 56px;
  }

   .extras,
  .install-steps,
  .install-grid,
  .pair {
    grid-template-columns: 1fr;
  }

  
}

</style>
