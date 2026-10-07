import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Acceptance tests for the user-owned library (docs/STORAGE.md):
//   Bibliograph can disappear. The user's research cannot.

const DRIVE = "http://127.0.0.1:9199";
const FIRESTORE = "http://127.0.0.1:8080/emulator/v1/projects/demo-bibliograph/databases/(default)/documents";
const sampleBib = readFileSync(new URL("../samples/sample.bib", import.meta.url), "utf8");
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
);
const LFADS = "sussilloLFADSLatentFactor2016";

interface DriveEntry {
  id: string;
  parents: string[];
  path: string;
  mimeType: string;
  version: number;
  text?: string;
}

async function driveTree(): Promise<DriveEntry[]> {
  return (await (await fetch(`${DRIVE}/__control/tree`)).json()) as DriveEntry[];
}

/** Files inside one library folder (by parent ids; several folders may share a name), relative paths. */
async function libraryFiles(rootId: string) {
  const tree = await driveTree();
  const inside = new Set([rootId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of tree) if (!inside.has(f.id) && f.parents.some((p) => inside.has(p))) (inside.add(f.id), (grew = true));
  }
  const root = tree.find((f) => f.id === rootId)!;
  return tree
    .filter((f) => f.id !== rootId && inside.has(f.id) && f.mimeType !== "application/vnd.google-apps.folder")
    .map((f) => ({ ...f, rel: f.path.slice(root.path.length + 1) }));
}

async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.waitForFunction(() => "__bibliographTestSignIn" in window);
  await page.evaluate((e) => (window as unknown as { __bibliographTestSignIn: (x: string) => Promise<void> }).__bibliographTestSignIn(e), email);
  await page.goto("/library");
}

async function topLevelFolders() {
  return (await driveTree()).filter((f) => f.mimeType === "application/vnd.google-apps.folder" && !f.path.includes("/")).map((f) => f.id);
}

async function createLibraryFromTour(page: Page): Promise<string> {
  const before = new Set(await topLevelFolders());
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: /Create “Bibliograph Library”/ }).click();
  await expect(page.locator(".tour h2")).toHaveText("Add papers");
  await page.getByText("Skip tour").click();
  await expect(page.locator(".tour")).toHaveCount(0);
  const created = (await topLevelFolders()).filter((id) => !before.has(id));
  expect(created).toHaveLength(1);
  return created[0];
}

async function importSample(page: Page) {
  await page.keyboard.press("a");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("tab", { name: "Import .bib" }).click();
  await page.getByText("…or paste BibTeX").click();
  await page.locator("details.paste textarea").fill(sampleBib);
  await page.getByRole("button", { name: "Import 3 papers" }).click();
  await expect(page.locator(".entry")).toHaveCount(3);
}

const synced = (page: Page) => expect(page.locator('[data-sync-status][data-phase="saved"]')).toBeVisible({ timeout: 20_000 });

