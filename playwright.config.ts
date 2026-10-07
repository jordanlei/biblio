import { defineConfig } from "@playwright/test";

// End-to-end tests run against local test mode: Firebase emulators + mock Drive (see README).
// A dedicated port keeps the suite from attaching to some other dev server on 5173.
const PORT = 5391;

export default defineConfig({
  testDir: "e2e",
  // One shared emulator stack, and the data-loss test wipes the whole database: run serially.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, actionTimeout: 10_000 },
  webServer: {
    // A fresh mock Drive per run, so tests can inspect exactly what Biblio wrote.
    command: `rm -rf .dev-drive-e2e && WEB_PORT=${PORT} DEV_DRIVE_DIR=.dev-drive-e2e npm run dev:local`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Let dev:local stop the emulators cleanly so no Java process is left holding port 8080.
    gracefulShutdown: { signal: "SIGTERM", timeout: 20_000 }
  }
});
