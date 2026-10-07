// Service worker: cache the app shell so it opens offline.
const VERSION = 'v1.0.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './vendor/lunar.js',
  './js/app.js', './js/router.js', './js/store.js', './js/theme.js', './js/util.js', './js/sheet.js',
  './js/almanac.js', './js/barcode.js', './js/weather.js', './js/gcal.js', './js/events.js',
  './js/pages/home.js', './js/pages/weather.js', './js/pages/calendar.js', './js/pages/notes.js',
  './js/pages/todo.js', './js/pages/carrier.js', './js/pages/settings.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // App files: network first (so updates show up), fall back to cache offline.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // Google Fonts: cache first.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    })));
  }
  // Everything else (weather, Google APIs) goes straight to the network.
});
