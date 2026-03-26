/**
 * Dynatech ONE — Service Worker
 * Strategy: App Shell (cache-first for static assets, network-only for API)
 *
 * - On install:  pre-cache the app shell (HTML entry, nothing else — Vite assets
 *                have hashed names we don't know at SW write-time, so we let the
 *                browser cache them through normal HTTP caching + runtime caching)
 * - On fetch:    API calls (/api/*, /uploads/*) → network-only (never cache)
 *                Everything else → stale-while-revalidate (serve from cache fast,
 *                refresh in background)
 * - On activate: clean up old caches
 */

const CACHE_NAME = 'dynatech-one-v1';
const SHELL_URLS = ['/'];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Take over immediately without waiting for the old SW to be released
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Claim all open clients so this SW controls them immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PATCH/DELETE — always go to network)
  if (request.method !== 'GET') return;

  // Skip API and file upload requests — always network only
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    return; // Let the browser handle it normally
  }

  // Skip cross-origin requests (Google Fonts, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate for all same-origin GET requests
  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Kick off a background network refresh
  const networkFetch = fetch(request)
    .then((response) => {
      // Only cache successful, non-opaque responses
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null); // Network failure — silently ignore

  // Return cached immediately if available, otherwise wait for network
  return cached || networkFetch;
}
