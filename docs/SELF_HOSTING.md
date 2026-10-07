# Run your own copy

Biblio is open-source software you run yourself. There's no Biblio service: everyone,
including the people who write it, uses their own copy of the app: their own Firebase project,
database, Google sign-in, and web address. You can change the code however you like.

- **The project website** (<https://jordanlei.github.io/biblio/>, GitHub Pages) explains
  Biblio. [How it works](https://jordanlei.github.io/biblio/how-it-works/) shows the architecture. Its [setup tutorial](https://jordanlei.github.io/biblio/setup/) is the friendly
  version of this guide.
- **Your copy** (`https://<your-id>.web.app`) is just your library behind a sign-in page.

Your copy is completely separate from anyone else's. Your account, your Firestore index, and your
site live in a Google Cloud project you own. Your library still lives in your Google Drive, in the
same open format ([LIBRARY_FORMAT.md](LIBRARY_FORMAT.md)). It costs nothing on Firebase's free
(Spark) plan.

## What you need

- A Google account.
- [Node.js](https://nodejs.org) 20 or newer, and git.
- Optional: the [GitHub CLI](https://cli.github.com) (`gh auth login`), if you want every push to deploy.
- Optional: Java 11+, only for `npm run dev:local` (local test mode with emulators).

## Set up (about 5 minutes)

Fork this repository on GitHub, or just clone it:

```sh
git clone https://github.com/<you>/biblio.git
cd biblio
npm install
npm run setup
```

`npm run setup` walks through each step and skips anything that already exists, so it's safe to rerun:

1. **Sign in** to the Firebase CLI with your Google account (opens your browser once).
2. **Pick a project ID**, e.g. `biblio-ada-3f2c`. It becomes your address: `https://<id>.web.app`.
   Setup creates the Firebase project, or reuses one you already have.
3. **Register a web app** in the project and read its settings.
4. **Turn on the Google APIs** the app uses: Firestore, Drive, and sign-in.
5. **Create the Firestore database.** Setup asks where to put it (`nam5` = United States,
   `eur3` = Europe, or a single region).
6. **Create the hosting site.**
7. **Save `biblio.config.json`**, the one file that says which project this copy uses, and
   build the Chrome extension for your address (`apps/extension/dist`).
8. **Turn on Google sign-in.** This is the one step Google doesn't allow tools to do for you. Setup
   opens the right page: choose **Google → Enable**, pick your email as the support email, **Save**,
   then press Enter. Setup checks that it worked.
9. **Build and deploy.** Setup prints your address. Open it and sign in.

Flags: `--project <id>` to skip the question, `--dry-run` to see what would happen without changing
anything, `--no-deploy` to stop before deploying, `--github` to set up automatic deploys (below).

For steps 4, 6, and 8, setup calls Google's APIs as the account you signed in to the Firebase CLI
with, on your machine. If any call fails (for example, an organization policy), setup prints the
console page to do that step by hand and carries on.

## Change it

```sh
npm run dev          # your copy, live-reloading, against your own Firebase project
npm run dev:local    # or: no Google account at all — emulators + a mock Drive (needs Java)
npm test             # fast unit tests
npm run deploy       # build and publish to https://<id>.web.app
```

Start with [ARCHITECTURE.md](ARCHITECTURE.md) for where things live, and [EXTENDING.md](EXTENDING.md)
to add your own features in a folder upstream never touches. Changes to the on-Drive format
should keep [LIBRARY_FORMAT.md](LIBRARY_FORMAT.md) readable by other copies, so libraries stay portable.

## Deploy on every push (optional)

```sh
npm run setup -- --github
```

This creates a deploy-only service account in your project, then stores two things in your
GitHub repository: its key as the secret `FIREBASE_SERVICE_ACCOUNT`, and your config as the variable
`BIBLIO_CONFIG`. After that, every push to `main` runs the tests and deploys
([.github/workflows/deploy.yml](../.github/workflows/deploy.yml)). A fork without these settings
skips the workflow.

The service account can deploy hosting and Firestore rules, and nothing else. To revoke it, delete
`biblio-deploy` under *IAM & Admin → Service accounts* in the Google Cloud console.

## `biblio.config.json`

```json
{
  "projectId": "biblio-ada-3f2c",
  "appUrl": "https://biblio-ada-3f2c.web.app",
  "firebase": { "apiKey": "…", "authDomain": "…", "projectId": "…", "storageBucket": "…", "messagingSenderId": "…", "appId": "…" }
}
```

- It's read at build time (`apps/web/vite.config.ts`). In CI it comes from the `BIBLIO_CONFIG`
  variable instead. `VITE_FIREBASE_*` environment variables override single values (see `.env.example`).
- Everything in it is public by design (it ships inside the web page), but it's specific to one copy,
  so it's gitignored. There is no built-in fallback: a copy without this file refuses to build rather
  than quietly using someone else's project.
- `npm run deploy` and `npm run firebase -- <command>` always target the project named here.

## Good to know

- **Signing in.** Biblio asks Google only for the Drive files it creates (`drive.file`). Google
  treats that as low-risk, so there's no "unverified app" warning and nothing to get verified.
- **Your own domain.** Add it under *Hosting* in the Firebase console, then add it to
  *Authentication → Settings → Authorized domains*.
- **Cloud Functions** (`functions/`) are optional and need the paid Blaze plan; the app works without them.
- **The Chrome extension:** setup builds it for your address into `apps/extension/dist`
  (`npm run build:extension` to rebuild). Load that folder unpacked (see its README).
- **Moving between copies.** Your copy only sees the Drive files it created, so a library moves as
  files: in the old copy, *Settings → Download library (.zip)*; in the new one, *Import a library*.
  No app at hand (say you deleted the old Firebase project)? Download the library folder from Google
  Drive (it arrives as a .zip) and import that. The import goes into a new folder; the original is
  left as it is.
