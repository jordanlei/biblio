# Security and privacy

Biblio has no central server. Your copy runs in your own Google Cloud project and your library
lives in your own Drive, so there is no account of yours for the maintainers to look at. This
document says what that does and doesn't protect, and what still leaves your browser.

## What the maintainers can see

Nothing. They publish code; they don't run your copy. There is no analytics, telemetry, crash
reporting, or phone-home of any kind in the app or the extension.

## What leaves your browser

Biblio has no server to look things up for you, so lookups go straight from your browser to public
catalogs. Those services see your IP address and what you asked for:

| Host | When | What it learns |
| --- | --- | --- |
| `api.openalex.org` | Searching for papers; finding a PDF | Your search terms, DOIs, paper titles |
| `api.crossref.org`, `api.datacite.org` | Pasting a DOI | The DOI |
| `arxiv.org`, `openreview.net`, publisher hosts | Downloading a PDF | Which paper |
| `www.googleapis.com` | Sync, sign-in | Your own Google account activity |
| `fonts.googleapis.com` | Only if you pick a non-default reading font | Your IP |

No request carries your Biblio identity, account, or email — there's no API key or user agent
identifying you. But a catalog can still infer a reading list from a stream of DOIs and an IP
address. That is the honest cost of having no server in the middle: the alternative is proxying
lookups through one, which would mean *someone* holds that list. Nothing is logged on your side.

Default fonts are bundled with the app; Google Fonts is contacted only if you choose one of the
optional fonts in Settings.

## Your data

- **Firestore rules** allow each user to read and write only their own documents. Rules are
  default-deny, so anything not explicitly allowed is refused. Tested against cross-user reads,
  writes, listing, and undeclared collections.
- **Drive access** uses `drive.file`, Google's narrowest Drive permission: Biblio sees only the
  files it creates. It cannot read the rest of your Drive. This is why importing a library *copies*
  it into a new folder rather than adopting one in place.
- **Your Google access token** is held in memory and `sessionStorage` (cleared when the tab closes),
  never written to Firestore, and cleared on sign-out.
- **Notes are sanitised** before display (DOMPurify), so a pasted note can't run scripts.
- **Imported archives** are filtered against a strict allowlist, so a malicious `.zip` can't write
  outside the library folder.

## The browser extension

- It reads a page **only when you click it**. No background scanning, no tab monitoring, and no
  `tabs` permission.
- It holds no Google or Firebase credentials. Saving happens in the signed-in web app.
- Its content script runs **only on your own Biblio address**, so no other site can talk to it.
  Development builds additionally allow `localhost:5173`; released builds do not.
- `<all_urls>` exists so the worker can download a PDF you asked for, including from hosts that
  block ordinary web pages. It refuses private, loopback, and link-local addresses, so it can't be
  used to reach your local network.

## The optional PDF proxy

`functions/fetchPdf` is an optional Cloud Function for PDFs whose hosts block browser downloads. It
requires a signed-in user, refuses private and link-local addresses (re-checked on every redirect),
returns only real PDFs, and gives generic errors so it can't be used to probe a network. If you
deploy it, note that Cloud Run request logs will record which URLs were fetched — on a single-user
install that's your own activity, but don't run a shared instance without considering it.

## Reporting a problem

Open an issue, or for something sensitive, contact the maintainer privately through GitHub.
