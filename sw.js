// HK Wood Doors ERP — Service Worker
// Saves the whole app on the phone so it opens and makes PDFs without internet.
// App code (html/js/css) is fetched fresh when online so updates arrive straight
// away; libraries and icons come from the saved copy.
// Change CACHE_VERSION whenever files are added to APP_SHELL.

const CACHE_VERSION = 'v36';
const CACHE_NAME = 'hk-wood-doors-' + CACHE_VERSION;
const NETWORK_TIMEOUT_MS = 4000;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/native.js',
  './js/store.js',
  './js/sync.js',
  './js/app.js',
  './js/security.js',
  './js/extras.js',
  './js/activity.js',
  './js/reports.js',
  './js/home.js',
  './js/auto.js',
  './js/fixes.js',
  './js/business.js',
  './js/desktop.js',
  './js/link.js',
  './js/finger.js',
  './js/more.js',
  './js/extra2.js',
  './js/shop.js',
  './js/safety.js',
  './js/extra3.js',
  './js/extra4.js',
  './js/extra5.js',
  './js/showroom.js',
  './js/oldkhata.js',
  './js/whatsimg.js',
  './js/auto2.js',
  './js/voice2.js',
  './js/khata2.js',
  './js/notify.js',
  './js/menu.js',
  './js/lang.js',
  './vendor/xlsx.mini.min.js',
  './vendor/firebase-app-compat.js',
  './vendor/firebase-firestore-compat.js',
  './vendor/firebase-auth-compat.js',
  './vendor/html2canvas.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/qrcode.min.js',
  './vendor/jsQR.js',
  './vendor/fonts/IBMPlexMono-54e437.woff2',
  './vendor/fonts/IBMPlexMono-9b8270.woff2',
  './vendor/fonts/IBMPlexMono-a7544c.woff2',
  './vendor/fonts/Inter-567244.woff2',
  './vendor/fonts/Poppins-06d94d.woff2',
  './vendor/fonts/Poppins-b542d4.woff2',
  './vendor/fonts/Poppins-ddd022.woff2',
  './vendor/fonts/Poppins-fd1924.woff2',
  './vendor/fonts/fonts.css',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('hk-wood-doors-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
  }
  return res;
}

// Online: fresh copy (and save it). Slow or offline: saved copy.
function networkFirst(req, fallbackUrl) {
  return new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true })
      .then((c) => c || (fallbackUrl ? caches.match(fallbackUrl) : undefined));
    const timer = setTimeout(() => {
      fromCache().then((c) => { if (c && !done) { done = true; resolve(c); } });
    }, NETWORK_TIMEOUT_MS);
    fetch(req).then((res) => {
      clearTimeout(timer);
      putInCache(req, res);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((c) => { if (!done) { done = true; resolve(c || Response.error()); } });
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then((cached) => cached || fetch(req).then((res) => putInCache(req, res)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: keep a copy so text looks the same offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Firebase and other outside traffic goes straight to the network.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }
  if (/\.(js|css|json|html)$/.test(url.pathname) && !url.pathname.includes('/vendor/')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
