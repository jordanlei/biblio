<script setup lang="ts">
// Bibliograph's project website: what it is, how it compares, and how to run your own copy.
// It has no sign-in: every copy of the app is run by its owner (docs/SELF_HOSTING.md).
// Images and videos are captures of the real app (scripts/capture-landing.mjs).
import AppIcon from "../../web/src/components/AppIcon.vue";
import BrandMark from "../../web/src/components/BrandMark.vue";
import LandingVideo from "./components/LandingVideo.vue";

const REPO_URL = "https://github.com/jordanlei/bibliograph";
const base = import.meta.env.BASE_URL;

const driveTree = [
  { depth: 0, icon: "drive", name: "My Drive" },
  { depth: 1, icon: "folder", name: "Bibliograph Library" },
  { depth: 2, icon: "pdf", name: "papers/sussillo2016.pdf" },
  { depth: 2, icon: "note", name: "notes/sussillo2016.md" },
  { depth: 2, icon: "library", name: "library.json" },
  { depth: 2, icon: "note", name: "research-notes/Single-trial dynamics.md" },
  { depth: 2, icon: "quote", name: "references.bib" }
];

const compareColumns = ["Bibliograph", "Zotero", "EndNote", "Paperpile"];
// Rows are what Bibliograph adds; the other columns say what each product offers for the same need.
// Facts from each product's own documentation and support forums, October 2026.
const compareRows = [
  {
    label: "Organize by idea",
    ours: "Research notes: freeform Markdown that connects any papers you link with @[",
    cells: ["Collections and tags", "Groups", "Folders and labels"]
  },
  {
    label: "Links and backlinks",
    ours: "Type @[ in any note to link a paper. Each paper lists every note that mentions it, with the sentence.",
    cells: ["Manual “Related” links, kept apart from notes", "Citing articles via Web of Science", "No links between papers"]
  },
  {
    label: "Everything in your Drive",
    ours: "Papers, notes, PDFs, and the links between them, as plain files you can open anywhere.",
    cells: ["Local database, synced via Zotero", "Local .enl library", "Paperpile's cloud; only PDFs in Drive"]
  },
  {
    label: "Triage what to read",
    ours: "New papers land in an Inbox; one key moves each to a reading shelf.",
    cells: ["No reading status", "Read / unread", "No reading status"]
  },
  { label: "Price", ours: "Free", cells: ["Free; paid storage over 300 MB", "One-time license", "Subscription"] }
];

const setupSteps = [
  { title: "Fork or clone the repository", text: "You need a Google account, Node.js 20+, and git." },
  { title: "Run npm install && npm run setup", text: "It creates your Firebase project, database, and site, turns on the Google APIs, and deploys." },
  { title: "Turn on Google sign-in", text: "The one click Google doesn't allow tools to do. Setup opens the page and checks it worked." },
  { title: "Sign in at your-id.web.app", text: "Your copy, your address. Your library goes to a folder in your Drive." }
];

const reasons = [
  {
    icon: "drive",
    title: "Your library is plain files",
    text: "Papers, notes, PDFs, and the links between them are saved to your Google Drive as CSL-JSON, Markdown, BibTeX, and PDF."
  },
  { icon: "folder", title: "It only sees its own folder", text: "Bibliograph can open the files it creates in your Drive, and nothing else." },
  { icon: "note", title: "It keeps the why", text: "Why you saved a paper, the notes that tie it to others, and the sentence around every link." },
  {
    icon: "link",
    title: "It works with your other tools",
    text: "references.bib stays current for LaTeX and Overleaf, pandoc reads library.json directly, and notes edited in other apps flow back in."
  },
  { icon: "settings", title: "You run it", text: "Your own copy in your own Google Cloud project, set up with one command. Change the code however you like." },
  { icon: "clock", title: "Fast, and fine offline", text: "Search as you type, ⌘K to jump, one key to shelve. Edits work offline and sync when you're back." }
];
</script>

