import { reactive } from "vue";

export type AddTab = "search" | "identifiers" | "import" | "manual";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

/** App-wide UI state that outlives a single view. */
export const ui = reactive({
  addOpen: false,
  addTab: "search" as AddTab,
  helpOpen: false,
  paletteOpen: false,
  toasts: [] as Toast[],
  /** Ordered paper IDs of the library list the user last looked at; drives prev/next on paper pages. */
  listIds: [] as string[],
  listLabel: "All papers",
  listRoute: "/library" as string,
  selectedId: null as string | null
});

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  /** An optional checkbox, e.g. "Also move the Drive folder to the trash". */
  option?: { label: string; checked: boolean };
  resolve: (result: { confirmed: boolean; option: boolean }) => void;
}

/** The one confirmation dialog used for every destructive action (see components/ConfirmDialog.vue). */
export const confirmState = reactive({ request: null as ConfirmRequest | null });

export function askConfirm(request: Omit<ConfirmRequest, "resolve">): Promise<{ confirmed: boolean; option: boolean }> {
  return new Promise((resolve) => {
    confirmState.request = {
      ...request,
      resolve: (result) => {
        confirmState.request = null;
        resolve(result);
      }
    };
  });
}

let toastId = 0;
export function toast(text: string, options: { tone?: Toast["tone"]; action?: Toast["action"]; timeout?: number } = {}) {
  const id = ++toastId;
  ui.toasts.push({ id, text, tone: options.tone ?? "info", action: options.action });
  setTimeout(() => dismissToast(id), options.timeout ?? (options.tone === "error" ? 8000 : 4000));
}

export function toastError(error: unknown, fallback = "Something went wrong.") {
  toast(error instanceof Error ? error.message : fallback, { tone: "error" });
}

export function dismissToast(id: number) {
  const index = ui.toasts.findIndex((t) => t.id === id);
  if (index >= 0) ui.toasts.splice(index, 1);
}

export function openAdd(tab: AddTab = "search") {
  ui.addTab = tab;
  ui.addOpen = true;
}

export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || el.isContentEditable));
}

export async function copyText(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label}: ${text.length > 60 ? `${text.slice(0, 57)}…` : text}`);
  } catch {
    toast("Clipboard access was blocked by the browser.", { tone: "error" });
  }
}

/** Undo the last recorded library action (⌘Z / Ctrl+Z, or a toast's Undo button). */
export async function runUndo() {
  const { undoLast } = await import("./library");
  try {
    const label = await undoLast();
    toast(label ? `Undone: ${label.toLowerCase()}.` : "Nothing to undo.");
  } catch (error) {
    toastError(error, "Couldn't undo.");
  }
}

export const undoAction = { label: "Undo", run: () => void runUndo() };
