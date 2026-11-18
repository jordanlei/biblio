<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { acceptSuggestion, alerts, checkAlerts, dismissSuggestion, follow, followLabel, unfollow, type Suggestion } from "../services/alerts";
import { shortAuthors } from "../services/library/library";
import { searchAuthors, type AuthorHit } from "../services/lookup";
import { toast, toastError } from "../services/ui";
import AppIcon from "./AppIcon.vue";

// Top of the Inbox: new work from followed authors and topics, plus managing what you follow.
const managing = ref(false);
const checking = ref(false);
const authorText = ref("");
const authorHits = ref<AuthorHit[]>([]);
const topicText = ref("");
const busy = ref<string | null>(null);

onMounted(() => void checkAlerts());

let timer: ReturnType<typeof setTimeout> | undefined;
watch(authorText, (text) => {
  clearTimeout(timer);
  if (text.trim().length < 3) return void (authorHits.value = []);
  timer = setTimeout(async () => {
    try {
      authorHits.value = (await searchAuthors(text.trim())).slice(0, 5);
    } catch {
      authorHits.value = [];
    }
  }, 300);
});

async function followAuthor(hit: AuthorHit) {
  authorText.value = "";
  authorHits.value = [];
  await run(() => follow("author", hit.id, hit.name));
}

async function followTopic() {
  const text = topicText.value.trim();
  if (!text) return;
  topicText.value = "";
  await run(() => follow("topic", text, text));
}

async function run(task: () => Promise<unknown>) {
  checking.value = true;
  try {
    await task();
  } catch (error) {
    toastError(error);
  } finally {
    checking.value = false;
  }
}

async function checkNow() {
  checking.value = true;
  try {
    const added = await checkAlerts({ force: true });
    toast(added ? `Found ${added} new paper${added === 1 ? "" : "s"}.` : "Nothing new.");
  } catch (error) {
    toastError(error);
  } finally {
    checking.value = false;
  }
}

async function act(suggestion: Suggestion, accept: boolean) {
  busy.value = suggestion.id;
  try {
    if (accept) await acceptSuggestion(suggestion);
    else await dismissSuggestion(suggestion);
  } catch (error) {
    toastError(error);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <section class="alerts" aria-label="New from what you follow">
    <header class="alerts-head">
      <h2 class="serif-head">New from what you follow</h2>
      <span class="spacer" />
      <button v-if="alerts.follows.length" class="btn sm quiet" type="button" :disabled="checking" @click="checkNow">{{ checking ? "Checking…" : "Check now" }}</button>
      <button class="btn sm quiet" type="button" :aria-expanded="managing" @click="managing = !managing">
        {{ alerts.follows.length ? `Following ${alerts.follows.length}` : "Follow authors or topics" }}
      </button>
    </header>

    <div v-if="managing" class="manage">
      <ul v-if="alerts.follows.length" class="follows">
        <li v-for="f in alerts.follows" :key="f.id" class="chip">
          <AppIcon :name="f.kind === 'author' ? 'user' : 'search'" :size="12" /> {{ f.label }}
          <button type="button" :aria-label="`Unfollow ${f.label}`" @click="run(() => unfollow(f.id))">×</button>
        </li>
      </ul>
      <div class="adders">
        <div class="author-add">
          <input v-model="authorText" class="input sm" placeholder="Follow an author…" aria-label="Follow an author" />
          <ul v-if="authorHits.length" class="author-hits">
            <li v-for="hit in authorHits" :key="hit.id">
              <button type="button" @click="followAuthor(hit)">
                <strong>{{ hit.name }}</strong>
                <span class="faint small">{{ [hit.institution, `${hit.works} works`].filter(Boolean).join(" · ") }}</span>
              </button>
            </li>
          </ul>
        </div>
        <form @submit.prevent="followTopic">
          <input v-model="topicText" class="input sm" placeholder="Follow a topic, e.g. “neural population dynamics”" aria-label="Follow a topic" />
        </form>
      </div>
      <p class="faint small">Checked when Biblio opens, at most twice a day, against OpenAlex. New papers wait here until you add or dismiss them.</p>
    </div>

    <ol v-if="alerts.suggestions.length" class="suggestions">
      <li v-for="s in alerts.suggestions" :key="s.id">
        <div class="body">
          <a class="title" :href="s.candidate.url ?? `https://openalex.org/${s.id}`" target="_blank" rel="noopener">{{ s.candidate.title }}</a>
          <p class="small muted">
            {{ shortAuthors(s.candidate.authors ?? []) }}<template v-if="s.candidate.issued?.year"> · {{ s.candidate.issued.year }}</template><template v-if="s.candidate.containerTitle"> · <cite class="venue">{{ s.candidate.containerTitle }}</cite></template>
          </p>
          <p class="small faint">via {{ followLabel(s.followId) ?? "an earlier follow" }}</p>
        </div>
        <div class="acts">
          <button class="btn sm" type="button" :disabled="busy === s.id" @click="act(s, true)"><AppIcon name="plus" :size="13" /> Add</button>
          <button class="btn sm quiet" type="button" :disabled="busy === s.id" @click="act(s, false)">Dismiss</button>
        </div>
      </li>
    </ol>
    <p v-else-if="alerts.follows.length" class="faint small">Nothing new right now.</p>
  </section>
</template>

<style scoped>
.alerts {
  display: grid;
  gap: 10px;
  margin: 8px 0 18px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.alerts-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.serif-head {
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  font-weight: 600;
}

.manage {
  display: grid;
  gap: 10px;
}

.follows {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.adders .input {
  width: 100%;
}

.author-add {
  position: relative;
}

.author-hits {
  position: absolute;
  z-index: 10;
  inset: calc(100% + 4px) 0 auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.author-hits button {
  display: grid;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
  cursor: pointer;
}

.author-hits button:hover {
  background: var(--surface-2);
}

.suggestions {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.suggestions li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.body {
  flex: 1;
  min-width: 0;
}

.title {
  color: var(--text);
  font-family: var(--font-serif);
  font-size: calc(15.5px * var(--text-scale));
  font-weight: 600;
  text-decoration: none;
}

.title:hover {
  text-decoration: underline;
}

.venue {
  font-family: var(--font-serif);
  font-style: italic;
}

.acts {
  display: flex;
  gap: 4px;
}

@media (max-width: 820px) {
  .adders {
    grid-template-columns: 1fr;
  }
}
</style>
