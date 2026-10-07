<script setup lang="ts">
// Biblio's home page (GitHub Pages). Biblio isn't a hosted service: this page makes the case,
// shows the features, and sends people to setup/. Captures come from scripts/capture-landing.mjs.
import AppIcon from "../../web/src/components/AppIcon.vue";
import FaqItem from "./components/FaqItem.vue";
import LandingVideo from "./components/LandingVideo.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { BASE, REPO_URL, SETUP_URL, docUrl } from "./site";

const driveTree = [
  { depth: 0, icon: "drive", name: "My Drive" },
  { depth: 1, icon: "folder", name: "Biblio Library" },
  { depth: 2, icon: "pdf", name: "papers/sussillo2016.pdf" },
  { depth: 2, icon: "note", name: "notes/sussillo2016.md" },
  { depth: 2, icon: "note", name: "notes/Single-trial dynamics.md" },
  { depth: 2, icon: "library", name: "library.json" },
  { depth: 2, icon: "quote", name: "references.bib" }
];

// What a reference manager ought to do. Each row names the quality; the Biblio cell says what
// that means here. Checked against each product's own documentation and support forums,
// October 2026 — see docs/COMPARISON.md for sources. Keep claims conservative and verifiable.
const compareColumns = ["Biblio", "Zotero", "EndNote", "Paperpile"];
const compareRows = [
  {
    label: "Open source",
    ours: "Yes, MIT. Read it, fork it, change it.",
    cells: ["Yes, AGPL", "No", "No"]
  },
  {
    label: "Pricing",
    ours: "Free. You host it, so there's nobody to bill you.",
    cells: ["Free; paid storage above 300 MB", "Paid licence", "Paid subscription"]
  },
  {
    label: "Fault tolerance",
    ours: "If your hosting breaks, your files are still in Drive. Rebuild a copy from a .zip.",
    cells: ["Library is local; sync needs Zotero's servers", "Library is local", "Library lives on Paperpile's servers"]
  },
  {
    label: "Code ownership",
    ours: "You deploy and run the app yourself, and can change any part of it.",
    cells: ["Source is open; the service is Zotero's", "Vendor-run", "Vendor-run"]
  },
  {
    label: "Data ownership",
    ours: "Everything — papers, notes, tags, shelves, links — in a Drive folder you control.",
    cells: ["Files and database on your own machine", "Files and database on your own machine", "PDFs in your Drive; the rest is Paperpile's"]
  },
  {
    label: "Storage format",
    ours: "Plain files named for what they are: CSL-JSON, Markdown, BibTeX, PDF.",
    cells: ["SQLite; attachments under random 8-character keys", "Proprietary .enl library", "Cloud records you reach through the app"]
  },
  {
    label: "Cross-referencing",
    ours: "Type @[ to link a paper from any note; the paper lists back every note that mentions it.",
    cells: ["“Related” links between items and notes", "Citing articles via Web of Science", "Not built in"]
  },
  {
    label: "Discovery",
    ours: "Search 250M papers in the app, and save one with a note on why.",
    cells: ["Search databases in-app and via the browser plugin", "Online search of subscribed databases", "Search PubMed, Scholar, arXiv and more in-app"]
  },
  {
    label: "Exports",
    tie: true,
    ours: "references.bib and library.json stay current in Drive, no export step.",
    cells: ["BibTeX, RIS, CSL-JSON on export", "BibTeX, RIS, XML on export", "BibTeX, RIS, CSL-JSON on export"]
  }
];

