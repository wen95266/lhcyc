
const CACHE_NAME = 'lottery-predictor-cache-v1';
const urlsToCache = [
  '/',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/images/icons-192.png',
  '/images/icons-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
