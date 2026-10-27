const CACHE_NAME = "alterra-0.8.17";

const FILES = [
  "./",
  "./index.html",
  "./race.html",
  "./versions.html",
  "./manifest.json",
  "./styles/tokens.css",
  "./styles/base.css",
  "./styles/layout.css",
  "./styles/components/forms.css",
  "./styles/components/sheet.css",
  "./styles/features/statistics.css",
  "./styles/features/backup.css",
  "./styles/features/calendar.css",
  "./styles/features/calendar-day.css",
  "./styles/features/race-sheet.css",
  "./styles/features/elevation-profile.css",
  "./styles/features/gear-checklist.css",
  "./styles/features/versions.css",
  "./assets/icons/icon.svg",
  "./assets/icons/apple-touch-icon.png",
  "./src/pages/home.js",
  "./src/pages/race.js",
  "./src/features/calendar/calendar.js",
  "./src/features/calendar/month-grid.js",
  "./src/features/calendar/month-picker.js",
  "./src/features/statistics/activity-statistics.js",
  "./src/features/races/personal-race-form.js",
  "./src/features/races/race-card.js",
  "./src/features/workouts/workout-card.js",
  "./src/features/workouts/workout-detail.js",
  "./src/features/workouts/workout-parts.js",
  "./src/features/workouts/workout-form.js",
  "./src/features/workouts/workout-labels.js",
  "./src/features/race-sheet/checkpoints.js",
  "./src/features/race-sheet/elevation-profile.js",
  "./src/features/race-sheet/gear-checklist.js",
  "./src/features/race-sheet/info-sections.js",
  "./src/features/race-sheet/race-header.js",
  "./src/features/race-sheet/race-live.js",
  "./src/domain/calendar.js",
  "./src/domain/elevation-profile.js",
  "./src/domain/race-plan.js",
  "./src/domain/race-progress.js",
  "./src/domain/backup-format.js",
  "./src/domain/dates.js",
  "./src/domain/durations.js",
  "./src/domain/numbers.js",
  "./src/domain/statistics.js",
  "./src/domain/workouts.js",
  "./src/storage/repository.js",
  "./src/storage/indexeddb.js",
  "./src/storage/personal-data.js",
  "./src/storage/race-catalog.js",
  "./src/ui/dom.js",
  "./src/ui/format.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
