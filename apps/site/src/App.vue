<script setup lang="ts">
// Bibliograph's project website (GitHub Pages). Bibliograph isn't a hosted service: this page
// explains the software, and everyone runs their own copy (see setup/ and docs/SELF_HOSTING.md).
// Images and videos are captures of the real app (scripts/capture-landing.mjs).
import AppIcon from "../../web/src/components/AppIcon.vue";
import LandingVideo from "./components/LandingVideo.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { BASE, HOW_URL, REPO_URL, SETUP_URL } from "./site";

const driveTree = [
  { depth: 0, icon: "drive", name: "My Drive" },
  { depth: 1, icon: "folder", name: "Bibliograph Library" },
  { depth: 2, icon: "pdf", name: "papers/sussillo2016.pdf" },
  { depth: 2, icon: "note", name: "notes/sussillo2016.md" },
  { depth: 2, icon: "library", name: "library.json" },
  { depth: 2, icon: "note", name: "research-notes/Single-trial dynamics.md" },
  { depth: 2, icon: "quote", name: "references.bib" }
];

const pillars = [
  {
    icon: "settings",
    title: "Open-source code you run",
    text: "Bibliograph is software, not a service. You run your own copy, host it, and change any part of it. MIT licensed."
  },
  {
    icon: "clock",
    title: "Five-minute setup",
    text: "Clone the code and run one command. It creates your Firebase project, database, and site, then deploys.",
    link: { label: "Follow the tutorial", href: SETUP_URL }
  },
  {
    icon: "drive",
    title: "Your data is in your Drive",
    text: "Papers, notes, PDFs, and the links between them are plain files in your Google Drive: CSL-JSON, Markdown, BibTeX, PDF."
  },
  {
    icon: "user",
    title: "Nothing belongs to anyone else",
    text: "There's no central server and no Bibliograph account. The people who write Bibliograph never see your copy or your library."
  }
];

const compareColumns = ["Bibliograph", "Zotero", "EndNote", "Paperpile"];
// Rows are what Bibliograph adds; the other columns say what each product offers for the same need.
// Facts from each product's own documentation and support forums, October 2026.
const compareRows = [
  {
    label: "Who runs it",
    ours: "You: your own copy, in your own Google Cloud project",
    cells: ["Desktop app; sync through Zotero's servers", "Clarivate (desktop app and EndNote Web)", "Paperpile's servers"]
  },
  { label: "Open source", ours: "Yes (MIT)", cells: ["Yes (AGPL)", "No", "No"] },
  {
    label: "Where your library lives",
    ours: "Your Google Drive, as plain files you can open anywhere",
    cells: ["Local database, synced via Zotero", "Local .enl library", "Paperpile's cloud; only PDFs in Drive"]
  },
  {
    label: "Links and backlinks",
    ours: "Type @[ in any note to link a paper. Each paper lists every note that mentions it, with the sentence.",
    cells: ["Manual “Related” links, kept apart from notes", "Citing articles via Web of Science", "No links between papers"]
  },
  {
    label: "Triage what to read",
    ours: "New papers land in an Inbox; one key moves each to a reading shelf.",
    cells: ["No reading status", "Read / unread", "No reading status"]
  },
  { label: "Price", ours: "Free (Firebase's free plan)", cells: ["Free; paid storage over 300 MB", "One-time license", "Subscription"] }
];

const extras = [
  { icon: "search", text: "Search 250 million papers" },
  { icon: "upload", text: "Import from Zotero or Mendeley" },
  { icon: "quote", text: "references.bib for LaTeX, always current" },
  { icon: "clock", text: "Works offline, syncs when you're back" }
];
</script>

