<script setup lang="ts">
// Data & privacy. States the guarantees and the honest limits; deliberately does not enumerate
// individual defences — a countermeasure checklist helps someone probing for gaps more than it
// helps someone deciding whether to trust this. Keep it in step with docs/SECURITY.md.
import AppIcon from "../../web/src/components/AppIcon.vue";
import FaqItem from "./components/FaqItem.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { REPO_URL, docUrl } from "./site";

// Who holds what, in the order a reader will wonder about it.
const access = [
  {
    icon: "user",
    who: "You",
    sees: "Everything",
    detail: "Your papers, notes, tags and PDFs, in a Drive folder you own. You're the only one who can sign in to your copy."
  },
  {
    icon: "drive",
    who: "Google",
    sees: "Your account and your files",
    detail: "You sign in with Google and the files live in your Drive — the same arrangement as any document you keep there."
  },
  {
    icon: "search",
    who: "Paper catalogs",
    sees: "What you look up",
    detail: "Searches and downloads go straight from your browser, so OpenAlex and publishers see your IP and the paper you asked about."
  },
  {
    icon: "link",
    who: "Biblio's authors, and other users",
    sees: "No access",
    detail: "They publish code; they don't operate your copy. Every install is a separate project with no shared infrastructure, so there's no system through which they could reach your library."
  }
];

const leaves = [
  { where: "OpenAlex", when: "Searching; finding a PDF", what: "Search terms, DOIs, titles" },
  { where: "Crossref, DataCite", when: "Pasting a DOI", what: "The identifier" },
  { where: "arXiv, publishers", when: "Downloading a PDF", what: "Which paper" },
  { where: "Google", when: "Sign-in and sync", what: "Your own account activity" }
];
</script>

