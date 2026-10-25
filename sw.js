// Garde-manger service worker: app shell + libraries cached for offline use.
const CACHE = "garde-manger-v4";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/htm@3.1.1/dist/htm.umd.js",
  "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname.includes("openfoodfacts")) return; // product lookups always go to the network
  if (e.request.mode === "navigate") {
    // network first for the page so updates show up, cache when offline
    e.respondWith(fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put("./index.html", r.clone())); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});
