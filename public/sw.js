// RESCO eCard service worker.
// Network-first strategy: try the network, fall back to cache (offline).
// Navigations fall back to the cached app shell ("/") so the app loads offline.
// Satisfies Chrome's PWA installability criterion (a registered SW with a fetch handler).

const CACHE = 'resco-ecard-v1';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET; ignore non-GET (POST login/results etc.) and browser extensions.
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const url = new URL(req.url);
  // Don't intercept same-origin /api/* (API calls must hit the server for live data).
  const isSameOriginApi = url.origin === self.location.origin && url.pathname.startsWith('/api/');
  if (isSameOriginApi) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful same-origin responses for offline use.
        if (res.ok && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached
          // For navigations when offline, fall back to the app shell.
          if (req.mode === 'navigate') return caches.match('/')
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        }),
      ),
  );
});
