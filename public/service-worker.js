/* Installation keeps a small connection screen, not copies of games or room data. */
const CACHE_PREFIX = 'semag-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}3.73.0`;
const SCOPE_URL = new URL(self.registration.scope);
const OFFLINE_URL = new URL('offline.html', SCOPE_URL).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([
    new Request(OFFLINE_URL, { cache: 'reload' }),
  ])));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  const url = new URL(request.url);
  if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) return;
  if (/^\/(?:api|download|downloads)(?:\/|$)/.test(url.pathname)) return;

  event.respondWith((async () => {
    try {
      // Pages always come from the host. Invites, game updates and scores stay uncached.
      return await fetch(request, { cache: 'no-store' });
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_URL) || Response.error();
    }
  })());
});
