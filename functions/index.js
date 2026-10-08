const { onRequest } = require("firebase-functions/v2/https");

// --- PDF fetch proxy ---------------------------------------------------------------------------
// Last-resort fetcher for open-access PDFs whose hosts block browser downloads (CORS). Requires a
// signed-in Firebase user, only returns real PDFs, and caps size. Deploying needs the Blaze plan.
const admin = require("firebase-admin");
const net = require("node:net");
const { lookup } = require("node:dns/promises");
const { isPrivateAddress, safeDestination } = require("./safe-destination");
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
    target = safeDestination(request.query.url);
  } catch (error) {
    response.status(400).json({ error: error.message });
    return;
  }
  // A name that looks public can still resolve into private space (DNS rebinding), so check the
  // addresses it actually resolves to, not just how it is spelled.
  async function assertPublic(url) {
    // Only skip resolution for a genuine IP literal. A character-class test would also match
    // hostnames spelled with hex letters (cafe.ac, abcdef.de), which are registrable domains an
    // attacker can simply point at an internal address.
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, ""))) return;
    let addresses;
    try {
      addresses = await lookup(url.hostname, { all: true });
    } catch {
      throw new Error("Couldn't fetch that PDF");
    }
    if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("That address isn't allowed");
  }

  try {
    await assertPublic(target);
    // Follow redirects by hand: a public URL can redirect to a private one, so every hop is checked.
    let upstream;
    for (let hop = 0; ; hop += 1) {
      if (hop > 5) throw new Error("Too many redirects");
      upstream = await fetch(target, { redirect: "manual", headers: { "User-Agent": "Biblio/0.2 (open-access PDF fetcher)" } });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get("location");
      if (!location) break;
      target = safeDestination(new URL(location, target).href);
      await assertPublic(target);
    }
    // Don't echo the upstream status: it would turn this into a scanner for whoever is signed in.
    if (!upstream.ok) throw new Error("Couldn't fetch that PDF");
    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > MAX_PDF_BYTES) throw new Error("PDF too large");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_PDF_BYTES) throw new Error("PDF too large");
    if (!buffer.subarray(0, 1024).toString("latin1").includes("%PDF-")) throw new Error("Not a PDF");
    response.set("Cache-Control", "private, no-store").type("application/pdf").send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    // Only our own messages are safe to return; anything else could describe internal network state.
    const safe = ["PDF too large", "Not a PDF", "Too many redirects", "That address isn't allowed", "Couldn't fetch that PDF"];
    response.status(502).json({ error: safe.includes(message) ? message : "Couldn't fetch that PDF" });
  }
});
