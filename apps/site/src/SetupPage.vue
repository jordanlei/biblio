<script setup lang="ts">
// The setup tutorial: from nothing to your own running copy of Bibliograph.
// Keep it in step with scripts/setup.mjs and docs/SELF_HOSTING.md.
import AppIcon from "../../web/src/components/AppIcon.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { REPO_URL, docUrl } from "./site";

const ownership = [
  { icon: "link", what: "The code", where: "Your fork on GitHub (or just a folder on your computer)", note: "Change anything. It's MIT licensed." },
  { icon: "settings", what: "Your copy of the app", where: "Your own Firebase project, at your-id.web.app", note: "Sign-in, a fast search index, and the website itself. Free plan." },
  { icon: "drive", what: "Your library", where: "A folder in your Google Drive", note: "Papers, notes, PDFs, and links, as plain files. Works without the app." }
];
</script>

<template>
  <main class="setup">
    <SiteHeader />

    <header class="intro">
      <p class="eyebrow">Setup tutorial</p>
      <h1 class="display">Your own Bibliograph in five minutes.</h1>
      <p class="lede">By the end you'll have your own copy of the app running at your own address, signed in with your Google account, saving your library to your Google Drive. Nobody else, including the people who make Bibliograph, is involved.</p>
    </header>

    <section class="block">
      <h2>What you'll own</h2>
      <ul class="own">
        <li v-for="item in ownership" :key="item.what">
          <AppIcon :name="item.icon" :size="18" />
          <div>
            <strong>{{ item.what }}</strong>
            <span>{{ item.where }}</span>
            <small>{{ item.note }}</small>
          </div>
        </li>
      </ul>
      <p class="aside">It costs nothing: everything fits in Firebase's free (Spark) plan, and setup never asks for a credit card.</p>
    </section>

    <section class="block">
      <h2>Before you start</h2>
      <ul class="needs">
        <li><strong>A Google account.</strong> This account owns your copy and your library. A personal Gmail works; some school or work accounts block creating Cloud projects.</li>
        <li><strong>Node.js 20 or newer.</strong> <a href="https://nodejs.org">nodejs.org</a>. Check with <code>node --version</code>.</li>
        <li><strong>git.</strong> <a href="https://git-scm.com/downloads">git-scm.com</a>. Check with <code>git --version</code>.</li>
      </ul>
    </section>

    <ol class="tutorial">
      <li>
        <h2>Get the code</h2>
        <p>
          To keep your changes on GitHub, <a :href="`${REPO_URL}/fork`">fork the repository</a> first and clone your fork. To just try it, clone it directly:
        </p>
        <pre class="terminal">git clone {{ REPO_URL }}.git
cd bibliograph</pre>
      </li>

      <li>
        <h2>Install</h2>
        <p>This downloads the app's dependencies, including the Firebase command-line tool, into the folder. Nothing is installed system-wide.</p>
        <pre class="terminal">npm install</pre>
      </li>

      <li>
        <h2>Run setup</h2>
        <p>Setup asks a couple of questions and does the rest. It's safe to stop and run again: every step checks what already exists first.</p>
        <pre class="terminal">npm run setup</pre>
        <p>Here's what you'll see. A browser window opens once so you can sign in to Google:</p>
        <pre class="terminal transcript"><b>1. Sign in to Google (Firebase CLI)</b>
   <i>✓</i> Signed in as ada@example.com

<b>2. Your Firebase project</b>
   Pick a new project ID. It becomes your address: &lt;id&gt;.web.app.
Project ID: [bibliograph-ada-3f2c] <u>⏎</u>
   <i>✓</i> Created bibliograph-ada-3f2c

<b>3. Web app registration</b>
   <i>✓</i> Web app Bibliograph

<b>4. Google APIs (Firestore, Drive, Picker, sign-in)</b>
   <i>✓</i> APIs on

<b>5. Firestore database</b>
   Where should your database live? nam5 (United States), eur3 (Europe), …
Location: [nam5] <u>⏎</u>
   <i>✓</i> Database created (nam5)

<b>6. Hosting site</b>
   <i>✓</i> https://bibliograph-ada-3f2c.web.app

<b>7. Google Picker key (for “Use an existing folder”)</b>
   <i>✓</i> Key ready (limited to the Picker API and bibliograph-ada-3f2c.web.app)

<b>8. Save bibliograph.config.json</b>
   <i>✓</i> Saved (gitignored: it describes this copy only)</pre>
        <p class="aside">
          Setup uses the Firebase command-line tool, signed in as you, on your own computer. If a step can't be done automatically (for example, an organization policy), setup prints a link to do that step by hand and carries on.
        </p>
      </li>

      <li>
        <h2>Turn on Google sign-in</h2>
        <p>This is the one step Google doesn't let tools do for you. Setup opens the page in your browser and waits:</p>
        <ol class="clicks">
          <li>If you see <strong>Get started</strong>, click it.</li>
          <li>Under <strong>Sign-in providers</strong>, choose <strong>Google</strong>.</li>
          <li>Switch on <strong>Enable</strong>, pick your email as the <strong>support email</strong>, and click <strong>Save</strong>.</li>
          <li>Back in the terminal, press <kbd>Enter</kbd>. Setup checks it worked.</li>
        </ol>
        <pre class="terminal transcript"><b>9. Google sign-in</b>
   Press Enter once it's saved. <u>⏎</u>
   <i>✓</i> Google sign-in is on

<b>10. Build and deploy</b>
   ✔  Deploy complete!
Deployed: https://bibliograph-ada-3f2c.web.app