// Each one has a demo below.
const features = [
  {
    id: "search",
    eyebrow: "Search",
    title: "Find papers without leaving.",
    text: "Search 250 million papers by topic, title, or author, and note why you're saving one as you add it. Or paste a DOI, an arXiv link, or a .bib from Zotero.",
    video: { name: "search", width: 600, height: 326 }
  },
  {
    id: "organize",
    eyebrow: "Organize",
    title: "Three shelves, one keypress.",
    text: "To read, Skimming, Read — press 1, 2, 3. That's the whole reading model; anything more specific is a tag. Folders hold stable projects.",
    video: { name: "organize", width: 600, height: 602 }
  },
  {
    id: "review",
    eyebrow: "Review",
    title: "Notes beside the paper.",
    text: "Write in Markdown next to the abstract and the PDF, without opening another app. Notes save as you type, into your own Drive.",
    video: { name: "review", width: 600, height: 478 }
  },
  {
    id: "link",
    eyebrow: "Link",
    title: "Papers that know each other.",
    text: "Type @[ to link a paper from any note. The linked paper then lists every note that mentions it, with the sentence around the link.",
    video: { name: "linking", width: 600, height: 478 }
  },
  {
    id: "write",
    eyebrow: "Write",
    title: "Think across papers.",
    text: "A research note is freeform Markdown for a question or a project. Link the papers that bear on it and they gather themselves.",
    video: { name: "research-notes", width: 600, height: 604 }
  }
];

