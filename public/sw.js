// FinTrack Service Worker — v3
// Cache-first for static assets, network-first for navigation, offline fallback.
// v3: static PNG icons in public/ — manifest no longer needs /api/ icon routes.

const CACHE_NAME  = "fintrack-v3";
const OFFLINE_URL = "/offline";

// Pre-cache on install so the offline page is always available.
const PRECACHE_URLS = [OFFLINE_URL];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Use individual cache.add() calls so a single failure doesn't abort
        // the whole install — the offline page is nice-to-have, not critical.
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) =>
              console.warn("[sw] precache skipped:", url, err.message)
            )
          )
        )
      )
      .then(() => {
        console.log("[sw] installed, skipping waiting");
        return self.skipWaiting();
      })
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
            .map((k) => {
              console.log("[sw] deleting old cache:", k);
              return caches.delete(k);
            })
        )
      )
      .then(() => {
        console.log("[sw] activated, claiming clients");
        return self.clients.claim();
      })
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept Supabase API / auth calls — always go to the network.
  //    Also skip Next.js internal API routes (they handle their own caching).
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // fall through to browser default
  }

  // 2. Navigation requests (HTML pages) — network-first, offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(OFFLINE_URL)
            .then((cached) => cached ?? new Response("Offline", { status: 503 }))
        )
    );
    return;
  }

  // 3. Static assets — cache-first.
  //    Matches: Next.js chunks, fonts, all images including the PWA icon PNGs.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // 4. Everything else — network-only (dynamic Next.js chunks, etc.).
});