test("Bibliograph can disappear; the library survives in Drive and rebuilds", async ({ page }) => {
  let rootId = "";

  await test.step("build a library: papers, tags, status, folder, notes with a link, a PDF", async () => {
    await signIn(page, `owner.${Date.now()}@example.com`);
    rootId = await createLibraryFromTour(page);
    await importSample(page);

    await page.locator(".entry", { hasText: "LFADS" }).click();
    await page.keyboard.press("5"); // Read
    const inspector = page.locator(".inspector");
    await inspector.getByLabel("Add tag").fill("favorite");
    await inspector.getByLabel("Add tag").press("Enter");
    await expect(inspector.locator(".tag", { hasText: "favorite" })).toBeVisible(); // let the layout settle
    await inspector.locator(".empty-notes").dblclick();
    await inspector.locator("textarea").pressSequentially("Builds on @[pand", { delay: 10 });
    await page.locator(".suggest li").first().waitFor();
    await page.keyboard.press("Enter");
    await inspector.locator("textarea").pressSequentially(" — same lab.", { delay: 5 });
    await expect(inspector.getByText("Saved", { exact: true })).toBeVisible();
    await inspector.getByRole("button", { name: "Done" }).click();
    await inspector.locator(".pdf input[type=file]").setInputFiles({ name: "lfads.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(inspector.getByRole("link", { name: "Open PDF" })).toBeVisible();

    await page.getByRole("button", { name: "New folder" }).click();
    await page.keyboard.type("Dynamics");
    await page.keyboard.press("Enter");
    await page.locator("a.nav-item", { hasText: "All papers" }).click();
    await page.locator(".entry", { hasText: "LFADS" }).dragTo(page.locator(".folder-row", { hasText: "Dynamics" }));
    await synced(page);
  });

  await test.step("human-readable: the Drive folder explains itself in open formats", async () => {
    const files = await libraryFiles(rootId);
    const rel = files.map((f) => f.rel).sort();
    expect(rel).toEqual(
      expect.arrayContaining(["README.md", "bibliograph.json", "library.json", "references.bib", `notes/${LFADS}.md`, `papers/${LFADS}.pdf`])
    );
    const text = (name: string) => files.find((f) => f.rel === name)!.text!;
    expect(text("README.md")).toContain("This folder is your research library");
    const library = JSON.parse(text("library.json")) as Array<Record<string, any>>;
    expect(library.map((i) => i.title)).toHaveLength(3);
    const lfads = library.find((i) => i.id === LFADS)!;
    expect(lfads).toMatchObject({ title: "LFADS - Latent Factor Analysis via Dynamical Systems", DOI: "10.48550/arxiv.1608.06315" });
    expect(lfads.custom.bibliograph).toMatchObject({ readingStatus: "read", note: `notes/${LFADS}.md`, pdf: `papers/${LFADS}.pdf` });
    expect(lfads.custom.bibliograph.tags).toContain("favorite");
    const manifest = JSON.parse(text("bibliograph.json"));
    expect(manifest).toMatchObject({ format: "bibliograph-library", version: 1 });
    expect(manifest.collections.map((c: { name: string }) => c.name)).toEqual(["Dynamics"]);
    expect(lfads.custom.bibliograph.collections).toEqual([manifest.collections[0].id]);
    expect(text(`notes/${LFADS}.md`)).toContain("Builds on @[pandarinathInferringSingletrialNeural2018] — same lab.");
    expect(text("references.bib")).toContain(`@misc{${LFADS},`);
  });

  await test.step("delete Bibliograph's entire database (index, profile, sync state)", async () => {
    await page.goto("about:blank");
    expect((await fetch(FIRESTORE, { method: "DELETE" })).ok).toBe(true);
  });

  await test.step("reconnect the Drive folder: the library comes back", async () => {
    await page.goto("/library");
    await expect(page.locator(".tour")).toBeVisible(); // a brand-new profile
    await page.getByRole("button", { name: "Start" }).click();
    // The copy can still see the folder it created (drive.file), so it offers to reconnect it.
    await page.getByRole("button", { name: /Reconnect “Bibliograph Library”/ }).first().click();
    await expect(page.getByText(/Loaded 3 papers/)).toBeVisible();
    if (await page.locator(".tour").count()) await page.getByText("Skip tour").click();

    await expect(page.locator(".entry")).toHaveCount(3);
    const row = page.locator(".entry", { hasText: "LFADS" });
    await expect(row.locator(".tag", { hasText: "favorite" })).toBeVisible();
    await expect(row.locator(".status-mark")).toHaveText("Read");
    await row.click();
    const inspector = page.locator(".inspector");
    await expect(inspector.locator(".prose a.cite")).toHaveText("Pandarinath et al. (2018)");
    await expect(inspector.getByRole("link", { name: "Open PDF" })).toBeVisible();
    await page.locator(".folder-row", { hasText: "Dynamics" }).getByRole("link").click();
    await expect(page.locator(".entry")).toHaveCount(1);
    await synced(page);
  });
});

test("a library moves to another copy as a .zip: download, then import", async ({ page }) => {
  await test.step("build a library with a note and a PDF, then download it", async () => {
    await signIn(page, `mover.${Date.now()}@example.com`);
    await createLibraryFromTour(page);
    await importSample(page);
    await page.locator(".entry", { hasText: "LFADS" }).click();
    const inspector = page.locator(".inspector");
    await inspector.locator(".empty-notes").dblclick();
    await inspector.locator("textarea").pressSequentially("Carried over in a zip.", { delay: 5 });
    await inspector.getByRole("button", { name: "Done" }).click();
    await inspector.locator(".pdf input[type=file]").setInputFiles({ name: "lfads.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(inspector.getByRole("link", { name: "Open PDF" })).toBeVisible();
    await synced(page);
  });

  const zipPath = test.info().outputPath("library.zip");
  await test.step("Settings → Download library (.zip)", async () => {
    await page.goto("/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download library (.zip)" }).click();
    await (await download).saveAs(zipPath);
  });

  await test.step("a different account imports it from the first-run tour", async () => {
    await signIn(page, `newcopy.${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByLabel("Library .zip file").setInputFiles(zipPath);
    await expect(page.getByText(/Imported 3 papers/)).toBeVisible({ timeout: 20_000 });
    if (await page.locator(".tour").count()) await page.getByText("Skip tour").click();
    await expect(page.locator(".entry")).toHaveCount(3);
    await page.locator(".entry", { hasText: "LFADS" }).click();
    const inspector = page.locator(".inspector");
    await expect(inspector.locator(".prose")).toContainText("Carried over in a zip.");
    await expect(inspector.getByRole("link", { name: "Open PDF" })).toBeVisible();
    // A new folder this copy created holds the files.
    const folders = (await driveTree()).filter((f) => /Bibliograph Library \(imported/.test(f.path) && !f.path.includes("/"));
    expect(folders).toHaveLength(1);
    expect((await libraryFiles(folders[0].id)).map((f) => f.rel)).toEqual(expect.arrayContaining(["library.json", `notes/${LFADS}.md`, `papers/${LFADS}.pdf`]));
  });
});

test("offline: edits stay instant, survive a reload, and sync when Drive returns", async ({ page }) => {
  await signIn(page, `offline.${Date.now()}@example.com`);
  const rootId = await createLibraryFromTour(page);
  await importSample(page);
  await synced(page);

  await fetch(`${DRIVE}/__control/offline?on=1`, { method: "POST" });
  try {
    await page.locator(".entry", { hasText: "LFADS" }).click();
    const inspector = page.locator(".inspector");
    const started = Date.now();
    await inspector.getByLabel("Add tag").fill("offline-tag");
    await inspector.getByLabel("Add tag").press("Enter");
    await expect(page.locator(".entry", { hasText: "LFADS" }).locator(".tag", { hasText: "offline-tag" })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(1_500); // no Drive round trip in the way
    await inspector.locator(".empty-notes").dblclick();
    await inspector.locator("textarea").pressSequentially("Written while Drive was down.", { delay: 5 });
    await expect(inspector.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.locator('[data-sync-status][data-phase="offline"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-sync-status]")).toContainText(/queued/);

    // Queued work isn't a fragile in-memory list: it survives a reload.
    await page.reload();
    await expect(page.locator('[data-sync-status][data-phase="offline"]')).toBeVisible({ timeout: 20_000 });
  } finally {
    await fetch(`${DRIVE}/__control/offline?on=0`, { method: "POST" });
  }

  await page.locator("[data-sync-status]").click();
  await page.getByRole("button", { name: "Sync now" }).click();
  await synced(page);
  const files = await libraryFiles(rootId);
  const library = JSON.parse(files.find((f) => f.rel === "library.json")!.text!) as Array<{ id: string; custom: { bibliograph: { tags: string[] } } }>;
  expect(library.find((i) => i.id === LFADS)!.custom.bibliograph.tags).toContain("offline-tag");
  expect(files.find((f) => f.rel === `notes/${LFADS}.md`)!.text).toContain("Written while Drive was down.");
});

test("notes edited outside Bibliograph flow back in", async ({ page }) => {
  await signIn(page, `outside.${Date.now()}@example.com`);
  const rootId = await createLibraryFromTour(page);
  await importSample(page);
  await page.locator(".entry", { hasText: "LFADS" }).click();
  await page.locator(".inspector .empty-notes").dblclick();
  await page.locator(".inspector textarea").pressSequentially("Original note.", { delay: 5 });
  await page.locator(".inspector").getByRole("button", { name: "Done" }).click();
  await synced(page);

  const note = (await libraryFiles(rootId)).find((f) => f.rel === `notes/${LFADS}.md`)!;
  await fetch(`${DRIVE}/__control/edit?id=${note.id}`, { method: "POST", body: note.text!.replace("Original note.", "Edited in another app.") });
  await page.locator("[data-sync-status]").click();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.locator(".inspector .prose")).toContainText("Edited in another app.");
});

test("deleting a paper trashes its PDF and note in Drive; Undo restores both", async ({ page }) => {
  await signIn(page, `trash.${Date.now()}@example.com`);
  const rootId = await createLibraryFromTour(page);
  await importSample(page);
  await page.locator(".entry", { hasText: "LFADS" }).click();
  const inspector = page.locator(".inspector");
  await inspector.locator(".empty-notes").dblclick();
  await inspector.locator("textarea").pressSequentially("A note worth keeping.", { delay: 5 });
  await inspector.getByRole("button", { name: "Done" }).click();
  await inspector.locator(".pdf input[type=file]").setInputFiles({ name: "lfads.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(inspector.getByRole("link", { name: "Open PDF" })).toBeVisible();
  await synced(page);

  const live = async () => (await libraryFiles(rootId)).map((f) => f.rel);
  expect(await live()).toEqual(expect.arrayContaining([`notes/${LFADS}.md`, `papers/${LFADS}.pdf`]));

  await page.locator(".entry", { hasText: "LFADS" }).click();
  await page.keyboard.press("Backspace");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".entry")).toHaveCount(2);
  await synced(page);
  expect(await live()).not.toContain(`papers/${LFADS}.pdf`);
  expect(await live()).not.toContain(`notes/${LFADS}.md`);
  const library = JSON.parse((await libraryFiles(rootId)).find((f) => f.rel === "library.json")!.text!) as Array<{ id: string }>;
  expect(library.map((i) => i.id)).not.toContain(LFADS);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".entry")).toHaveCount(3);
  await synced(page);
  expect(await live()).toEqual(expect.arrayContaining([`notes/${LFADS}.md`, `papers/${LFADS}.pdf`]));
  await page.locator(".entry", { hasText: "LFADS" }).click();
  await expect(page.locator(".inspector").getByRole("link", { name: "Open PDF" })).toBeVisible();
  await expect(page.locator(".inspector .prose")).toContainText("A note worth keeping.");
});