const extras = [
  { icon: "quote", text: "references.bib stays current for LaTeX and Overleaf" },
  { icon: "pdf", text: "Open-access PDFs fetched automatically" },
  { icon: "clock", text: "Works offline; syncs when you're back" },
  { icon: "search", text: "⌘K to jump anywhere" },
  { icon: "upload", text: "Import from Zotero, Mendeley, or a .bib" },
  { icon: "settings", text: "Themes, fonts, and text size" }
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
          <p class="fine">Free and open source (MIT). Five minutes.</p>
        </div>
      </div>
      <figure class="hero-visual">
        <div class="shot">
          <img :src="`${BASE}landing/library.jpg`" width="2560" height="1600" alt="The Biblio library with one paper open." />
        </div>
        <ul class="tree" aria-label="The same library as files in Google Drive">
          <li v-for="item in driveTree" :key="item.name" :style="{ paddingLeft: `${14 + item.depth * 16}px` }">
            <AppIcon :name="item.icon" :size="14" /> <span>{{ item.name }}</span>
          </li>
        </ul>
      </figure>
    </section>

    <section class="why">
      <h2 class="display">A better way to manage references</h2>
      <p class="lead">What a reference manager ought to do — and who actually does it.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">What it ought to do</span></th>
              <th v-for="name in compareColumns" :key="name" scope="col" :class="{ us: name === 'Biblio' }">{{ name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td class="us"><AppIcon v-if="!row.tie" name="check" :size="15" class="tick" /> {{ row.ours }}</td>
              <td v-for="cell in row.cells" :key="cell">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="fine">
        Where the others are ahead: Word and Google Docs plugins, PDF annotation, and mobile apps. Checked against each product's own documentation, October 2026
        (<a :href="docUrl('COMPARISON.md')">sources</a>).
      </p>
    </section>

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
        Looking up a paper asks public catalogs (OpenAlex, Crossref, arXiv) directly from your browser. The people who write Biblio never see your copy or your library.
        <a :href="docUrl('STORAGE.md')">How storage works →</a>
      </p>
    </section>

    <section class="features">
      <h2 class="display">Built-in features</h2>
      <div v-for="(item, i) in features" :key="item.id" class="feature" :class="{ reverse: i % 2 === 1 }">
        <div class="copy">
          <p class="eyebrow">{{ item.eyebrow }}</p>
          <h3 class="display">{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </div>
        <figure class="shot">
          <LandingVideo :name="item.video.name" :width="item.video.width" :height="item.video.height" :label="item.text" />
        </figure>
      </div>

      <ul class="extras">
        <li v-for="item in extras" :key="item.text"><AppIcon :name="item.icon" :size="16" /> {{ item.text }}</li>
      </ul>
    </section>

    <section class="run">
      <div class="run-head">
        <p class="eyebrow">Set up your own</p>
        <h2 class="display">Yours in about five minutes.</h2>
        <p>You need a Google account, Node.js, and git. One command does the rest.</p>
      </div>
      <pre class="terminal">git clone {{ REPO_URL }}.git
cd biblio
npm install
npm run setup</pre>
      <div class="run-cta">
        <a class="btn primary lg" :href="SETUP_URL">Open the setup tutorial</a>
        <a class="link" :href="`${REPO_URL}/fork`">Or fork it first →</a>
      </div>
    </section>

    <section class="faq-section">
      <h2 class="display">Questions</h2>
      <div class="faq">
        <FaqItem question="Is this really free?">
          Yes. Biblio is MIT-licensed code, and your copy runs on Google's free Spark plan. There's no paid tier, because there's nobody to pay — you're hosting it yourself.
        </FaqItem>
        <FaqItem question="What happens if this project is abandoned?">
          Nothing, for you. Your copy keeps running in your Google account, your library stays in your Drive as plain files, and you have the code. That's the point of the design.
        </FaqItem>
        <FaqItem question="Do I need to know how to code?">
          No. Setup is one command, and the <a :href="SETUP_URL">tutorial</a> walks through every screen. Knowing how to code just means you can also change things.
        </FaqItem>
        <FaqItem question="Can I move my library between copies?">
          Yes. Download it as a .zip from Settings and import it into the other copy. If you have no working copy at all, download the folder from Google Drive — that's a .zip too — and import that.
        </FaqItem>
        <FaqItem question="What does Biblio see of my Drive?">
          Only the files it creates. That's Google's narrowest Drive permission, which is also why signing in shows no warning screen.
        </FaqItem>
        <FaqItem question="Who can see my library?">
          You. There's no Biblio server, no accounts, and no analytics. Paper lookups go straight from your browser to public catalogs.
        </FaqItem>
        <FaqItem question="Why only three reading shelves?">
          Because more shelves become a filing problem of their own. To read, Skimming, and Read cover how much attention a paper needs; everything else — reference, parked, to cite — is a tag, which you can combine and rename.
        </FaqItem>
        <FaqItem question="Can I add my own features?">
          Yes, and keep them through updates. Your code goes in <code>apps/web/src/custom/</code>, which upstream never touches, and can add pages, sidebar links, and panels. See <a :href="docUrl('EXTENDING.md')">EXTENDING.md</a>.
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
  margin: 0 0 0 0;
  padding-bottom: 48px;
}

.tree {
  position: absolute;
  left: -28px;
  bottom: 0;
  margin: 0;
  padding: 10px 18px 10px 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  font-size: calc(13px * var(--text-scale));
}

.tree li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  padding-bottom: 4px;
  color: var(--text-2);
}

.tree li:first-child {
  color: var(--text);
  font-weight: 600;
}

.how,
.why,
.features,
.run,
.faq-section {
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px;
  border-top: 1px solid var(--border);
}

.how h2,
.why h2,
.faq-section h2,
.feature h2 {
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

.features .feature {
  padding: 56px 0;
  border-top: 1px solid var(--border);
}

.features .feature:first-of-type {
  padding-top: 36px;
  border-top: 0;
}

.features > h2 {
  margin-bottom: 0;
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

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: calc(14.5px * var(--text-scale));
  line-height: 1.4;
}

th,
td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}

thead th {
  font-family: var(--font-serif);
  font-size: calc(16px * var(--text-scale));
  font-weight: 650;
}

tbody th {
  width: 17%;
  font-family: var(--font-serif);
  font-size: calc(16px * var(--text-scale));
  font-weight: 650;
}

td {
  width: 18%;
  color: var(--text-3);
}

td.us {
  width: 29%;
  font-weight: 450;
}

.tick {
  margin: 0 4px -2px 0;
  color: var(--accent);
}

.us {
  background: var(--select);
  color: var(--text);
  font-weight: 550;
}

.why .fine {
  margin-top: 12px;
}

.feature {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 56px;
  align-items: center;
}

.feature.reverse {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
}

.feature.reverse .copy {
  order: 2;
}

.feature .shot {
  justify-self: center;
  width: 100%;
  max-width: 600px;
}

.feature p:not(.eyebrow) {
  max-width: 38ch;
  font-size: calc(17px * var(--text-scale));
  line-height: 1.6;
  color: var(--text-2);
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






@media (max-width: 900px) {
  .hero,
  .feature,
  .feature.reverse {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 40px 16px;
  }

  .feature.reverse .copy {
    order: 0;
  }

  .how,
  .why,
  .features,
  .faq-section,
  .run {
    padding: 40px 16px;
  }


  .extras,
  .pair {
    grid-template-columns: 1fr;
  }

  .tree {
    left: 12px;
  }

}

</style>