<template>
  <main class="privacy">
    <SiteHeader />

    <header class="intro">
      <p class="eyebrow">Data &amp; privacy</p>
      <h1 class="display">Your library is yours. Here's exactly what that means.</h1>
      <p class="lede">
        Biblio has no central server. Your copy runs in your own Google account and your papers live in your own Drive — so most of the usual questions about a company
        holding your data simply don't apply. The ones that remain are below, including the parts that aren't private.
      </p>
    </header>

    <section class="block">
      <h2>Data access: who sees what?</h2>
      <ul class="who">
        <li v-for="row in access" :key="row.who">
          <AppIcon :name="row.icon" :size="18" />
          <div>
            <strong>{{ row.who }}</strong>
            <span class="verdict">{{ row.sees }}</span>
            <small>{{ row.detail }}</small>
          </div>
        </li>
      </ul>
    </section>

    <section class="block">
      <h2>What's protected</h2>
      <ul class="plain">
        <li><strong>Your library is readable only by you.</strong> A signed-in person can reach their own data and nothing else.</li>
        <li>
          <strong>Biblio sees only its own files in your Drive.</strong> It asks for Google's narrowest Drive permission, so it can't read the rest of your Drive — only what it
          created. That's also why importing a library copies it into a new folder rather than adopting one in place.
        </li>
        <li><strong>Your library outlives the app.</strong> It's plain files. Delete Biblio, the project, or the whole account and the folder in your Drive is untouched.</li>
        <li><strong>No analytics, anywhere.</strong> No telemetry, no tracking, no crash reporting, in the app or the extension.</li>
      </ul>
    </section>

    <section class="block">
      <h2>The browser extension</h2>
      <p class="callout">
        <AppIcon name="check" :size="17" />
        <span>It reads a page <strong>only when you click it</strong>. It doesn't watch your browsing, monitor your tabs, or run in the background.</span>
      </p>
      <ul class="plain">
        <li>It holds no Google or Firebase credentials — saving happens in the app, where you're already signed in.</li>
        <li>It talks only to your own Biblio address.</li>
        <li>It can download a paper's PDF when you ask, including from publishers that block ordinary web pages.</li>
      </ul>
    </section>

    <section class="block">
      <h2>What leaves your browser</h2>
      <p>
        Because there's no server in the middle, Biblio looks papers up directly. Those services see your IP address and what you asked about — no request identifies you as a
        Biblio user, but a catalog could still infer a reading list.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Where</th><th scope="col">When</th><th scope="col">What they learn</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in leaves" :key="row.where">
              <th scope="row">{{ row.where }}</th>
              <td>{{ row.when }}</td>
              <td>{{ row.what }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="aside">
        This is a real trade-off, not an oversight. The alternative is routing lookups through a server — which means someone runs that server and holds the list. Biblio prefers
        no middleman to a trusted one. A VPN covers the IP side if it matters for your work.
      </p>
    </section>

    <section class="block">
      <h2>What isn't private</h2>
      <p>Worth being straight about the limits:</p>
      <div class="faq">
        <FaqItem question="Catalogs can infer what you're reading">
          Covered above. It's intrinsic to looking papers up from your own browser with nothing in between.
        </FaqItem>
        <FaqItem question="Your copy is only as secure as your Google account">
          Anyone who can sign in as you can read your library. Turn on two-factor authentication.
        </FaqItem>
        <FaqItem question="The optional PDF helper keeps logs">
          If you deploy the optional Cloud Function for PDFs that browsers can't fetch, your cloud provider logs which URLs it retrieved. On a one-person install that's your own
          activity — but think twice before running a shared instance.
        </FaqItem>
        <FaqItem question="Google may warn that the app isn't verified">
          Expected for self-hosted software: your copy is a brand-new sign-in client that Google hasn't reviewed. It's your own app asking your own permission.
        </FaqItem>
        <FaqItem question="Biblio hasn't had a third-party audit">
          It's been reviewed adversarially during development and security-relevant behaviour is covered by automated tests, but no outside firm has examined it. The code is
          public if you'd like to look, or to have someone look for you.
        </FaqItem>
      </div>
    </section>

    <section class="block last">
      <h2>Found a problem?</h2>
      <p>
        Please report security issues privately through a
        <a :href="`${REPO_URL}/security/advisories/new`">security advisory</a> rather than a public issue. The technical write-up lives in
        <a :href="docUrl('SECURITY.md')">SECURITY.md</a>, and since you host your own copy, you can always read the code and patch it yourself.
      </p>
    </section>

    <SiteFooter />
  </main>
</template>

<style scoped>
.privacy {
  min-height: 100vh;
  background: var(--bg);
}

.intro,
.block {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 32px;
}

.intro {
  padding-top: 40px;
  padding-bottom: 20px;
}

.intro h1 {
  margin: 8px 0 16px;
  font-size: calc(clamp(30px, 3.6vw, 42px) * var(--text-scale));
  line-height: 1.1;
}

.lede {
  font-family: var(--font-serif);
  font-size: calc(18px * var(--text-scale));
  line-height: 1.55;
  color: var(--text-2);
}

.block {
  padding-top: 28px;
  padding-bottom: 12px;
}

.block.last {
  padding-bottom: 72px;
}

h2 {
  margin-bottom: 14px;
  font-family: var(--font-serif);
  font-size: calc(22px * var(--text-scale));
  font-weight: 650;
}

p,
li,
td {
  font-size: calc(15.5px * var(--text-scale));
  line-height: 1.65;
  color: var(--text-2);
}

strong,
th {
  color: var(--text);
}

a {
  color: var(--accent);
}

.who {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.who li {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.who :deep(svg),
.callout :deep(svg) {
  flex: none;
  margin-top: 3px;
  color: var(--accent);
}

.who div {
  display: grid;
  gap: 2px;
}

.verdict {
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 650;
  color: var(--accent);
}

.who small {
  color: var(--text-2);
  font-size: calc(14px * var(--text-scale));
  line-height: 1.5;
}

.plain {
  display: grid;
  gap: 10px;
  padding-left: 20px;
}

.callout {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid var(--accent);
  border-radius: 12px;
  background: var(--select);
}

.table-wrap {
  margin-top: 14px;
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
  margin-top: 14px;
  color: var(--text-3);
  font-size: calc(14.5px * var(--text-scale));
}

.faq {
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .intro,
  .block {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
