import { reactive, watch } from "vue";
import { updateProfile, useSession } from "./session";

// Appearance preferences: theme, accent, fonts, text size. Applied as CSS variables on <html>.
// Saved to the user's profile (follows them across devices) and mirrored in localStorage so the
// page renders in the right style before sign-in completes.

export type ThemeChoice = "system" | "light" | "dark";

export interface Appearance {
  theme: ThemeChoice;
  accent: string;
  readingFont: string;
  uiFont: string;
  textSize: string;
}

interface AccentPreset {
  id: string;
  label: string;
  light: { accent: string; hover: string; soft: string; ink: string; select: string };
  dark: { accent: string; hover: string; soft: string; ink: string; select: string };
}

export const accents: AccentPreset[] = [
  { id: "oxblood", label: "Oxblood", light: { accent: "#7b2a20", hover: "#64211a", soft: "#f1e2d7", ink: "#7b2a20", select: "#ece2cc" }, dark: { accent: "#df947b", hover: "#eaa992", soft: "#3a251e", ink: "#e9a58d", select: "#2b251d" } },
  { id: "ink", label: "Ink", light: { accent: "#23407a", hover: "#1b3263", soft: "#e1e7f2", ink: "#23407a", select: "#e3e5e9" }, dark: { accent: "#8fb0e8", hover: "#a8c2ee", soft: "#1f2a3d", ink: "#a8c2ee", select: "#222833" } },
  { id: "forest", label: "Forest", light: { accent: "#2c5a3f", hover: "#224732", soft: "#dfeadf", ink: "#2c5a3f", select: "#e3e7da" }, dark: { accent: "#8cc7a0", hover: "#a3d4b3", soft: "#1e3326", ink: "#a3d4b3", select: "#212a22" } },
  { id: "teal", label: "Teal", light: { accent: "#1f6467", hover: "#184f52", soft: "#dceceb", ink: "#1f6467", select: "#e0e8e3" }, dark: { accent: "#7cc6c6", hover: "#98d3d3", soft: "#1c3233", ink: "#98d3d3", select: "#202b2a" } },
  { id: "plum", label: "Plum", light: { accent: "#6a2c5e", hover: "#55234b", soft: "#eedfe9", ink: "#6a2c5e", select: "#eae0e1" }, dark: { accent: "#d49cc6", hover: "#e0b2d4", soft: "#35202f", ink: "#e0b2d4", select: "#2b2128" } },
  { id: "ochre", label: "Ochre", light: { accent: "#8a5a12", hover: "#70490e", soft: "#f3e6cc", ink: "#7a4f10", select: "#efe3c8" }, dark: { accent: "#e2b25e", hover: "#ecc47c", soft: "#3a2e18", ink: "#ecc47c", select: "#2d2719" } },
  { id: "slate", label: "Slate", light: { accent: "#3d4a57", hover: "#2f3a45", soft: "#e4e7ea", ink: "#3d4a57", select: "#e6e4de" }, dark: { accent: "#a9b8c7", hover: "#bfccd9", soft: "#262d34", ink: "#bfccd9", select: "#24282c" } }
];

interface FontChoice {
  id: string;
  label: string;
  stack: string;
  /** Google Fonts css2 `family=` value; absent for self-hosted defaults and system fonts. */
  google?: string;
}

export const readingFonts: FontChoice[] = [
  { id: "literata", label: "Literata", stack: '"Literata Variable", Georgia, serif' },
  { id: "source-serif", label: "Source Serif 4", stack: '"Source Serif 4", Georgia, serif', google: "Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700" },
  { id: "newsreader", label: "Newsreader", stack: '"Newsreader", Georgia, serif', google: "Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700" },
  { id: "eb-garamond", label: "EB Garamond", stack: '"EB Garamond", Garamond, Georgia, serif', google: "EB+Garamond:ital,wght@0,400..700;1,400..700" },
  { id: "lora", label: "Lora", stack: '"Lora", Georgia, serif', google: "Lora:ital,wght@0,400..700;1,400..700" },
  { id: "plex-serif", label: "IBM Plex Serif", stack: '"IBM Plex Serif", Georgia, serif', google: "IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600" }
];