<template>
  <main class="landing">
    <header class="top">
      <span class="brand"><BrandMark :size="30" /> Bibliograph</span>
      <span class="spacer" />
      <a class="btn sm quiet" :href="REPO_URL">GitHub</a>
      <a class="btn sm" href="#run-your-own">Run your own</a>
    </header>

    <section class="hero">
      <div class="pitch">
        <h1 class="display">Finally, a reference manager that's actually yours.</h1>
        <p class="lede">Your papers, notes, and PDFs are plain files in your own Google Drive, and the app runs in your own Google Cloud project. Stop using Bibliograph and everything is still there.</p>
        <div class="cta">
          <div class="row">
            <a class="btn primary lg" href="#run-your-own">Run your own copy</a>
            <a class="btn lg" :href="REPO_URL">View on GitHub</a>
          </div>
          <p class="fine">Free and open source (MIT). Your data always belongs to you.</p>
        </div>
      </div>
      <figure class="hero-visual">
        <div class="shot">
          <img :src="`${base}landing/library.jpg`" width="2560" height="1600" alt="The Bibliograph library with one paper open." />
        </div>
        <ul class="tree" aria-label="The same library as files in Google Drive">
          <li v-for="item in driveTree" :key="item.name" :style="{ paddingLeft: `${14 + item.depth * 16}px` }">
            <AppIcon :name="item.icon" :size="14" /> <span>{{ item.name }}</span>
          </li>
        </ul>
      </figure>
    </section>

    <section class="why">
      <h2 class="display">Why Bibliograph</h2>
      <p class="thesis">Other reference managers keep a list of references. Bibliograph also keeps your thinking about them, in files you own.</p>
      <ul class="reasons">
        <li v-for="reason in reasons" :key="reason.title">
          <AppIcon :name="reason.icon" :size="20" class="reason-icon" />
          <h3>{{ reason.title }}</h3>
          <p>{{ reason.text }}</p>
        </li>
      </ul>
    </section>

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

    <section id="run-your-own" class="run">
      <div class="run-head">
        <p class="eyebrow">Run your own</p>
        <h2 class="display">Your own copy in about five minutes.</h2>
        <p>Bibliograph isn't a service you sign up for. You run your own copy: your Firebase project, your sign-in, your address. It fits in Firebase's free plan.</p>
      </div>
      <ol class="steps">
        <li v-for="(item, i) in setupSteps" :key="item.title">
          <span class="num">{{ i + 1 }}</span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </div>
        </li>
      </ol>
      <pre class="terminal"><span class="faint"># once</span>
git clone {{ REPO_URL }}.git
cd bibliograph
npm install
npm run setup

<span class="faint"># then, whenever you change something</span>
npm run dev        <span class="faint"># try it</span>
npm run deploy     <span class="faint"># publish it</span></pre>
      <p class="run-links">
        <a :href="`${REPO_URL}/blob/main/docs/SELF_HOSTING.md`">Full setup guide</a> ·
        <a :href="`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`">How it's built</a> ·
        <a :href="`${REPO_URL}/blob/main/docs/LIBRARY_FORMAT.md`">The library format</a>
      </p>
    </section>

    <footer class="foot faint small"><BrandMark :size="18" /> Bibliograph · <a :href="REPO_URL">GitHub</a></footer>
  </main>
</template>

<style scoped>
.landing {
  --max: 1160px;
  min-height: 100vh;
  background: var(--bg);
  overflow-x: hidden;
}

.top {
  display: flex;
  align-items: center;
  max-width: var(--max);
  margin: 0 auto;
  padding: 22px 32px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-serif);
  font-size: calc(20px * var(--text-scale));
  font-weight: 650;
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

.why,
.compare {
  max-width: var(--max);
  margin: 0 auto;
  padding: 72px 32px;
  border-top: 1px solid var(--border);
}

.why h2,
.compare h2,
.feature h2 {
  margin: 8px 0 22px;
  font-size: calc(clamp(26px, 2.8vw, 36px) * var(--text-scale));
  line-height: 1.15;
}

.thesis {
  max-width: 46ch;
  margin-bottom: 36px;
  font-family: var(--font-serif);
  font-size: calc(19px * var(--text-scale));
  line-height: 1.5;
  color: var(--text-2);
}

.reasons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 36px 40px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.reason-icon {
  color: var(--accent);
}

.reasons h3 {
  margin: 10px 0 6px;
  font-family: var(--font-serif);
  font-size: calc(18px * var(--text-scale));
  font-weight: 650;
}

.reasons p {
  font-size: calc(15px * var(--text-scale));
  line-height: 1.55;
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

.top .btn + .btn {
  margin-left: 8px;
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

.steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin: 36px 0 28px;
  padding: 0;
  list-style: none;
}

.steps li {
  display: flex;
  gap: 12px;
}

.num {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 650;
}

.steps h3 {
  font-family: var(--font-serif);
  font-size: calc(16px * var(--text-scale));
  font-weight: 650;
}

.steps p {
  margin-top: 4px;
  color: var(--text-2);
  font-size: calc(14.5px * var(--text-scale));
  line-height: 1.5;
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

.run-links {
  margin-top: 18px;
  color: var(--text-3);
}

.run-links a,
.foot a {
  color: var(--accent);
}

.closing {
  display: grid;
  justify-items: center;
  gap: 18px;
  padding: 96px 32px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.closing h2 {
  font-size: calc(clamp(28px, 3.4vw, 42px) * var(--text-scale));
}

.foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px;
  text-align: center;
  border-top: 1px solid var(--border);
}

@media (max-width: 900px) {
  .top {
    padding: 16px 16px;
  }

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

  .why,
  .compare,
  .run {
    padding: 40px 16px;
  }

  .steps {
    grid-template-columns: 1fr 1fr;
  }

  .reasons {
    grid-template-columns: 1fr 1fr;
    gap: 28px 24px;
  }

  .tree {
    left: 12px;
  }

}
@media (max-width: 560px) {
  .reasons,
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
