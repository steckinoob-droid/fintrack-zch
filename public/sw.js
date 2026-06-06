// FinTrack Service Worker — v1
// Provides offline fallback and caches static assets

const CACHE = "fintrack-v1";
const OFFLINE_URL = "/offline";

// Assets to pre-cache on install
const PRECACHE = ["/", "/dashboard", "/offline"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(OFFLINE_URL) || caches.match("/"))
    );
    return;
  }
  // Cache-first for static assets, network-first for API
  if (e.request.url.includes("/rest/v1/") || e.request.url.includes("supabase")) {
    return; // never intercept Supabase API calls
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
