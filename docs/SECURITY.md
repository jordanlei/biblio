# Security and privacy

Biblio has no central server. Your copy runs in your own Google Cloud project and your library
lives in your own Google Drive. This page says what that protects, what it doesn't, and where your
data goes.

A note on what's here: this describes the guarantees and the honest limits. It deliberately
doesn't catalogue individual defences — a list of countermeasures is more useful to someone
probing for gaps than to someone deciding whether to trust the software. The code is public if you
want to read the specifics.

## What other people can see

**The maintainers: nothing.** They publish code; they don't run your copy and have no access to it.
There is no Biblio account, no central database, no analytics, no telemetry, no crash reporting.

**Other users: nothing.** Each copy is a separate Google Cloud project. There is no shared
infrastructure between installs, so there is no "other users" to be exposed to.

**Google: what you'd expect.** You sign in with Google and your files are in Google Drive, so
Google can see your account activity and the files in your own Drive, exactly as with any document
you keep there.

## What leaves your browser

With no server of its own, Biblio looks papers up directly from your browser. Those services see
your IP address and what you asked about:

| Where | When | What they learn |
| --- | --- | --- |
| OpenAlex | Searching for papers; finding a PDF | Search terms, DOIs, paper titles |
| Crossref, DataCite | Pasting a DOI | The identifier |
| arXiv, OpenReview, publisher sites | Downloading a PDF | Which paper |
| Google (Drive, sign-in) | Sync and sign-in | Your own account activity |

No request identifies you as a Biblio user — there's no key, account id, or tracking parameter
attached. But a catalog can still infer a reading list from a stream of requests and an IP address.

**This is the real trade-off.** The alternative is routing lookups through a server, which means
someone operates that server and holds the list. Biblio prefers no middleman over a trusted one.
If this matters for your work, a VPN addresses the IP side.

Reading fonts are bundled with the app. Google Fonts is contacted only if you choose one of the
optional fonts in Settings.

## Your library

- **Only you can read it.** Access is scoped per user; a signed-in user can reach their own data
  and nothing else.
- **Biblio sees only its own files in your Drive.** It uses Google's narrowest Drive permission, so
  it cannot read the rest of your Drive — only the files it created. This is why importing a
  library copies it into a new folder instead of adopting one in place.
- **It survives Biblio.** The library is plain files — PDFs, Markdown, CSL-JSON, BibTeX. Delete the
  app, the project, or the whole account and the folder in your Drive is unchanged.

## The browser extension

- It reads a page **only when you click it**. It does not watch your browsing, monitor tabs, or run
  in the background.
- It holds no Google or Firebase credentials. Saving happens in the signed-in web app.
- It talks only to your own Biblio address, not to any other site.
- It can download a PDF you asked for, including from publishers that block ordinary web pages.
  That capability is restricted to fetching papers on your behalf.

## Known limits

Worth being straight about:

- **Catalog lookups reveal interests**, as above. Intrinsic to having no server.
- **The optional PDF proxy keeps logs.** If you deploy the Cloud Function, your cloud provider
  records which URLs it fetched. On a single-user install that's your own activity; think twice
  before running a shared instance.
- **Your copy is as secure as your Google account.** Anyone who can sign in as you can read your
  library. Use two-factor authentication.
- **An unverified app warning may appear** the first time you sign in, because your copy is a new
  OAuth client that Google hasn't reviewed. That's expected for self-hosted software.
- **Biblio is not audited by a third party.** It has been reviewed adversarially during
  development, and security-relevant behaviour is covered by automated tests, but no outside firm
  has examined it.

## Reporting a problem

Please report security issues privately rather than in a public issue: open a
[security advisory](https://github.com/jordanlei/biblio/security/advisories/new) on the repository.
If you self-host, you can also just read the code and patch your own copy — that's the point.
