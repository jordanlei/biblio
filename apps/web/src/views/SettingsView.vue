<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import AppearanceSettings from "../components/AppearanceSettings.vue";
import LibraryImport from "../components/LibraryImport.vue";
import { connectDriveFolder, createDriveFolder, DEFAULT_FOLDER_NAME, disconnectDriveFolder, driveFolderUrl, findOwnLibraries, trashLibraryFolder, type DriveFolderSelection } from "../services/drive";
import { downloadLibraryZip } from "../services/transfer";
import { deleteAllUserMetadata, deleteProfileDoc } from "../services/library";
import { clearLocalCache, deleteCurrentAuthUser, updateProfile, useSession } from "../services/session";
import { askConfirm, openAdd, toast, toastError } from "../services/ui";
import { connectLibraryFolder, rebuildFromDrive, stopSync, syncNow, syncStatus } from "../sync/librarySync";

const router = useRouter();
const session = useSession();
const busy = ref("");

async function run(label: string, task: () => Promise<unknown>) {
  busy.value = label;
  try {
    await task();
  } catch (error) {
    toastError(error);
  } finally {
    busy.value = "";
  }
}

const createFolder = () => run("create", async () => connectDriveFolder(await createDriveFolder(DEFAULT_FOLDER_NAME)));
const download = () =>
  run("download", async () => {
    const count = await downloadLibraryZip();
    toast(`Downloaded your library (${count} files).`);
  });

// Library folders this copy created (the only ones it can open); listed on request.
const ownLibraries = ref<DriveFolderSelection[] | null>(null);
const listOwn = () => run("list", async () => (ownLibraries.value = await findOwnLibraries()));
const reconnect = (folder: DriveFolderSelection) =>
  run("pick", async () => {
    const { loaded } = await connectLibraryFolder(folder);
    toast(loaded !== null ? `Loaded ${loaded} papers from “${folder.name}”.` : `Your library now lives in “${folder.name}”.`);
    ownLibraries.value = null;
  });

async function rebuild() {
  if (!confirm("Rebuild Bibliograph's index from the library in your Drive folder?\n\nDrive is the source of truth: what's shown here will be replaced by what's in Drive.")) return;
  await run("rebuild", async () => {
    const summary = await rebuildFromDrive();
    toast(summary ? `Rebuilt from Drive: ${summary.papers} papers, ${summary.notes} notes, ${summary.pdfs} PDFs.` : "No library found in that folder yet.");
  });
}


async function deleteAccount() {
  const folder = session.profile.value?.driveRootFolderName;
  const { confirmed, option } = await askConfirm({
    title: "Delete your Bibliograph account?",
    message: folder
      ? `Your account and Bibliograph's index will be deleted. Your library stays in your Google Drive folder “${folder}” — papers, notes, and PDFs, readable without Bibliograph — unless you also choose to trash it below.`
      : "Your account and everything Bibliograph stores will be deleted.",
    confirmLabel: "Delete account",
    danger: true,
    option: folder ? { label: `Also move my library folder “${folder}” to the Google Drive trash`, checked: false } : undefined
  });
  if (!confirmed) return;
  await run("account", async () => {
    stopSync();
    if (option) await trashLibraryFolder();
    await deleteAllUserMetadata();
    await deleteProfileDoc();
    await deleteCurrentAuthUser();
    await clearLocalCache();
  });
}
</script>