<b>Done.</b> Open https://bibliograph-ada-3f2c.web.app and sign in.</pre>
      </li>

      <li>
        <h2>Sign in and pick your library folder</h2>
        <p>
          Open your address and click <strong>Continue with Google</strong>. Google asks you to let your copy see and edit your Drive. That lets any copy open your library folder, even one made by another copy; your copy only ever touches the folder you choose. Then choose
          <strong>Create “Bibliograph Library”</strong> (or <strong>Use an existing folder</strong> to open a library you already have). A short tour shows you around.
        </p>
        <p class="aside">
          If Google blocks sign-in or warns that the app isn't verified, open <strong>Google Auth Platform → Audience</strong> in the Cloud console for your project and add yourself as a test user, or publish the app.
        </p>
      </li>

      <li>
        <h2>Make it yours</h2>
        <p>It's your code now. Change anything, try it, and publish:</p>
        <pre class="terminal">npm run dev        <span class="faint"># your copy, reloading as you edit</span>
npm test           <span class="faint"># quick checks</span>
npm run deploy     <span class="faint"># publish to your-id.web.app</span></pre>
        <p>
          Want every push to your fork to deploy itself? Run <code>npm run setup -- --github</code> once. It needs the <a href="https://cli.github.com">GitHub CLI</a>. Start with
          <a :href="docUrl('ARCHITECTURE.md')">how it's built</a> to find your way around.
        </p>
      </li>
    </ol>

    <section class="block">
      <h2>Good to know</h2>
      <dl class="faq">
        <dt>Does anyone else see my library?</dt>
        <dd>
          No. Your copy runs in your own Google Cloud project and your files sit in your own Drive. There's no Bibliograph server and no analytics. Paper lookups go straight from your browser to public catalogs (OpenAlex, Crossref, DataCite, arXiv).
        </dd>
        <dt>What if I stop using Bibliograph?</dt>
        <dd>Your library is still in your Drive as PDFs, Markdown, CSL-JSON, and BibTeX that other tools read. Delete the Firebase project and nothing in your Drive changes.</dd>
        <dt>Can I move to another copy, or a newer version?</dt>
        <dd>Yes. Every copy reads the same <a :href="docUrl('LIBRARY_FORMAT.md')">library format</a>. Sign in to the other copy and choose <strong>Use an existing folder</strong>.</dd>
        <dt>Can I try it without a Google account?</dt>
        <dd>Yes: <code>npm run dev:local</code> runs everything on your computer with stand-ins for Google (needs Java 11+).</dd>
        <dt>Something went wrong.</dt>
        <dd>Run <code>npm run setup</code> again; finished steps are skipped. The <a :href="docUrl('SELF_HOSTING.md')">full guide</a> covers custom domains, the Chrome extension, and more.</dd>
      </dl>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.setup {
  min-height: 100vh;
  background: var(--bg);
}

.intro,
.block,
.tutorial {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 32px;
}

.intro {
  padding-top: 40px;
  padding-bottom: 32px;
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
  margin-bottom: 12px;
  font-family: var(--font-serif);
  font-size: calc(22px * var(--text-scale));
  font-weight: 650;
}

p,
li,
dd {
  font-size: calc(16px * var(--text-scale));
  line-height: 1.65;
  color: var(--text-2);
}

p + p,
p + pre,
pre + p,
ol + pre {
  margin-top: 14px;
}

a {
  color: var(--accent);
}

code,
kbd {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: 0.86em;
  color: var(--text);
}

.block {
  padding-top: 28px;
  padding-bottom: 28px;
}

.own {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.own li {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.own :deep(svg) {
  flex: none;
  margin-top: 3px;
  color: var(--accent);
}

.own div {
  display: grid;
  gap: 2px;
}

.own strong {
  color: var(--text);
}

.own small {
  color: var(--text-3);
  font-size: calc(13.5px * var(--text-scale));
}

.aside {
  margin-top: 14px;
  color: var(--text-3);
  font-size: calc(14.5px * var(--text-scale));
}

.needs {
  display: grid;
  gap: 8px;
  padding-left: 20px;
}

.needs strong,
.clicks strong,
.tutorial strong,
.faq strong {
  color: var(--text);
}

.tutorial {
  counter-reset: step;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 40px;
  margin-top: 20px;
  margin-bottom: 40px;
  list-style: none;
}

.tutorial > li {
  position: relative;
  min-width: 0;
  padding-left: 52px;
  counter-increment: step;
}

.tutorial > li::before {
  content: counter(step);
  position: absolute;
  top: -2px;
  left: 0;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 650;
}

.terminal {
  margin: 0;
  padding: 16px 20px;
  overflow-x: auto;
  border-radius: 10px;
  background: #1f1c17;
  color: #ece6d8;
  font-family: var(--font-mono);
  font-size: calc(13px * var(--text-scale));
  line-height: 1.65;
  white-space: pre;
}

.terminal .faint {
  color: #8f877a;
}

.transcript b {
  color: #fff;
}

.transcript i {
  color: #8fd3a5;
  font-style: normal;
}

.transcript u {
  color: #e9c46a;
  text-decoration: none;
}

.clicks {
  display: grid;
  gap: 4px;
  margin: 10px 0 0;
  padding-left: 20px;
}

.faq {
  display: grid;
  gap: 6px;
}

.faq dt {
  margin-top: 12px;
  color: var(--text);
  font-weight: 600;
}

.faq dd {
  margin: 0;
}

@media (max-width: 640px) {
  .intro,
  .block,
  .tutorial {
    padding-left: 16px;
    padding-right: 16px;
  }

  .tutorial > li {
    padding-left: 0;
    padding-top: 44px;
  }
}
</style>
