/* Overload Log service worker: keeps the app and its fonts on the phone so it opens with no signal,
   and tells the open app when a newer version has been downloaded. */
const VERSION = 'v2';
const APP_CACHE = 'overload-app-' + VERSION;
const FONT_CACHE = 'overload-fonts-' + VERSION;
const INDEX = './index.html';
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

// The build stamp written in index.html as APP_BUILD = '...'.
function buildOf(text) {
  const m = /APP_BUILD = '([^']+)'/.exec(text || '');
  return m ? m[1] : '';
}

// Download the latest index.html (skipping the browser's HTTP cache) and save it for the next open.
async function refreshIndex() {
  try {
    const res = await fetch(new Request(INDEX, { cache: 'no-cache' }));
    if (!res.ok) return null;
    const cache = await caches.open(APP_CACHE);
    await cache.put(INDEX, res.clone());
    return res;
  } catch (e) {
    return null; // offline: keep the saved copy
  }
}

async function savedBuild() {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(INDEX, { ignoreSearch: true });
  return hit ? buildOf(await hit.text()) : '';
}

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
    await cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
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

// The open app asks "is there a newer version?": refresh index.html, then answer with the build that is now saved.
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'overload-check') return;
  const client = event.source;
  event.waitUntil((async () => {
    await refreshIndex();
    const build = await savedBuild();
    if (client) client.postMessage({ type: 'overload-build', build });
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

  // Opening the app: answer from the saved copy at once, download any update in the background.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const hit = await cache.match(INDEX, { ignoreSearch: true });
      const refresh = refreshIndex();
      if (hit) { event.waitUntil(refresh); return hit; }
      const res = await refresh;
      return res || new Response('Offline and not cached yet. Open the app once with a connection.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }

  // Other app files: answer from the cache at once, refresh it in the background when online.
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(refresh); return hit; }
    const res = await refresh;
    return res || new Response('Offline and not cached yet. Open the app once with a connection.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
