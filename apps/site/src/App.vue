<script setup lang="ts">
// Biblio's home page (GitHub Pages). Biblio isn't a hosted service: this page makes the case,
// shows the features, and sends people to setup/. Captures come from scripts/capture-landing.mjs.
import AppIcon from "../../web/src/components/AppIcon.vue";
import LandingVideo from "./components/LandingVideo.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { BASE, HOW_URL, REPO_URL, SETUP_URL } from "./site";

const driveTree = [
  { depth: 0, icon: "drive", name: "My Drive" },
  { depth: 1, icon: "folder", name: "Biblio Library" },
  { depth: 2, icon: "pdf", name: "papers/sussillo2016.pdf" },
  { depth: 2, icon: "note", name: "notes/sussillo2016.md" },
  { depth: 2, icon: "note", name: "notes/Single-trial dynamics.md" },
  { depth: 2, icon: "library", name: "library.json" },
  { depth: 2, icon: "quote", name: "references.bib" }
];

// What a reference manager ought to be. These are the argument; everything else is detail.
const benefits = [
  { icon: "link", title: "Open source", text: "Every line is public and MIT licensed. Read it, fork it, change it." },
  { icon: "check", title: "Free, forever", text: "No subscription, no storage tier, no company that can start charging. Your copy fits in Google's free plan." },
  {
    icon: "settings",
    title: "Fault-tolerant",
    text: "If your hosting breaks, or this project disappears, your papers are still in your Drive. Fork the code and rebuild your whole library from a .zip."
  },
  {
    icon: "user",
    title: "Yours, all of it",
    text: "Not just the PDFs: your notes, tags, shelves, and the links you draw between papers. Saved as files named for what they are — not hVSZF.md — so you can read and grep them without Biblio."
  },
  { icon: "note", title: "Built on relationships", text: "Papers cite papers; notes cite papers. Type @[ to link one, and every paper shows the notes that mention it, in context." },
  { icon: "search", title: "Search that works", text: "Find papers across 250 million from inside the app, and search your own library by title, author, tag, note, or the reason you saved it." },
  { icon: "quote", title: "Exports to .bib", text: "references.bib stays current in your Drive, ready for LaTeX and Overleaf. library.json works with pandoc and Zotero." }
];

const compareColumns = ["Biblio", "Zotero", "EndNote", "Paperpile"];
// Facts from each product's own documentation and support forums, October 2026.
const compareRows = [
  { label: "Open source", ours: "Yes (MIT)", cells: ["Yes (AGPL)", "No", "No"] },
  { label: "Who runs it", ours: "You, in your own Google Cloud project", cells: ["Desktop app; sync via Zotero", "Clarivate", "Paperpile's servers"] },
  { label: "Where your library lives", ours: "Your Google Drive, as plain files", cells: ["Local database", "Local .enl library", "Paperpile's cloud"] },
  { label: "Links between papers and notes", ours: "@[ links, with backlinks in context", cells: ["Manual “Related”, outside notes", "Web of Science citations", "Not built in"] },
  { label: "Price", ours: "Free", cells: ["Free; paid storage over 300 MB", "One-time license", "Subscription"] }
];

const features = [
  { icon: "inbox", title: "Inbox and shelves", text: "New papers land in an Inbox. One key shelves each: Read next, Skimming, Reading, Read, Reference, Parked." },
  { icon: "note", title: "Research notes", text: "Freeform Markdown for a question or project. Link papers with @[ and they connect both ways." },
  { icon: "search", title: "Add from anywhere", text: "Search 250M papers, paste a DOI or arXiv link, import a .bib from Zotero or Mendeley, or capture from the browser." },
  { icon: "pdf", title: "PDFs in your Drive", text: "Open-access PDFs are fetched automatically and stored in your own folder." },
  { icon: "folder", title: "Folders and tags", text: "Folders for stable projects, tags for cross-cutting labels, and a note on why you saved each paper." },
  { icon: "clock", title: "Fast, and fine offline", text: "Search as you type, ⌘K to jump anywhere. Edits work offline and sync when you're back." }
];