<template>
  <div class="settings">
    <header>
      <p class="eyebrow">Account</p>
      <h1 class="display">Settings</h1>
    </header>

    <AppearanceSettings />

    <section class="card pad">
      <div class="head">
        <AppIcon name="drive" :size="20" />
        <div>
          <h2>Your library in Google Drive</h2>
          <p class="muted small">
            Everything you put into Bibliograph — papers, folders, tags, shelves, notes, Research Notes, saved reasons, PDFs — is saved as ordinary files in a Drive folder you own.
            If Bibliograph went away tomorrow, your library would still be there, readable by people and other tools.
          </p>
        </div>
      </div>
      <template v-if="session.profile.value?.driveRootFolderId">
        <div class="state ok">
          <AppIcon name="check" />
          <span>Library folder: <strong>{{ session.profile.value.driveRootFolderName ?? "your Drive folder" }}</strong> · {{ syncStatus.phase === "saved" || syncStatus.phase === "conflict" ? "up to date" : syncStatus.phase === "saving" ? "saving…" : syncStatus.phase === "offline" ? "offline, changes queued" : syncStatus.phase === "needs-auth" ? "needs reconnecting" : syncStatus.phase }}</span>
          <a class="small" :href="driveFolderUrl(session.profile.value.driveRootFolderId)" target="_blank" rel="noopener">Open in Drive <AppIcon name="external" :size="11" /></a>
        </div>
        <dl class="layout small">
          <dt><code>papers/</code></dt>
          <dd>Your PDFs, named by citation key.</dd>
          <dt><code>notes/</code></dt>
          <dd>One Markdown file per paper with notes.</dd>
          <dt><code>library.json</code></dt>
          <dd>Citation metadata, tags, folders, shelves, saved reasons — CSL-JSON, readable by pandoc and Zotero.</dd>
          <dt><code>references.bib</code></dt>
          <dd>The whole library as BibTeX, kept up to date.</dd>
          <dt><code>bibliograph.json</code>, <code>README.md</code></dt>
          <dd>Format version, your folder tree, and a plain-language explanation.</dd>
        </dl>
        <p class="muted small">
          <code>references.bib</code> in that folder is always up to date. To export just a folder or search, use <em>Export .bib</em> above the list; to import, use
          <button class="link-btn" type="button" @click="openAdd('import')">Add papers → Import .bib</button>.
        </p>
        <div class="row wrap">
          <button class="btn sm" type="button" :disabled="!!busy" @click="syncNow()">Sync now</button>
          <button class="btn sm" type="button" :disabled="!!busy" @click="rebuild">{{ busy === "rebuild" ? "Rebuilding…" : "Rebuild from Drive" }}</button>
          <button class="btn sm" type="button" :disabled="!!busy" @click="download">{{ busy === "download" ? "Preparing…" : "Download library (.zip)" }}</button>
          <button class="btn sm quiet" type="button" @click="disconnectDriveFolder().catch(toastError)">Disconnect</button>
        </div>
        <h3 class="sub">Move a library in</h3>
        <p class="muted small">
          Bring in a library from another copy of Bibliograph or a backup: its <em>Download library</em> .zip, or the folder downloaded from Google Drive (also a .zip). It's copied
          into a new folder in your Drive; your current folder stays as it is.
        </p>
        <div class="row wrap">
          <LibraryImport />
          <button class="link-btn small" type="button" :disabled="!!busy" @click="listOwn">Switch to another library this copy made…</button>
        </div>
        <div v-if="ownLibraries" class="row wrap">
          <template v-for="folder in ownLibraries" :key="folder.id">
            <button v-if="folder.id !== session.profile.value?.driveRootFolderId" class="btn sm" type="button" :disabled="!!busy" @click="reconnect(folder)">{{ folder.name }}</button>
          </template>
          <span v-if="!ownLibraries.some((f) => f.id !== session.profile.value?.driveRootFolderId)" class="muted small">No other libraries found.</span>
        </div>
      </template>
      <template v-else>
        <p class="notice small">Not connected: your library currently exists only inside Bibliograph. Connect a folder to own it.</p>
        <div class="row wrap">
          <button class="btn primary" type="button" :disabled="!!busy" @click="createFolder">
            <AppIcon name="folder-plus" /> {{ busy === "create" ? "Creating…" : `Create “${DEFAULT_FOLDER_NAME}” folder` }}
          </button>
          <LibraryImport />
          <button class="link-btn small" type="button" :disabled="!!busy" @click="listOwn">Reconnect a library this copy made…</button>
        </div>
        <div v-if="ownLibraries" class="row wrap">
          <button v-for="folder in ownLibraries" :key="folder.id" class="btn sm" type="button" :disabled="!!busy" @click="reconnect(folder)">{{ folder.name }}</button>
          <span v-if="!ownLibraries.length" class="muted small">None found.</span>
        </div>
      </template>
    </section>


    <section class="card pad">
      <div class="head">
        <AppIcon name="help" :size="20" />
        <div>
          <h2>Guided tour</h2>
          <p class="muted small">Replay the step-by-step tour of the library.</p>
        </div>
      </div>
      <button class="btn" type="button" @click="updateProfile({ onboardingCompleted: false }).then(() => router.push('/library'))">Replay tour</button>
    </section>

    <section class="card pad danger-zone">
      <div class="head">
        <AppIcon name="user" :size="20" />
        <div>
          <h2>Account</h2>
          <p class="muted small">Signed in as {{ session.user.value?.email }}. Deleting your account leaves your library in Google Drive unless you choose otherwise.</p>
        </div>
      </div>
      <div class="row wrap">
        <button class="btn danger" type="button" :disabled="!!busy" @click="deleteAccount">Delete account…</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: grid;
  gap: 14px;
  width: min(760px, 100%);
  padding: 28px;
}

header {
  margin-bottom: 6px;
}

h1 {
  margin-top: 2px;
  font-size: calc(28px * var(--text-scale));
}

.pad {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  color: var(--text-2);
}

.head h2 {
  font-size: calc(15px * var(--text-scale));
  font-weight: 600;
  color: var(--text);
}

.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-ink);
}

.layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 14px;
  margin: 0;
  color: var(--text-2);
}

.layout dd {
  margin: 0;
}

.layout code {
  font-family: var(--font-mono);
  font-size: calc(12px * var(--text-scale));
}

.danger-zone {
  border-color: var(--danger-soft);
}

@media (max-width: 820px) {
  .settings {
    padding: 16px;
  }
}

.sub {
  margin-top: 18px;
  font-size: calc(14px * var(--text-scale));
  font-weight: 600;
}
</style>