export const uiFonts: FontChoice[] = [
  { id: "inter", label: "Inter", stack: '"Inter Variable", ui-sans-serif, system-ui, sans-serif' },
  { id: "plex-sans", label: "IBM Plex Sans", stack: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif', google: "IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400" },
  { id: "dm-sans", label: "DM Sans", stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif', google: "DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700" },
  { id: "manrope", label: "Manrope", stack: '"Manrope", ui-sans-serif, system-ui, sans-serif', google: "Manrope:wght@400..700" },
  { id: "atkinson", label: "Atkinson Hyperlegible", stack: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif', google: "Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700" },
  { id: "system", label: "System default", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }
];

export const textSizes = [
  { id: "small", label: "Small", scale: 0.92 },
  { id: "default", label: "Default", scale: 1 },
  { id: "large", label: "Large", scale: 1.08 },
  { id: "larger", label: "Larger", scale: 1.18 }
];

export const DEFAULT_APPEARANCE: Appearance = { theme: "system", accent: "oxblood", readingFont: "literata", uiFont: "inter", textSize: "default" };

const STORAGE_KEY = "bibliograph.appearance";

function readCached(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Appearance>) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/** The live preferences. Edit fields directly; changes apply immediately. */
export const appearance = reactive<Appearance>(readCached());

const loadedFonts = new Set<string>();
function loadGoogleFont(font: FontChoice) {
  if (!font.google || loadedFonts.has(font.id)) return;
  loadedFonts.add(font.id);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
}

function vars(c: AccentPreset["light"]) {
  return `--accent:${c.accent};--accent-hover:${c.hover};--accent-soft:${c.soft};--accent-ink:${c.ink};--select:${c.select};`;
}

export function applyAppearance(next: Appearance = appearance) {
  const root = document.documentElement;
  const accent = accents.find((a) => a.id === next.accent) ?? accents[0];
  const reading = readingFonts.find((f) => f.id === next.readingFont) ?? readingFonts[0];
  const ui = uiFonts.find((f) => f.id === next.uiFont) ?? uiFonts[0];
  const size = textSizes.find((t) => t.id === next.textSize) ?? textSizes[1];
  loadGoogleFont(reading);
  loadGoogleFont(ui);

  if (next.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next.theme);

  let style = document.getElementById("bibliograph-appearance") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "bibliograph-appearance";
    document.head.appendChild(style);
  }
  // Same selector shape as styles.css so theme forcing keeps working.
  style.textContent = `
    :root { --font-serif:${reading.stack}; --font-ui:${ui.stack}; --text-scale:${size.scale}; ${vars(accent.light)} }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(accent.dark)} } }
    :root[data-theme="dark"] { ${vars(accent.dark)} }
  `;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Per-browser cache only.
  }
}

/** Adopt preferences stored in the user's profile (called when the profile loads). */
export function adoptAppearance(saved?: Partial<Appearance> | null) {
  if (!saved) return;
  Object.assign(appearance, { ...DEFAULT_APPEARANCE, ...saved });
}

export function resetAppearance() {
  Object.assign(appearance, DEFAULT_APPEARANCE);
}

applyAppearance();

// Adopt the profile's preferences once per signed-in user; save changes back (debounced).
const session = useSession();
let adoptedFor: string | null = null;
watch(
  () => session.profile.value,
  (profile) => {
    const uid = session.uid.value;
    if (!profile || !uid || adoptedFor === uid) return;
    adoptedFor = uid;
    adoptAppearance(profile.appearance);
  },
  { immediate: true }
);

let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  appearance,
  () => {
    applyAppearance();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!session.signedIn.value || JSON.stringify(session.profile.value?.appearance ?? null) === JSON.stringify(appearance)) return;
      updateProfile({ appearance: { ...appearance } }).catch(() => undefined);
    }, 800);
  },
  { deep: true }
);
