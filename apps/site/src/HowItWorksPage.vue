<script setup lang="ts">
// How it works: Biblio is code that sets up your own reference manager, not a service.
// The architecture diagram is plain HTML/CSS so it stays readable (and stacks) on a phone.
// Keep it true to scripts/setup.mjs and docs/STORAGE.md.
import AppIcon from "../../web/src/components/AppIcon.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { REPO_URL, SETUP_URL, docUrl } from "./site";

const firebase = [
  { icon: "settings", name: "Hosting", text: "Serves the web app at your-id.web.app" },
  { icon: "user", name: "Authentication", text: "Google sign-in. Only accounts you allow" },
  { icon: "search", name: "Firestore", text: "A fast index for search. Rebuilt from Drive any time" }
];

const lives = [
  { what: "The code", where: "GitHub (public), and your fork or folder", who: "Anyone can read it" },
  { what: "Your copy of the app", where: "Firebase Hosting, in your Google Cloud project", who: "You run it" },
  { what: "Your sign-in", where: "Firebase Authentication, in your project", who: "Only you" },
  { what: "The search index", where: "Firestore, in your project", who: "Only you. Disposable: rebuilt from Drive" },
  { what: "Your library", where: "A folder in your Google Drive", who: "Only you. This is the real copy" }
];
</script>

<template>
  <main class="how-page">
    <SiteHeader />

    <header class="intro">
      <p class="eyebrow">How it works</p>
      <h1 class="display">Biblio isn't a service. It's code that builds your own.</h1>
      <p class="lede">
        Biblio is pre-written, open-source code. Run one command and it sets up a complete reference manager from scratch, inside your own Google account: your own website,
        your own sign-in, your own database, and your library in your own Google Drive. Nobody else runs any part of it.
      </p>
    </header>

    <section class="wide" aria-labelledby="arch-title">
      <h2 id="arch-title">The architecture</h2>

      <div class="arch">
        <div class="computer">
          <span class="label"><AppIcon name="link" :size="15" /> Your computer, once</span>
          <p><strong>This code</strong>, cloned from GitHub. You run <code>npm run setup</code>.</p>
        </div>
        <div class="setup-arrow" aria-hidden="true"><span>creates &amp; deploys</span></div>

        <div class="account">
          <span class="label"><AppIcon name="user" :size="15" /> Your Google account</span>
          <div class="services">
            <div class="panel">
              <span class="panel-title">Your Firebase project</span>
              <ul class="chips">
                <li v-for="item in firebase" :key="item.name">
                  <AppIcon :name="item.icon" :size="15" />
                  <div>
                    <strong>{{ item.name }}</strong>
                    <small>{{ item.text }}</small>
                  </div>
                </li>
              </ul>
            </div>
            <div class="panel drive">
              <span class="panel-title">Your Google Drive</span>
              <ul class="tree">
                <li><AppIcon name="folder" :size="14" /> Biblio Library</li>
                <li class="in"><AppIcon name="library" :size="14" /> library.json</li>
                <li class="in"><AppIcon name="quote" :size="14" /> references.bib</li>
                <li class="in"><AppIcon name="note" :size="14" /> notes/*.md</li>
                <li class="in"><AppIcon name="pdf" :size="14" /> papers/*.pdf</li>
              </ul>
              <small>The real copy of your library, as plain files.</small>
            </div>
          </div>
        </div>

        <ol class="wires" aria-label="What the web app does">
          <li><span class="n">1</span> loads from Hosting</li>
          <li><span class="n">2</span> signs you in</li>
          <li><span class="n">3</span> searches the index</li>
          <li class="to-drive"><span class="n">4</span> reads &amp; writes your files</li>
        </ol>

        <div class="browser">
          <span class="label"><AppIcon name="search" :size="15" /> Your browser, every day</span>
          <p><strong>The web app</strong> you spun up. It talks directly to your Firebase project and your Drive. There's no server in between.</p>
        </div>

        <aside class="outside">
          <p><strong>Outside your account:</strong> looking up a paper asks public catalogs (OpenAlex, Crossref, DataCite, arXiv) directly from your browser.</p>
          <p><strong>Not in the picture:</strong> the people who write Biblio. They publish the code; they never see your copy or your library.</p>
        </aside>
      </div>
    </section>

    <section class="narrow two">
      <div>
        <h2>Set up once</h2>
        <p>
          <code>npm run setup</code> signs in as you and creates a Firebase project in your Google account. It turns on the Google APIs the app needs (Firestore, Drive, sign-in),
          creates the database and site, builds the web app from the code, and deploys it to your address. You make one click to turn on Google sign-in.
        </p>
      </div>
      <div>
        <h2>Every day</h2>
        <p>
          You open <code>your-id.web.app</code> and sign in. The app keeps a quick index in your Firestore so search is instant, and saves the library itself to a folder in your Drive.
          It can only see the Drive files it creates, so Google shows no warning when you sign in.
        </p>
      </div>
    </section>

    <section class="narrow">
      <h2>What lives where</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">What</th><th scope="col">Where</th><th scope="col">Who</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in lives" :key="row.what">
              <th scope="row">{{ row.what }}</th>
              <td>{{ row.where }}</td>
              <td>{{ row.who }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="aside">
        Your Drive folder is what matters. Delete the Firebase project and the library is still there. To move it to another copy, download it as a .zip (from the app, or
        straight from Google Drive) and import it there.
        <a :href="docUrl('STORAGE.md')">How storage works</a>
      </p>
    </section>

    <section class="narrow">
      <h2>What Biblio is not</h2>
      <ul class="nots">
        <li>Not an account with a company. There's nothing to sign up for.</li>
        <li>Not a central server. Each copy is separate, and none reports anywhere. No analytics.</li>
        <li>Not a subscription. Your copy fits in Firebase's free plan.</li>
        <li>Not a black box. The code is public and MIT licensed; change any part of your copy.</li>
      </ul>
    </section>

    <section class="narrow cta">
      <h2>Build yours</h2>
      <p>It takes about five minutes. You need a Google account, Node.js, and git.</p>
      <div class="row">
        <a class="btn primary lg" :href="SETUP_URL">Open the setup tutorial</a>
        <a class="btn lg" :href="REPO_URL">View the code</a>
      </div>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.how-page {
  min-height: 100vh;
  background: var(--bg);
}

.intro,
.narrow {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 32px;
}

.wide {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 32px 16px;
}

.intro {
  padding-top: 40px;
  padding-bottom: 28px;
}

.intro h1 {
  margin: 8px 0 16px;
  font-size: calc(clamp(32px, 4vw, 46px) * var(--text-scale));
  line-height: 1.08;
}

.lede {
  font-family: var(--font-serif);
  font-size: calc(19px * var(--text-scale));
  line-height: 1.55;
  color: var(--text-2);
}

h2 {
  margin-bottom: 14px;
  font-family: var(--font-serif);
  font-size: calc(24px * var(--text-scale));
  font-weight: 650;
}

p,
li,
td {
  font-size: calc(15.5px * var(--text-scale));
  line-height: 1.6;
  color: var(--text-2);
}

strong,
th {
  color: var(--text);
}

a {
  color: var(--accent);
}

code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: 0.86em;
  color: var(--text);
}

.narrow {
  padding-top: 32px;
  padding-bottom: 8px;
}

/* --- The diagram --------------------------------------------------------------------------- */

