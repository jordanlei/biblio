// The features the homepage highlights, one section each, with a still from apps/site/scripts/capture.mjs
// or a drawn visual.
export type Feature = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  /** A still from capture.mjs in public/landing/, or a drawn visual. */
  image?: string;
  visual?: "drive" | "plugin";
};

export const features: Feature[] = [
  {
    id: "search",
    eyebrow: "Search and import",
    title: "Paper Search, DOI and arXiv Lookup, and BibTeX Import",
    text: "Add papers from an OpenAlex search, an identifier, or a BibTeX file, with a note on why you saved each one.",
    points: [
      "Search OpenAlex’s 250M works by topic, title, or author",
      "Paste DOIs, arXiv IDs, or PubMed IDs",
      "Import a .bib from Zotero, Mendeley, or Overleaf"
    ],
    image: "still-search"
  },
  {
    id: "organize",
    eyebrow: "Organize",
    title: "Hierarchical Inbox and Read Status",
    text: "New papers go to an Inbox. Each paper is marked Inbox, Skim, or Read, or left unmarked as a reference.",
    points: [
      "Keys 1, 2, 3 for Inbox, Skim, and Read; unmarked means kept for reference",
      "Tags for topics, folders for projects",
      "Each folder keeps its own up-to-date .bib"
    ],
    image: "still-organize"
  },
  {
    id: "notes",
    eyebrow: "Notes",
    title: "Markdown Notes that Render Natively",
    text: "Notes on each paper are written in Markdown and shown rendered, beside the abstract and PDF.",
    points: [
      "Markdown, with LaTeX math between $$ … $$",
      "Saves as you type",
      "One Markdown file per paper in your Drive"
    ],
    image: "still-notes"
  },
  {
    id: "links",
    eyebrow: "Citations",
    title: "Citation Links and Backlinks Between Papers",
    text: "A note can cite any paper in your library, and each paper lists the notes that cite it.",
    points: [
      "Type @[ to link any paper in your library",
      "Links read as citations: Sussillo et al. (2016)",
      "Each paper lists the notes that cite it, with the sentence around the link"
    ],
    image: "still-links"
  },
  {
    id: "research-notes",
    eyebrow: "Research notes",
    title: "Research Notes to Link Across Papers",
    text: "Standalone notes for a question or project, linked to the papers they discuss.",
    points: [
      "Freeform Markdown, with @[ links to papers",
      "Every linked paper listed under the note, with its read status",
      "Each note is a Markdown file in your Drive"
    ],
    image: "still-research-notes"
  },
  {
    id: "drive",
    eyebrow: "Your files",
    title: "Library Stored as Plain Files in Your Google Drive",
    text: "Your library is a folder in your Google Drive, chosen when you first sign in.",
    points: [
      "Papers as CSL-JSON, notes as Markdown, PDFs, and references.bib",
      "Readable without Biblio; download the whole library as a .zip",
      "Biblio can see only the files it creates"
    ],
    visual: "drive"
  },
  {
    id: "extension",
    eyebrow: "Browser plugin",
    title: "Browser Plugin",
    text: "A Chrome extension that adds the paper on the current page to your library, with its PDF.",
    points: [
      "Reads the page with Zotero’s own translators, only when you click",
      "Fetches the PDF when one is available, including subscription PDFs your browser can open",
      "Saved papers land in your Inbox"
    ],
    visual: "plugin"
  }
];
