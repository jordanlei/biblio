<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { driveFolderUrl } from "../services/drive";
import { useSession } from "../services/session";
import { toastError } from "../services/ui";
import { dismissConflicts, reconnectDrive, syncNow, syncStatus } from "../sync/librarySync";
import AppIcon from "./AppIcon.vue";

const session = useSession();
const open = ref(false);

const s = computed(() => syncStatus.value);
const queued = computed(() => (s.value.pending > 0 ? `${s.value.pending} change${s.value.pending === 1 ? "" : "s"}` : ""));
const label = computed(() => {
  switch (s.value.phase) {
    case "disconnected":
      return "Library not in Drive";
    case "saving":
      return "Saving to Drive…";
    case "offline":
      return queued.value ? `Offline — ${queued.value} queued` : "Offline";
    case "needs-auth":
      return "Reconnect Drive to sync";
    case "error":
      return "Sync error — retrying";
    case "conflict":
      return "Saved · kept both versions";
    case "idle":
      return queued.value ? `${queued.value} to save` : "Saved to Drive";
    default:
      return "Saved to Drive";
  }
});
const tone = computed(() => (["offline", "needs-auth", "disconnected", "conflict"].includes(s.value.phase) ? "warn" : s.value.phase === "error" ? "error" : "ok"));
const when = computed(() => (s.value.lastSyncedAt ? new Date(s.value.lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""));

async function reconnect() {
  try {
    await reconnectDrive();
  } catch (error) {
    toastError(error);
  }
}
</script>

<template>
  <div class="sync">
    <RouterLink v-if="s.phase === 'disconnected'" class="row-btn warn" data-tour="drive" to="/settings">
      <AppIcon name="drive" :size="15" /> <span>Connect Google Drive</span>
    </RouterLink>
    <button v-else class="row-btn" :class="tone" type="button" data-sync-status :data-phase="s.phase" @click="open = !open">
      <span v-if="s.phase === 'saving'" class="spinner" />
      <AppIcon v-else :name="tone === 'ok' ? 'check' : 'drive'" :size="15" />
      <span class="text">{{ label }}</span>
    </button>

    <div v-if="open && s.phase !== 'disconnected'" class="pop card" @mouseleave="open = false">
      <p class="small"><strong>Your library lives in Google Drive.</strong> Biblio keeps a fast copy for searching; Drive holds the real one.</p>
      <p class="small faint">
        Folder: {{ session.profile.value?.driveRootFolderName ?? "connected folder" }}<template v-if="when"> · last saved {{ when }}</template>
      </p>
      <p v-if="s.message" class="small notice">{{ s.message }}</p>
      <ul v-if="s.conflicts.length" class="conflicts small">
        <li v-for="c in s.conflicts" :key="c">{{ c }}</li>
      </ul>
      <div class="row wrap">
        <button v-if="s.phase === 'needs-auth'" class="btn sm primary" type="button" @click="reconnect">Reconnect Drive</button>
        <button v-else class="btn sm" type="button" @click="syncNow()">Sync now</button>
        <a class="btn sm quiet" :href="driveFolderUrl(session.profile.value?.driveRootFolderId ?? '')" target="_blank" rel="noopener">Open folder <AppIcon name="external" :size="11" /></a>
        <button v-if="s.conflicts.length" class="btn sm quiet" type="button" @click="dismissConflicts">Dismiss</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sync {
  position: relative;
  margin-bottom: 6px;
}

.row-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-3);
  font-size: calc(12.5px * var(--text-scale));
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.row-btn:hover {
  background: var(--surface-3);
}

.row-btn.warn {
  background: var(--warn-soft);
  color: var(--warn-ink);
  font-weight: 500;
}

.row-btn.error {
  color: var(--danger);
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pop {
  position: absolute;
  z-index: 20;
  bottom: 36px;
  left: 0;
  right: 0;
  display: grid;
  gap: 8px;
  padding: 12px;
  box-shadow: var(--shadow);
}

.conflicts {
  margin: 0;
  padding-left: 16px;
  color: var(--warn-ink);
}

.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
