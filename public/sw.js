/* Only public static files are cached. API responses and personal data stay online. */
const CACHE = 'pervik-static-v4';
const OFFLINE = '/offline.html';
const STATIC = [OFFLINE, '/fonts/Pervye_Book.woff', '/fonts/Pervye_Extended-Bold.woff', '/app/icon-192.png', '/app/icon-512.png', '/app/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pervik-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || new Response('Нет подключения. Откройте сайт, когда появится интернет.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
    return;
  }
  // Vite production assets have content hashes. HTML, uploads and user routes aren't stored.
  if (STATIC.includes(url.pathname) || /^\/assets\/[^/]+-[\w-]{8,}\.[a-z0-9]+$/i.test(url.pathname)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(async cache => {
          await cache.put(request, copy);
          const keys = (await cache.keys()).filter(key => new URL(key.url).pathname.startsWith('/assets/'));
          await Promise.all(keys.slice(0, Math.max(0, keys.length - 40)).map(key => cache.delete(key)));
        }));
      }
      return response;
    })));
  }
});
