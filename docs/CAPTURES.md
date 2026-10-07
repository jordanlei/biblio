# Website captures

Every image and video on the project website (`apps/site/src/App.vue`) is a capture
of the real app running locally, made by one script: [`scripts/capture-landing.mjs`](../scripts/capture-landing.mjs).
Nothing is mocked up by hand. When the UI changes, rerun the script so the page stays honest.

## Prerequisites

- **Java 11+** on `PATH`, for the Firebase emulators. Any JDK works, including an unpacked
  Temurin build: `export JAVA_HOME=…/Contents/Home; export PATH="$JAVA_HOME/bin:$PATH"`.
- **Playwright Chromium and ffmpeg**: `npx playwright install chromium`. This also installs
  Playwright's bundled ffmpeg (`~/Library/Caches/ms-playwright/ffmpeg-*/`), which the script uses to
  encode video. Set `FFMPEG=/path/to/ffmpeg` to use a different build.
- Network access. The demo fetches open-access PDFs from arXiv.

## Running it

Start a fresh local stack on its own port and mock-Drive folder, so captures never touch your
everyday `.dev-drive` data or a running `npm run dev:local`:

```sh
rm -rf .dev-drive-landing
WEB_PORT=5391 DEV_DRIVE_DIR=.dev-drive-landing npm run dev:local   # emulators + mock Drive + Vite
```

In a second terminal, once Vite is serving:

```sh
node scripts/capture-landing.mjs http://localhost:5391
```

A full run takes about two minutes and prints one line per output:

```
✓ inbox.webm (273 frames)
✓ library.jpg
✓ linking.webm (233 frames)
✓ research-notes.webm (281 frames)
```

Afterwards, open a poster or two and a frame from the middle of each video before committing. To
pull out a single frame:

```sh
~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac -ss 5 -i apps/site/public/landing/research-notes.webm -frames:v 1 /tmp/frame.png
```

Stop the stack before running `npx playwright test`, which starts its own stack on port 5391.

## What the script does

1. **Signs in as a fresh emulator user** through the test hook
   (`window.__biblioTestSignIn(email, name)`). Every run uses a new
   `demo.<timestamp>@example.com` account, so no state carries over between runs. No real Google
   account is involved.
2. **Builds a demo library through the UI**, the way a person would. It creates the Drive library,
   imports 8 papers (`e2e/fixtures/sample.bib` + `samples/sample.bib`), adds two tags, sets "Saved
   because" reasons, writes a paper note with `@[…]` links, and fetches two arXiv PDFs.
3. **Records and shoots**, in this order:

| Output | Crop | What it shows |
| --- | --- | --- |
| `library.jpg` | Whole window | Hero: the library with LFADS open in the inspector |
| `inbox.webm` | Paper list | Inbox filter on; each paper shelved with a number key (5, 3, 6, 6, 7, 2), with a keycap showing the key |
| `research-notes.webm` | Note pane | A new note: title, a question, bullets linking three papers with `@[`, then the preview and "Papers in this note" |
| `linking.webm` | Notes column | Typing `@[sus` in a note, picking the paper, following the link, then "Mentioned in notes" |

Each video also writes `<name>-poster.jpg`, a screenshot of the cropped region in its final state.
The page shows the poster until the video scrolls into view.

**Videos are cropped to the part of the screen that matters.** A full window shrunk into a page
column is unreadable. `record(name, steps, { width, height, crop })` takes a region in CSS pixels,
usually measured from the DOM just before recording:

- `listRegion(height)`: between the sidebar and the inspector (the inbox).
- The `.notes-editor` column, padded (linking).
- Everything right of `.notes-list` (research notes).

The inbox is recorded in a wider 1440×860 window so titles aren't cut off beside the inspector.

**Key presses are shown with a keycap.** `keycap(key, label, region)` flashes a small "5 Read"
badge at the bottom of the region, because a key press is otherwise invisible in a video. It is
added only during capture, never in the app.

A CSS rule injected at startup hides the "Local" test-mode badge, so captures look like production.

## How the video encoding works

Playwright's built-in `recordVideo` is low quality and hard to trim, so the script records with the
Chrome DevTools Protocol instead:

- `Page.enable`, then `Page.startScreencast` (JPEG, quality 92, at 2× device scale). Chrome only sends
  frames after `Page.enable`.
- Chrome sends frames only when something on screen changes. To keep real-time pacing, each frame is
  repeated until the next one arrives, giving a constant 20 fps (`FPS`).
- The frames are piped into Playwright's ffmpeg. That build is minimal: it reads only
  `image2pipe` + `mjpeg` from `pipe:0`, and writes only VP8 (`libvpx`) WebM. So the encode is:

  ```
  ffmpeg -f image2pipe -framerate 20 -c:v mjpeg -i pipe:0 -vf crop=<w>:<h>:<x>:<y>,scale=<width>:-2 \
         -c:v libvpx -b:v 2000k -qmin 4 -qmax 28 -an <name>.webm
  ```

  It does not support H.264/MP4, image-sequence globbing, or other input formats.
- Chrome may send frames smaller than the requested 2×, so the script reads the real frame width from
  the first JPEG's header and scales the crop to match. Then it encodes `crop=…,scale=<≤1200>:-2`.
- Each video is about 1.5–2.5 MB.

On the page, `LandingVideo.vue` loads a video only when it comes within 200 px of the viewport,
and pauses it when it scrolls away.

## Adding or changing a capture

- **Screenshot:** navigate, then `await shot("name")`. It waits for toasts to clear and moves the mouse
  away first. For a single element, use `locator.screenshot(...)`.
- **Video:** wrap the steps in `await record("name", async () => { … }, { crop })`, then add
  `<LandingVideo name="name" :width="…" :height="…" label="…" />` to `apps/site/src/App.vue`. Width and
  height are the crop's CSS size (half the poster's pixel size), so the page reserves the right
  space before the poster loads. Use `pause(ms)` between steps so the
  viewer can follow, and end on a frame that works as a poster: blur inputs, close menus, and scroll
  the interesting part into view.
- **Selectors:** keep locators unambiguous, because Playwright's strict mode fails on multiple matches.
  - Match library rows with `row(title)`, which filters on `.title`. A plain text match also hits
    "Saved because" text that mentions another paper's title.
  - Use `{ exact: true }` for short button names like "New", which would otherwise also match "New folder".
- **Order matters:** the steps build on each other's library state. Add new steps after the state
  they need exists, or set that state up in the "Build the demo library" block.

## Troubleshooting

- **Hangs at sign-in:** the emulators didn't start. Check that `java -version` works in the shell
  running `dev:local`.
- **A timeout on a locator:** the UI changed. Run the script with `PWDEBUG=1` to step through it.
  Also check whether a label or button name moved.
- **Characters missing from typed text:** this usually means a real app bug where a reactive
  watcher overwrites the input mid-typing. The Research Notes title had one; it now reloads only when
  switching notes. Fix the app, not the script.
