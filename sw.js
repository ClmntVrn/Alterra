
const CACHE_NAME = "alterra-v21";

const FILES = [
  "./",
  "./index.html",
  "./app/main.js",
  "./app/calendar.js",
  "./app/domain/models.js",
  "./app/race-catalog.js",
  "./app/storage/repository.js",
  "./app/storage/indexeddb.js",
  "./app/personal-data.js",
  "./races/race.html",
  "./races/race.js",
  "./styles.css",
  "./races/gpx/ETM_50_K_ea7a69720b.gpx",
  "./races/index.json",
  "./races/mallorca-etm-2026.json",
  "./races/sainteexpress-2026.json",
  "./manifest.json",
  "./icon/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, copy)
          );
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
