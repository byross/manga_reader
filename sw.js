/* Minimal offline-first service worker for Local Webtoon Reader */
const VERSION = 'v1.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => { if (k !== VERSION) return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// Network-first for navigations (so updates land fast), fallback to cache for offline.
async function handleNavigation(event) {
  try {
    const net = await fetch(event.request);
    const cache = await caches.open(VERSION);
    cache.put('./', net.clone());
    return net;
  } catch (e) {
    const cache = await caches.open(VERSION);
    return (await cache.match('./')) || Response.error();
  }
}

// Stale-while-revalidate for same-origin GETs (CSS/JS/icons, etc.)
async function handleAsset(event) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(event.request);
  const fetchPromise = fetch(event.request).then((net) => {
    cache.put(event.request, net.clone());
    return net;
  }).catch(() => null);
  return cached || fetchPromise || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only cache same-origin
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(handleNavigation(event));
    } else {
      event.respondWith(handleAsset(event));
    }
  }
});
