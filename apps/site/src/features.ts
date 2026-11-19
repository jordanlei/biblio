// The features the homepage highlights, one section each, with its demo (apps/site/scripts/capture.mjs).
export type Feature = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  video?: { name: string; width: number; height: number };
};

export const features: Feature[] = [
  {
    id: "search",
    eyebrow: "Search and import",
    title: "Paper Search, DOI and arXiv Lookup, and BibTeX Import",
    text: "Find a paper and save it without leaving your library, with a note on why you saved it.",
    points: [
      "Search OpenAlex’s 250M works by topic, title, or author",
      "Paste DOIs, arXiv IDs, or PubMed IDs",
      "Import a .bib from Zotero, Mendeley, or Overleaf"
    ],
    video: { name: "search", width: 600, height: 326 }
  },
  {
    id: "organize",
    eyebrow: "Organize",
    title: "Hierarchical Inbox and Read Status",
    text: "New papers wait in an Inbox until you decide what they need.",
    points: [
      "Keys 1, 2, 3 for Inbox, Skim, and Read; unmarked means kept for reference",
      "Tags for topics, folders for projects",
      "Each folder keeps its own up-to-date .bib"
    ],
    video: { name: "organize", width: 600, height: 618 }
  },
  {
    id: "notes",
    eyebrow: "Notes",
    title: "Markdown Notes that Render Natively",
    text: "Write about a paper beside its abstract and PDF, and read your notes rendered in place.",
    points: [
      "Markdown, with LaTeX math between $$ … $$",
      "Saves as you type",
      "One Markdown file per paper in your Drive"
    ],
    video: { name: "review", width: 600, height: 468 }
  },
  {
    id: "links",
    eyebrow: "Citations",
    title: "Citation Links and Backlinks Between Papers",
    text: "Cite one paper from another’s notes, and see everywhere a paper has been cited.",
    points: [
      "Type @[ to link any paper in your library",
      "Links read as citations: Sussillo et al. (2016)",
      "Each paper lists the notes that cite it, with the sentence around the link"
    ],
    video: { name: "linking", width: 600, height: 468 }
  },
  {
    id: "research-notes",
    eyebrow: "Research notes",
    title: "Research Notes to Link Across Papers",
    text: "Notes for a question, a project, or a related-work draft that spans many papers.",
    points: [
      "Freeform Markdown, with @[ links to papers",
      "Every linked paper listed under the note, with its read status",
      "Each note is a Markdown file in your Drive"
    ],
    video: { name: "research-notes", width: 600, height: 585 }
  },
  {
    id: "drive",
    eyebrow: "Your files",
    title: "Library Stored as Plain Files in Your Google Drive",
    text: "Sign in with Google and choose the Drive folder your library lives in.",
    points: [
      "Papers as CSL-JSON, notes as Markdown, PDFs, and references.bib",
      "Readable without Biblio; download the whole library as a .zip",
      "Biblio can see only the files it creates"
    ],
    video: { name: "first-run", width: 1280, height: 800 }
  },
  {
    id: "extension",
    eyebrow: "Browser plugin",
    title: "Browser Plugin",
    text: "Save the paper you’re reading, with its PDF, from any publisher’s page in Chrome.",
    points: [
      "Reads the page with Zotero’s own translators, only when you click",
      "Fetches the PDF when one is available, including subscription PDFs your browser can open",
      "Saved papers land in your Inbox"
    ]
  }
];
