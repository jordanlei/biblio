// Talks to the Bibliograph browser extension through its content script (apps/extension/bridge.js),
// which relays window.postMessage to the extension. The extension can fetch PDFs from any site,
// which pages can't do because of CORS. Nothing here is required: every caller has a fallback.

const APP = "bibliograph-app";
const EXTENSION = "bibliograph-extension";

interface ExtensionReply {
  source: typeof EXTENSION;
  id?: string;
  type: string;
  ok?: boolean;
  base64?: string;
  contentType?: string;
  error?: string;
  version?: string;
}

const pending = new Map<string, (reply: ExtensionReply) => void>();
let present = false;

window.addEventListener("message", (event) => {
  const data = event.data as ExtensionReply;
  if (event.source !== window || data?.source !== EXTENSION) return;
  if (data.type === "hello" || data.type === "pong") {
    present = true;
  }
  if (data.id) {
    pending.get(data.id)?.(data);
    pending.delete(data.id);
  }
});

function request(message: Record<string, unknown>, timeoutMs: number): Promise<ExtensionReply | null> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(null);
    }, timeoutMs);
    pending.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    window.postMessage({ source: APP, id, ...message }, window.location.origin);
  });
}

/** True when the extension's bridge answers (it also announces itself on page load). */
export async function extensionAvailable(): Promise<boolean> {
  if (present) return true;
  return Boolean(await request({ type: "ping" }, 400));
}

/** Fetch a URL through the extension. Resolves null when the extension is missing or the fetch fails. */
export async function extensionFetch(url: string): Promise<Blob | null> {
  const reply = await request({ type: "fetch-pdf", url }, 90_000);
  if (!reply?.ok || !reply.base64) return null;
  const bytes = Uint8Array.from(atob(reply.base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: reply.contentType || "application/pdf" });
}
