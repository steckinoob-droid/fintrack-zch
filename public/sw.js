// FinTrack Service Worker — v2
// Cache-first for static assets, network-first for navigation, offline fallback page.

const CACHE_NAME    = "fintrack-v2";
const OFFLINE_URL   = "/offline";

// App shell — pre-cached on install so the offline page always works
const PRECACHE_URLS = [OFFLINE_URL];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — delete old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept Supabase API / auth calls — always go to the network
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // fall through to browser default
  }

  // 2. Navigation requests (HTML pages) — network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache navigated pages so they can be re-served if needed
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Network failed — return the cached offline page
          caches.match(OFFLINE_URL).then(
            (cached) => cached ?? new Response("Offline", { status: 503 })
          )
        )
    );
    return;
  }

  // 3. Static assets (JS, CSS, fonts, images) — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // 4. Everything else — network-only (don't cache dynamic Next.js chunks etc.)
});
