// Garde-manger service worker: app shell + libraries cached for offline use.
// Never touches the PocketBase API (/api/) or its admin dashboard (/_/).
const CACHE = "garde-manger-v5";
const SHELL = ["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/htm@3.1.1/dist/htm.umd.js",
  "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js"];
const SCOPE = new URL("./", self.location).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.includes("openfoodfacts")) return;                       // product lookups: network only
  if (url.origin === self.location.origin) {
    const rel = url.pathname.slice(SCOPE.length - 1);
    if (rel.startsWith("/api/") || rel === "/api" || rel.startsWith("/_/") || rel === "/_") return; // PocketBase
  }
  if (req.mode === "navigate") {
    if (url.origin !== self.location.origin) return;
    // network first so updates show up, cached app when offline
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); }
      return r;
    }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