const faqs = [
  {
    q: "Is this really free?",
    a: "Yes. Biblio is MIT-licensed code, and your copy runs on Google's free Spark plan. There's no paid tier, because there's nobody to pay — you're hosting it yourself."
  },
  {
    q: "What happens if this project is abandoned?",
    a: "Nothing, for you. Your copy keeps running in your Google account, your library stays in your Drive as plain files, and you have the code. That's the point of the design."
  },
  { q: "Do I need to know how to code?", a: "No. Setup is one command, and the tutorial walks through every screen. Knowing how to code just means you can also change things." },
  {
    q: "Can I move my library between copies?",
    a: "Yes. Download it as a .zip from Settings and import it into the other copy. If you have no working copy at all, download the folder from Google Drive — that's a .zip too — and import that."
  },
  { q: "What does Biblio see of my Drive?", a: "Only the files it creates. That's Google's narrowest Drive permission, which is also why signing in shows no scary warning screen." },
  { q: "Who can see my library?", a: "You. There's no Biblio server, no accounts, and no analytics. Paper lookups go straight from your browser to public catalogs like OpenAlex and Crossref." },
  { q: "Can I use it on my phone?", a: "It's a web app, so it opens on a phone, but it's built for a desk. There's no mobile app, and no PDF annotation or Word plugin yet." }
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
      <ul class="benefits">
        <li v-for="item in benefits" :key="item.title">
          <AppIcon :name="item.icon" :size="19" />
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </li>
      </ul>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Feature</span></th>
              <th v-for="name in compareColumns" :key="name" scope="col" :class="{ us: name === 'Biblio' }">{{ name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td class="us"><AppIcon name="check" :size="15" class="tick" /> {{ row.ours }}</td>
              <td v-for="cell in row.cells" :key="cell">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="fine">Where the others are ahead: Word and Google Docs plugins, PDF annotation, and mobile apps. From each product's documentation, October 2026.</p>
    </section>

    <section class="how">
      <h2 class="display">How it works</h2>
      <p class="lead">Biblio isn't a service you sign up for. It's code that sets up your own reference manager, in your own Google account.</p>
      <div class="flow" role="list">
        <div class="node" role="listitem">
          <span class="where"><AppIcon name="link" :size="17" /> The code</span>
          <p>Public and MIT licensed. Fork it and change anything.</p>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="node yours" role="listitem">
          <span class="where"><AppIcon name="settings" :size="17" /> Your copy</span>
          <p>Your own project and sign-in at <code>your-id.web.app</code>.</p>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="node yours" role="listitem">
          <span class="where"><AppIcon name="drive" :size="17" /> Your library</span>
          <p>Plain files in your Drive. They outlive any copy of the app.</p>
        </div>
      </div>
      <p class="more"><a :href="HOW_URL">See the full architecture →</a></p>
    </section>

    <section class="feature">
      <div class="copy">
        <p class="eyebrow">Inbox</p>
        <h2 class="display">Sort new papers with one key.</h2>
        <p>Everything you save lands in the Inbox. Press a number to shelve it.</p>
      </div>
      <figure class="shot">
        <LandingVideo name="inbox" :width="758" :height="640" label="Pressing number keys moves each paper out of the Inbox onto a shelf." />
      </figure>
    </section>

    <section class="feature reverse">
      <div class="copy">
        <p class="eyebrow">Research notes</p>
        <h2 class="display">Write across papers.</h2>
        <p>A question, a project, a draft: just Markdown. Link papers with <code>@[</code> and they're connected.</p>
      </div>
      <figure class="shot">
        <LandingVideo name="research-notes" :width="588" :height="800" label="Writing a research note that links three papers with @[." />
      </figure>
    </section>

    <section class="feature">
      <div class="copy">
        <p class="eyebrow">Linked notes</p>
        <h2 class="display">Link papers as you write.</h2>
        <p>Every paper shows the notes that mention it, with the sentence around the link.</p>
      </div>
      <figure class="shot">
        <LandingVideo name="linking" :width="552" :height="740" label="Typing @[ to link a paper, then opening that paper to see the mention." />
      </figure>
    </section>

    <section class="built-in">
      <h2 class="display">Built-in features</h2>
      <ul class="grid">
        <li v-for="item in features" :key="item.title">
          <AppIcon :name="item.icon" :size="18" />
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </div>
        </li>
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
      <dl class="faq">
        <template v-for="item in faqs" :key="item.q">
          <dt>{{ item.q }}</dt>
          <dd>{{ item.a }}</dd>
        </template>
      </dl>
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
.built-in,
.faq-section {
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px;
  border-top: 1px solid var(--border);
}

.how h2,
.why h2,
.built-in h2,
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
.flow {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: stretch;
  gap: 12px;
  margin-bottom: 44px;
}

.node {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.node.yours {
  border-color: var(--accent);
  background: var(--select);
}

.node .where {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 650;
}

.node .where :deep(svg) {
  color: var(--accent);
}

.node p {
  margin-top: 6px;
  color: var(--text-2);
  font-size: calc(14px * var(--text-scale));
  line-height: 1.5;
}

.node code {
  font-size: 0.85em;
}

.arrow {
  align-self: center;
  color: var(--text-3);
  font-size: 22px;
}









.run-cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-top: 24px;
}

.benefits {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 30px 34px;
  margin: 0 0 44px;
  padding: 0;
  list-style: none;
}

.benefits :deep(svg),
.built-in :deep(svg) {
  color: var(--accent);
}

.benefits h3,
.built-in h3 {
  margin: 10px 0 5px;
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 650;
}

.benefits p,
.built-in p {
  font-size: calc(14.5px * var(--text-scale));
  line-height: 1.55;
  color: var(--text-2);
}

.lead a,
.more a,
.run-cta a.link {
  color: var(--accent);
}

.more {
  margin-top: 18px;
}

.built-in .grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 26px 32px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.built-in .grid li {
  display: flex;
  gap: 12px;
}

.built-in .grid :deep(svg) {
  flex: none;
  margin-top: 3px;
}

.built-in h3 {
  margin-top: 0;
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
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 64px;
  align-items: center;
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px;
  border-top: 1px solid var(--border);
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
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px 96px;
  border-top: 1px solid var(--border);
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
  .built-in,
  .faq-section,
  .run {
    padding: 40px 16px;
  }


  .benefits,
  .built-in .grid,
  .flow {
    grid-template-columns: 1fr 1fr;
  }

  .flow .arrow {
    display: none;
  }

  .tree {
    left: 12px;
  }

}
@media (max-width: 560px) {
  .benefits,
  .built-in .grid,
  .flow {
    grid-template-columns: 1fr;
  }
}
</style>
