// The demo chapters: what the homepage lists and the demo viewer plays. Step times (seconds) were
// read off the recordings made by apps/site/scripts/capture.mjs; rerecording may shift them.
export type Step = { at?: number; text: string };
export type Chapter = { id: string; title: string; summary: string; video?: string; steps: Step[] };

export const chapters: Chapter[] = [
  {
    id: "start",
    title: "Sign-in and Library Folder in Google Drive",
    summary: "Sign in with Google and choose the Drive folder that holds your library.",
    video: "first-run",
    steps: [
      { at: 0, text: "Sign in with the Google account your copy belongs to." },
      { at: 3, text: "A short tour starts on the empty library." },
      { at: 4, text: "Choose where the library lives: a new “Biblio Library” folder in your Drive, or one you already have." },
      { at: 6, text: "The tour then points out how to add papers." }
    ]
  },
  {
    id: "search",
    title: "Paper Search, DOI and arXiv Lookup, and BibTeX Import",
    summary: "Search OpenAlex by topic, title, or author; paste DOIs or arXiv IDs; or import a .bib file.",
    video: "search",
    steps: [
      { at: 0, text: "Press A to add papers. Search by topic, title, or author; the other tabs take DOIs, arXiv IDs, or a .bib file." },
      { at: 1.5, text: "Results come from OpenAlex, with authors, venue, citation count, and abstract." },
      { at: 3.5, text: "Note why you’re saving a paper before adding it. The note stays with the paper." }
    ]
  },
  {
    id: "organize",
    title: "Hierarchical Inbox and Read Status",
    summary: "New papers wait in an Inbox; mark each Skim or Read with keys 1–3. Tags and folders hold topics and projects.",
    video: "organize",
    steps: [
      { at: 1, text: "Select a paper and press 3 to mark it Read." },
      { at: 2.5, text: "Press 2 for Skim." },
      { at: 4.5, text: "Press 1 to send a paper back to the Inbox. The dot marks papers still waiting there." },
      { at: 8, text: "Filters narrow the list to one shelf, papers with a PDF, or papers with notes." }
    ]
  },
  {
    id: "review",
    title: "Markdown Notes that Render Natively",
    summary: "Per-paper notes in Markdown, with LaTeX math, rendered in place and saved to Drive as Markdown files.",
    video: "review",
    steps: [
      { at: 0, text: "Selecting a paper opens its details, abstract, and notes in one panel." },
      { at: 1, text: "Write notes in Markdown next to the abstract." },
      { at: 6, text: "Done saves them to your Drive, as a Markdown file per paper." }
    ]
  },
  {
    id: "link",
    title: "Citation Links and Backlinks Between Papers",
    summary: "Type @[ to cite a library paper from any note; the cited paper lists every note that mentions it.",
    video: "linking",
    steps: [
      { at: 0, text: "In a paper’s notes, type @[ and a few letters of another paper." },
      { at: 3, text: "Pick it from your library; the note stores its citation key." },
      { at: 6, text: "In the preview, the link reads as a citation: Sussillo et al. (2016)." },
      { at: 9, text: "The cited paper lists this note under “Mentioned in notes”, with the sentence around the link." }
    ]
  },
  {
    id: "write",
    title: "Research Notes to Link Across Papers",
    summary: "Notes for a question or project, linking every paper that bears on it.",
    video: "research-notes",
    steps: [
      { at: 0, text: "Research notes are for anything bigger than one paper: a question, a project, a draft." },
      { at: 1, text: "Start a note and give it a title." },
      { at: 3, text: "Write in Markdown, linking papers with @[ as you go." },
      { at: 11, text: "Every paper you linked is listed under “Papers in this note”, with its shelf." }
    ]
  },
  {
    id: "extension",
    title: "Browser Plugin",
    summary: "A Chrome extension that saves the paper you are reading, with its PDF, using Zotero’s translators.",
    steps: [
      { text: "Open an article or its PDF in Chrome." },
      { text: "Click the Biblio extension, or use the page’s right-click menu. It reads the page only when you click." },
      { text: "Zotero’s translators read the paper’s details, and your Biblio saves it to the Inbox, with the PDF when one is available, including subscription PDFs your browser can already open." },
      { text: "Setup builds the extension for your copy’s address; install it on each computer in developer mode." }
    ]
  },
  {
    id: "install",
    title: "Installable Web App for Laptop and Phone",
    summary: "Install your Biblio as an app (PWA); every install reads the same library in your Drive.",
    steps: [
      { text: "On a computer, open your Biblio in Chrome or Edge and click the install icon in the address bar." },
      { text: "On a phone, open it in the browser and choose Share → Add to Home Screen." },
      { text: "Every install reads the same library in your Drive, so a paper saved on one is on the others." },
      { text: "Each deploy reaches installed copies on their next launch; Settings → App reloads it on demand." }
    ]
  },
  {
    id: "more",
    title: "Also Included",
    summary: "Smaller features that come with every copy.",
    steps: [
      { text: "references.bib, plus one .bib per folder, kept current in your Drive for LaTeX and Overleaf." },
      { text: "Citations between papers in your library, from OpenAlex." },
      { text: "Alerts for authors and topics you follow; new work arrives in the Inbox." },
      { text: "Duplicate finding and merging, such as a preprint and its published version." },
      { text: "Finding and attaching open-access PDFs." },
      { text: "Edits made offline queue and sync when you reconnect." },
      { text: "Import from Zotero, Mendeley, or any .bib file; export the whole library as a .zip." },
      { text: "⌘K to jump to any paper, note, or page; themes, fonts, and text size in Settings." }
    ]
  }
];
