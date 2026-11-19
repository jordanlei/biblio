// App-shell cache, after liftoff's. Files under /assets/ are named by their content and never change,
// so they're served from the cache first. Pages go to the network first, falling back to the cache
// after 3 s or when offline, so a deploy shows up on the next load. Only same-origin GETs: Firebase
// (/__/), Google sign-in, Firestore and Drive requests always go to the network, untouched.
const CACHE = "biblio-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Each deploy adds new /assets/ files; keep the most recent ones and drop the oldest.
const MAX_ENTRIES = 150;
const save = (req, res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then(async (c) => {
      await c.put(req, copy);
      const keys = await c.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) if (new URL(k.url).pathname.startsWith("/assets/")) await c.delete(k);
    });
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/__/")) return;
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => save(e.request, r))));
    return;
  }
  // Every route is the same single-page app, so an offline navigation falls back to the cached "/".
  const network = fetch(e.request).then((r) => save(e.request, r));
  const fallback = () => caches.match(e.request).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("/") : undefined));
  const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(() => fallback()).then((hit) => hit || network);
  e.respondWith(Promise.race([network.catch(fallback), slow]));
});
