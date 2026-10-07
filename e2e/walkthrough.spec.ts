import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// The new-user journey from the brief, end to end, against the emulators and mock Drive.
const MOCK_DRIVE = "http://127.0.0.1:9199/";
const bib = readFileSync(new URL("./fixtures/sample.bib", import.meta.url), "utf8");
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
);

// Signs in through the emulator-only hook (see apps/web/src/services/emulatorHooks.ts). The Auth
// emulator's popup widget can't complete under the Playwright runner, so the popup itself is
// exercised manually; everything after sign-in here is the real app.
async function signInAsNewUser(page: Page) {
  await page.waitForFunction(() => "__bibliographTestSignIn" in window);
  await page.evaluate((email) => (window as unknown as { __bibliographTestSignIn: (e: string) => Promise<void> }).__bibliographTestSignIn(email), `researcher.${Date.now()}@example.com`);
  await page.goto("/library");
}

test("new researcher: sign in, set up, import, organize, annotate, export", async ({ page, context }) => {
  page.on("dialog", (dialog) => dialog.accept());
  let popups = 0;
  context.on("page", () => popups++);

  await test.step("sign in starts the guided tour", async () => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Continue with Google/ }).first()).toBeVisible();
    await signInAsNewUser(page);
    await expect(page.locator(".tour")).toBeVisible();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("First, choose where your library lives")).toBeVisible();
  });

  await test.step("create the Drive folder from the tour, then skip the rest", async () => {
    const before = popups;
    await page.getByRole("button", { name: /Create “Bibliograph Library”/ }).click();
    await expect(page.locator(".tour h2")).toHaveText("Add papers");
    expect(popups).toBe(before);
    expect(await (await fetch(MOCK_DRIVE)).text()).toContain("Bibliograph Library");
    await page.getByText("Skip tour").click();
    await expect(page.locator(".tour")).toHaveCount(0);
  });

  await test.step("import a .bib file, keeping citation keys", async () => {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("a");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("tab", { name: "Import .bib" }).click();
    await page.getByText("…or paste BibTeX").click();
    await page.locator("details.paste textarea").fill(bib);
    await expect(page.getByText("5 entries found")).toBeVisible();
    await page.getByRole("button", { name: "Import 5 papers" }).click();
    await expect(page.locator(".entry")).toHaveCount(5);
    await expect(page.locator(".entry").first()).toContainText("Attention Is All You Need");
    await expect(page.locator(".entry").first()).toContainText("vaswaniAttentionNeed2017");
  });

  await test.step("imports the Zotero sample in samples/sample.bib", async () => {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("a");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("tab", { name: "Import .bib" }).click();
    await page.getByText("…or paste BibTeX").click();
    await page.locator("details.paste textarea").fill(readFileSync(new URL("../samples/sample.bib", import.meta.url), "utf8"));
    await expect(page.getByText("3 entries found")).toBeVisible();
    await page.getByRole("button", { name: "Import 3 papers" }).click();
    await expect(page.locator(".entry")).toHaveCount(8);
  });

  await test.step("keyboard delete, undo, and inbox shelves", async () => {
    await page.locator(".entry", { hasText: "LFADS" }).click();
    await page.keyboard.press("Backspace");
    await expect(page.getByRole("dialog", { name: "Delete this paper?" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator(".entry")).toHaveCount(7);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(".entry")).toHaveCount(8);
    await page.locator(".entry", { hasText: "LFADS" }).click();
    await page.keyboard.press("2");
    await page.locator(".filters").getByRole("button", { name: "Read next" }).click();
    await expect(page.locator(".entry")).toHaveCount(1);
    await page.locator(".filters").getByRole("button", { name: "Read next" }).click();
    await expect(page.locator(".entry")).toHaveCount(8);
  });

  await test.step("write a research note that links papers, saved as Markdown in Drive", async () => {
    await page.getByRole("button", { name: "New note" }).click();
    await expect(page).toHaveURL(/\/research-notes\/[\w-]+/);
    await page.keyboard.type("Credit assignment"); // the new note's title is selected
    await page.keyboard.press("Enter"); // on to the text
    const text = page.locator(".notes-editor textarea");
    await text.pressSequentially("Which sequence models to compare? Start with @[sussillo", { delay: 5 });
    await page.locator(".suggest li").first().waitFor();
    await page.keyboard.press("Enter");
    await text.pressSequentially(".", { delay: 5 });
    await text.blur();
    await expect(page.locator(".linked")).toContainText("LFADS");
    await expect(page.locator("aside.sidebar")).toContainText("Credit assignment");
    await expect.poll(async () => (await fetch(MOCK_DRIVE)).text(), { timeout: 20_000 }).toContain("Credit assignment.md");

    // A second note straight after: its title and text both stick (saves don't overwrite each other).
    await page.getByRole("button", { name: "New note" }).first().click();
    await expect(page.locator(".title-input")).toHaveValue("Untitled note");
    await page.keyboard.type("Follow-ups");
    await page.keyboard.press("Enter");
    await page.locator(".notes-editor textarea").fill("Ask about @[vaswaniAttentionNeed2017].");
    await page.locator(".notes-editor textarea").blur();
    await expect(page.locator(".notes-list")).toContainText("Follow-ups");
    await expect(page.locator(".notes-list")).toContainText("Credit assignment");
    await expect.poll(async () => (await fetch(MOCK_DRIVE)).text(), { timeout: 20_000 }).toContain("Follow-ups.md");
    await page.locator(".notes-list .note-row", { hasText: "Credit assignment" }).click();

    // The linked paper lists the note, with the sentence around the link.
    await page.locator(".linked a", { hasText: "LFADS" }).click();
    await expect(page.getByText("Mentioned in notes")).toBeVisible();
    await expect(page.locator(".backlinks")).toContainText("Credit assignment");
    await expect(page.locator(".backlinks")).toContainText("Start with Sussillo");

    await page.goto("/library?status=readNext");
    await expect(page.locator(".entry")).toHaveCount(1);
    await page.goto("/library");
    await expect(page.locator(".entry")).toHaveCount(8);
  });

  await test.step("preview, keyboard navigation, and search", async () => {
    await page.locator(".entry", { hasText: "Attention Is All You Need" }).click();
    await expect(page.locator(".inspector")).toContainText("Attention Is All You Need");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".entry.selected")).not.toContainText("Attention Is All You Need");
    await page.keyboard.press("/");
    await page.keyboard.type("author:botvinick");
    await expect(page.locator(".entry")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".entry")).toHaveCount(8);
  });

  await test.step("folders, subfolders, and drag to file", async () => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.keyboard.type("Planning");
    await page.keyboard.press("Enter");
    await expect(page.getByText("This folder is empty")).toBeVisible();
    await page.locator(".folder-row", { hasText: "Planning" }).hover();
    await page.getByRole("button", { name: "New subfolder" }).click();
    await page.keyboard.type("Meta-control");
    await page.keyboard.press("Enter");
    await expect(page.locator(".folder-row")).toHaveCount(2);
    await page.locator("a.nav-item", { hasText: "All papers" }).click();
    await page.locator(".entry", { hasText: "Conflict monitoring" }).dragTo(page.locator(".folder-row", { hasText: "Meta-control" }));
    await page.locator(".folder-row", { hasText: "Planning" }).getByRole("link").click();
    await expect(page.locator(".entry")).toHaveCount(1);
  });

  let attentionUrl = "";
  await test.step("notes link papers with @[key] and show backlinks", async () => {
    await page.locator("a.nav-item", { hasText: "All papers" }).click();
    await page.locator(".entry", { hasText: "Human-level control" }).dblclick();
    await page.getByRole("button", { name: "Write" }).click();
    const notes = page.locator(".notes-editor textarea");
    await notes.click();
    await notes.pressSequentially("Builds on @[vasw", { delay: 10 });
    await expect(page.locator(".suggest li").first()).toContainText("Attention Is All You Need");
    await page.keyboard.press("Enter");
    await expect(notes).toHaveValue("Builds on @[vaswaniAttentionNeed2017]");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    const cite = page.locator(".prose a.cite");
    await expect(cite).toHaveText("Vaswani et al. (2017)");
    await cite.click();
    await expect(page.locator("h1.title")).toHaveText("Attention Is All You Need");
    await expect(page.getByText("Mentioned in notes")).toBeVisible();
    await expect(page.getByText(/Builds on Vaswani.* \(2017\)/)).toBeVisible();
    attentionUrl = page.url();
  });

  await test.step("attach a PDF to Drive and keep the key when editing details", async () => {
    await page.locator(".pdf input[type=file]").setInputFiles({ name: "attention.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByRole("link", { name: "Open PDF" })).toBeVisible();
    expect(await (await fetch(MOCK_DRIVE)).text()).toContain("vaswaniAttentionNeed2017.pdf");
    await page.getByRole("button", { name: "Edit details" }).click();
    await page.locator(".modal textarea").first().fill("Attention Is All You Need (edited)");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("h1.title")).toHaveText("Attention Is All You Need (edited)");
    await expect(page.locator(".key-eyebrow")).toContainText("vaswaniAttentionNeed2017");
  });

  await test.step("deep links survive a reload", async () => {
    await page.goto(attentionUrl);
    await expect(page.locator("h1.title")).toHaveText("Attention Is All You Need (edited)");
  });

  await test.step("export references.bib with stable keys", async () => {
    await page.goto("/library");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export .bib" }).click()]);
    expect(download.suggestedFilename()).toBe("references.bib");
    const text = readFileSync((await download.path())!, "utf8");
    expect(text).toContain("@inproceedings{vaswaniAttentionNeed2017,");
    expect(text.match(/^@/gm)).toHaveLength(8);
  });

  await test.step("deleting a paper moves its PDF to the Drive trash", async () => {
    await page.goto(attentionUrl);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Delete paper…" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/library/);
    await expect(page.locator(".entry")).toHaveCount(7);
    expect(await (await fetch(MOCK_DRIVE)).text()).not.toContain("vaswaniAttentionNeed2017.pdf");
  });

  await test.step("signing out locks private routes", async () => {
    await page.locator(".account > .nav-item").click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.locator(".account > .nav-item").click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
