const { onRequest } = require("firebase-functions/v2/https");

// --- PDF fetch proxy ---------------------------------------------------------------------------
// Last-resort fetcher for open-access PDFs whose hosts block browser downloads (CORS). Requires a
// signed-in Firebase user, only returns real PDFs, and caps size. Deploying needs the Blaze plan.
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const MAX_PDF_BYTES = 80 * 1024 * 1024;

exports.fetchPdf = onRequest({ cors: false, region: "us-central1", timeoutSeconds: 120, memory: "512MiB" }, async (request, response) => {
  if (request.method !== "GET") {
    response.set("Allow", "GET").status(405).json({ error: "Method not allowed" });
    return;
  }
  const idToken = (request.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch {
    response.status(401).json({ error: "Sign in required" });
    return;
  }
  let target;
  try {
    target = new URL(String(request.query.url || ""));
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
  } catch {
    response.status(400).json({ error: "A valid http(s) url is required" });
    return;
  }
  try {
    const upstream = await fetch(target, { redirect: "follow", headers: { "User-Agent": "Bibliograph/0.2 (open-access PDF fetcher)" } });
    if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}`);
    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > MAX_PDF_BYTES) throw new Error("PDF too large");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_PDF_BYTES) throw new Error("PDF too large");
    if (!buffer.subarray(0, 1024).toString("latin1").includes("%PDF-")) throw new Error("Not a PDF");
    response.set("Cache-Control", "private, no-store").type("application/pdf").send(buffer);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "Fetch failed" });
  }
});
