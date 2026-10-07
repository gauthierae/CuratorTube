// CuratorTube service worker: makes the app shell available offline.
// Feed data is never cached here — the page keeps its own copy in localStorage.
const SHELL = 'curatortube-shell-v1';
const ASSETS = 'curatortube-assets-v1';
const SHELL_FILES = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const ASSET_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'i.ytimg.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App shell: network first (so updates show up), cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
    );
    return;
  }

  // Fonts and thumbnails: serve from cache, refresh in the background.
  if (ASSET_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(ASSETS).then(cache =>
        cache.match(req).then(hit => {
          const net = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
  }
  // Everything else (the CORS proxies) goes straight to the network.
});
