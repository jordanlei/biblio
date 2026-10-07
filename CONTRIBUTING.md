# Contributing

Bibliograph is open-source software that each person runs themselves. There is no central service.
Changes are welcome; please keep the rules below true.

## Rules that always hold

1. **Two kinds of site, never mixed.**
   - **The project website** is GitHub Pages, built from `apps/site` in this repository
     (<https://jordanlei.github.io/bibliograph/>). It explains Bibliograph and how to run it:
     features, comparison, How it works (Bibliograph is code, not a service), the setup tutorial,
     links to the code. It has no sign-in and no user data.
   - **Each person's copy** of the app is `apps/web`, deployed by its owner to their own Firebase
     project (`<their-id>.web.app` or their own domain). Signed out, it shows only a sign-in page.
     It doesn't advertise, and it isn't the project website.
2. **No one's deployment in the source.** Firebase projects, addresses, and keys come from the
   gitignored `bibliograph.config.json` (or `BIBLIOGRAPH_CONFIG` in CI), written by
   `npm run setup`. A build without one fails; it never falls back to someone else's project.
3. **Everything belongs to the person running it.** Their copy runs in their Google Cloud project,
   and their library is plain files in their Google Drive ([docs/LIBRARY_FORMAT.md](docs/LIBRARY_FORMAT.md)).
   Don't add a central server, accounts, analytics, or telemetry. Outside calls are limited to Google
   (sign-in, Drive, Picker) and public paper catalogs.
4. **Setup stays a five-minute, one-command job.** If a change needs new cloud configuration, add it
   to `scripts/setup.mjs` (rerunnable, with a manual fallback), the tutorial (`apps/site/src/SetupPage.vue`),
   the architecture diagram (`apps/site/src/HowItWorksPage.vue`), and [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).
5. **No personal data in the repository.** No real emails, local paths, private libraries, or
   project identifiers in code, docs, fixtures, or captures. Test data is made up; captures use the
   emulator's demo account.

## Working on it

```sh
npm install
npm run dev:local    # the app with emulators + a mock Drive; no Google account (needs Java 11+)
npm run site:dev     # the project website
npm test             # fast checks
npm run test:final   # everything: unit tests, typecheck, build, end-to-end
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for where things live, and
[docs/CAPTURES.md](docs/CAPTURES.md) to re-record the website's screenshots and videos after UI changes.
