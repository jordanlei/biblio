<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BrandMark from "../components/BrandMark.vue";
import { usingEmulators } from "../firebase";
import { signIn } from "../services/session";

// The signed-out page of this copy of Bibliograph: just sign-in. What Bibliograph is and how to run
// your own copy lives on the project website (apps/site), not in each person's app.

const router = useRouter();
const route = useRoute();
const busy = ref(false);
const error = ref("");

async function login() {
  busy.value = true;
  error.value = "";
  try {
    await signIn();
    await router.replace((route.query.next as string) || "/library");
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
      error.value = code === "auth/popup-blocked" ? "Your browser blocked the sign-in window. Allow pop-ups for this site and try again." : "Sign-in didn't complete. Please try again.";
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="login">
    <section class="signin">
      <BrandMark :size="44" />
      <h1 class="display">Bibliograph</h1>
      <p class="sub">Sign in to your library.</p>
      <button class="btn primary lg" type="button" :disabled="busy" @click="login">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
        {{ busy ? "Waiting for Google…" : "Continue with Google" }}
      </button>
      <p v-if="error" class="notice error small">{{ error }}</p>
      <p v-if="usingEmulators" class="notice ok small">Local test mode: sign-in uses the Firebase Auth emulator (any made-up account works) and PDFs go to a mock Drive.</p>
      <p class="fine">Your library is saved to your own Google Drive.</p>
    </section>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px 16px;
  background: var(--bg);
}

.signin {
  display: grid;
  justify-items: center;
  gap: 14px;
  width: min(380px, 100%);
  text-align: center;
}

h1 {
  margin-top: 4px;
  font-size: calc(32px * var(--text-scale));
}

.sub {
  margin-bottom: 10px;
  font-family: var(--font-serif);
  font-size: calc(17px * var(--text-scale));
  color: var(--text-2);
}

.fine {
  margin-top: 6px;
  font-size: calc(13px * var(--text-scale));
  color: var(--text-3);
}
</style>