.arch {
  display: grid;
  gap: 0;
}

.label,
.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: calc(12.5px * var(--text-scale));
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.label :deep(svg) {
  color: var(--accent);
}

.computer,
.browser {
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.computer p,
.browser p {
  margin-top: 4px;
}

.computer {
  justify-self: center;
  width: min(520px, 100%);
  text-align: center;
}

/* A vertical arrow with a label beside it. */
.setup-arrow {
  position: relative;
  justify-self: center;
  width: 2px;
  height: 54px;
  margin: 4px 0;
  background: var(--accent);
}

.setup-arrow::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: -5px;
  border: 6px solid transparent;
  border-top: 8px solid var(--accent);
  border-bottom: 0;
}

.setup-arrow span {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: calc(13px * var(--text-scale));
  font-weight: 600;
  color: var(--accent);
}

.account {
  padding: 14px 16px 16px;
  border: 2px dashed var(--accent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--select) 55%, transparent);
}

.services {
  display: grid;
  grid-template-columns: 3fr 1.6fr;
  gap: 14px;
  margin-top: 10px;
}

.panel {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}

.chips {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.chips li {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: var(--surface-2);
}

.chips :deep(svg),
.tree :deep(svg) {
  flex: none;
  margin-top: 3px;
  color: var(--accent);
}

.chips div {
  display: grid;
  gap: 2px;
}

.chips small,
.drive small {
  color: var(--text-3);
  font-size: calc(12.5px * var(--text-scale));
  line-height: 1.4;
}

.tree {
  margin: 10px 0 8px;
  padding: 0;
  list-style: none;
}

.tree li {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 2px 0;
  font-size: calc(13.5px * var(--text-scale));
  color: var(--text);
}

.tree li.in {
  padding-left: 18px;
  color: var(--text-2);
}

/* The browser's four connections, as up/down arrows under the services they reach. */
.wires {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 1.6fr;
  gap: 14px;
  margin: 0;
  padding: 0 16px;
  list-style: none;
}

.wires li {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 64px;
  font-size: calc(13px * var(--text-scale));
  font-weight: 600;
  color: var(--accent);
  text-align: center;
}

.wires li::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-left: 2px solid var(--accent);
  opacity: 0.35;
}

.wires .n {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-size: 11.5px;
}

.wires li {
  background: linear-gradient(var(--bg), var(--bg)) center / 100% 24px no-repeat;
}

.browser {
  border-color: var(--accent);
}

.outside {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.outside p {
  font-size: calc(14px * var(--text-scale));
}

/* --- Below the diagram --------------------------------------------------------------------- */

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  max-width: 1040px;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 11px 14px;
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
  font-size: calc(15px * var(--text-scale));
}

tbody th {
  font-weight: 600;
  font-size: calc(15px * var(--text-scale));
}

.aside {
  margin-top: 12px;
  color: var(--text-3);
  font-size: calc(14.5px * var(--text-scale));
}

.nots {
  display: grid;
  gap: 6px;
  padding-left: 20px;
}

.cta {
  padding-bottom: 72px;
}

.cta .row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

@media (max-width: 760px) {
  .intro,
  .narrow,
  .wide {
    padding-left: 16px;
    padding-right: 16px;
  }

  .services,
  .chips,
  .outside,
  .two {
    grid-template-columns: 1fr;
  }

  /* On a phone the connections are a simple numbered list between the two boxes. */
  .wires {
    grid-template-columns: 1fr;
    gap: 6px;
    margin: 14px 0;
    padding: 0 0 0 18px;
    border-left: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .wires li {
    justify-content: flex-start;
    min-height: 0;
    background: none;
    text-align: left;
  }

  .wires li::before {
    display: none;
  }
}
</style>