<template>
  <main class="landing">
    <SiteHeader />

    <section class="hero">
      <div class="pitch">
        <h1 class="display">Finally, a reference manager that's actually yours.</h1>
        <p class="lede">Bibliograph is open-source software you run yourself. Set up your own copy in five minutes. Your library lives in your own Google Drive, and nothing belongs to anyone but you.</p>
        <div class="cta">
          <div class="row">
            <a class="btn primary lg" :href="SETUP_URL">Set it up in 5 minutes</a>
            <a class="btn lg" :href="REPO_URL">View the code</a>
          </div>
          <p class="fine">Free and open source (MIT).</p>
        </div>
      </div>
      <figure class="hero-visual">
        <div class="shot">
          <img :src="`${BASE}landing/library.jpg`" width="2560" height="1600" alt="The Bibliograph library with one paper open." />
        </div>
        <ul class="tree" aria-label="The same library as files in Google Drive">
          <li v-for="item in driveTree" :key="item.name" :style="{ paddingLeft: `${14 + item.depth * 16}px` }">
            <AppIcon :name="item.icon" :size="14" /> <span>{{ item.name }}</span>
          </li>
        </ul>
      </figure>
    </section>

    <section id="how-it-works" class="how">
      <h2 class="display">How it works</h2>
      <p class="lead">Bibliograph isn't a service. It's pre-written code that sets up your own reference manager from scratch, in your own Google account. <a :href="HOW_URL">See the architecture →</a></p>
      <div class="flow" role="list" aria-label="How the pieces fit">
        <div class="node" role="listitem">
          <span class="where"><AppIcon name="link" :size="17" /> The code</span>
          <p>On GitHub, open source. Fork it and change anything.</p>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="node yours" role="listitem">
          <span class="where"><AppIcon name="settings" :size="17" /> Your copy</span>
          <p>Your own Firebase project and sign-in, at <code>your-id.web.app</code>. Only you can get in.</p>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="node yours" role="listitem">
          <span class="where"><AppIcon name="drive" :size="17" /> Your library</span>
          <p>A folder of plain files in your Google Drive. It outlives any copy of the app.</p>
        </div>
      </div>
      <ul class="pillars">
        <li v-for="pillar in pillars" :key="pillar.title">
          <AppIcon :name="pillar.icon" :size="20" />
          <h3>{{ pillar.title }}</h3>
          <p>
            {{ pillar.text }}
            <template v-if="pillar.link"> <a :href="pillar.link.href">{{ pillar.link.label }} →</a></template>
          </p>
        </li>
      </ul>
    </section>

    <section class="feature">
      <div class="copy">
        <p class="eyebrow">Inbox</p>
        <h2 class="display">Sort new papers with one key.</h2>
        <p>Everything you save lands in the Inbox. Press a number to shelve it: Read next, Skimming, Reading, Read, Reference, or Parked.</p>
      </div>
      <figure class="shot">
        <LandingVideo name="inbox" :width="758" :height="640" label="Pressing number keys moves each paper out of the Inbox onto a shelf." />
      </figure>
    </section>

    <section class="feature reverse">
      <div class="copy">
        <p class="eyebrow">Research notes</p>
        <h2 class="display">Write across papers.</h2>
        <p>A question, a project, a draft: just Markdown. Link papers with <code>@[</code> and they're connected. Each note is a file in your Drive.</p>
      </div>
      <figure class="shot">
        <LandingVideo name="research-notes" :width="588" :height="800" label="Writing a research note: a question, then bullets that link three papers with @[, shown as a list of linked papers." />
      </figure>
    </section>

    <section class="feature">
      <div class="copy">
        <p class="eyebrow">Linked notes</p>
        <h2 class="display">Link papers as you write.</h2>
        <p>Type <code>@[</code> to link a paper. Its page then shows every note that mentions it.</p>
      </div>
      <figure class="shot">
        <LandingVideo name="linking" :width="552" :height="740" label="Typing @[ to link a paper in a note, then opening that paper to see the mention." />
      </figure>
    </section>

    <div class="extras">
      <span v-for="item in extras" :key="item.text"><AppIcon :name="item.icon" :size="16" /> {{ item.text }}</span>
    </div>

    <section class="compare">
      <h2 class="display">Next to Zotero, EndNote, and Paperpile</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Feature</span></th>
              <th v-for="name in compareColumns" :key="name" scope="col" :class="{ us: name === 'Bibliograph' }">{{ name }}</th>
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
      <p class="fine">Where the others are ahead: citation plugins for Word and Google Docs, PDF annotation, and desktop and mobile apps. Based on each product's documentation, October 2026.</p>
    </section>

    <section class="run">
      <div class="run-head">
        <p class="eyebrow">Get your own</p>
        <h2 class="display">Your copy, in about five minutes.</h2>
        <p>You need a Google account, Node.js, and git. Setup does the rest, and the tutorial walks through every screen.</p>
      </div>
      <pre class="terminal">git clone {{ REPO_URL }}.git
cd bibliograph
npm install
npm run setup</pre>
      <div class="run-cta">
        <a class="btn primary lg" :href="SETUP_URL">Open the setup tutorial</a>
        <a class="link" :href="`${REPO_URL}/fork`">Or fork it on GitHub first →</a>
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
.compare {
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px;
  border-top: 1px solid var(--border);
}

.how h2,
.compare h2,
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

.pillars {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pillars :deep(svg) {
  color: var(--accent);
}

.pillars h3 {
  margin: 10px 0 6px;
  font-family: var(--font-serif);
  font-size: calc(18px * var(--text-scale));
  font-weight: 650;
}

.pillars p {
  font-size: calc(15px * var(--text-scale));
  line-height: 1.55;
  color: var(--text-2);
}

.pillars a,
.lead a,
.run-cta a.link {
  color: var(--accent);
}

.extras {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 28px;
  max-width: var(--max);
  margin: 0 auto;
  padding: 0 32px 72px;
  color: var(--text-2);
  font-size: calc(14.5px * var(--text-scale));
}

.extras span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.extras :deep(svg) {
  color: var(--accent);
}

.run-cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-top: 24px;
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

.compare .fine {
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
  .compare,
  .run {
    padding: 40px 16px;
  }


  .pillars,
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
  .pillars,
  .flow {
    grid-template-columns: 1fr;
  }
}
</style>
