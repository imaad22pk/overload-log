/* Overload Log service worker: keeps the app and its fonts on the phone so it opens with no signal. */
const VERSION = 'v1';
const APP_CACHE = 'overload-app-' + VERSION;
const FONT_CACHE = 'overload-fonts-' + VERSION;
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Mono:wght@400;500&display=swap';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

async function cacheFonts() {
  try {
    const cache = await caches.open(FONT_CACHE);
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    await cache.put(FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok ? cache.put(u, r) : null).catch(() => null)));
  } catch (e) { /* offline during install: fonts fall back to system faces */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(ASSETS);
    await cacheFonts();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [APP_CACHE, FONT_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache first, fill the cache the first time they load.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App files: answer from the cache at once, refresh it in the background when online.
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await cache.match(key, { ignoreSearch: true });
    const refresh = fetch(req).then(res => {
      if (res.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(refresh); return hit; }
    const res = await refresh;
    return res || new Response('Offline and not cached yet. Open the app once with a connection.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
