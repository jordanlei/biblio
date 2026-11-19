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
    id: "ownership",
    eyebrow: "01 · Ownership",
    title: "Your library is a folder, not a subscription.",
    text: "Biblio keeps the library in your Google Drive as files you can open, move, back up, and keep if the app ever disappears.",
    points: [
      "Papers as CSL-JSON, notes as Markdown, PDFs, and BibTeX",
      "No central Biblio account or analytics",
      "Download the whole library as a .zip"
    ],
    visual: "drive"
  },
  {
    id: "continuity",
    eyebrow: "02 · Continuity",
    title: "A desk-first library that follows you.",
    text: "Open the same collection on a laptop, in a browser tab, or from your phone. Install Biblio like an app when you want it close at hand.",
    points: [
      "One library across your devices",
      "Installable web app for laptop and phone",
      "Your copy runs in your own Google account"
    ],
    image: "still-organize"
  },
  {
    id: "workflow",
    eyebrow: "03 · Workflow",
    title: "A small, legible system for reading.",
    text: "Biblio gives every paper a place to land, a clear reading status, and notes that stay useful outside the interface.",
    points: [
      "Inbox, Skim, and Read statuses",
      "Markdown notes with LaTeX math",
      "Tags for topics, folders for projects"
    ],
    image: "still-notes"
  },
  {
    id: "capture",
    eyebrow: "04 · Capture",
    title: "Save a paper at the moment you find it.",
    text: "Search, paste an identifier, import BibTeX, or use the browser extension. The paper lands in your Inbox, ready for the next pass.",
    points: [
      "Chrome extension for the page you are reading",
      "DOI, arXiv, and PubMed lookup",
      "OpenAlex search across 250M works"
    ],
    visual: "plugin"
  },
  {
    id: "links",
    eyebrow: "A little deeper",
    title: "Notes that connect your thinking.",
    text: "Link papers from Markdown notes and see backlinks in context. The files remain yours, even when the interface changes.",
    points: ["Type @[ to link a paper", "Backlinks show the surrounding sentence", "Standalone research notes"],
    image: "still-links"
  }
];
