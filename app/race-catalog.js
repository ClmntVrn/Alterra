const projectRoot = new URL("../", import.meta.url);

async function fetchJson(url, description) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${description} indisponible (${response.status}).`);
  return response.json();
}

function assertRace(race, expectedId) {
  if (!race || race.id !== expectedId || typeof race.name !== "string" ||
      typeof race.date !== "string" || typeof race.calendarDetails !== "string" ||
      !Number.isFinite(race.distanceKm) ||
      !Number.isFinite(race.ascentMeters)) {
    throw new Error(`Les données de référence de la course « ${expectedId} » sont invalides.`);
  }
}

async function loadBundledCatalog() {
  const response = await fetch(new URL("./races/index.json", projectRoot));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Catalogue des courses indisponible (${response.status}).`);
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new TypeError("Le catalogue des courses doit être une liste.");

  return Promise.all(entries.map(async entry => {
    if (!entry || typeof entry.id !== "string" || typeof entry.data !== "string") {
      throw new TypeError("Une entrée du catalogue des courses est invalide.");
    }
    const race = await fetchJson(new URL(entry.data, projectRoot), `Données de course ${entry.id}`);
    assertRace(race, entry.id);
    if (race.profile?.gpx) {
      const gpxResponse = await fetch(new URL(race.profile.gpx, projectRoot));
      if (!gpxResponse.ok) {
        throw new Error(`Trace GPX de ${race.name} indisponible (${gpxResponse.status}).`);
      }
      race.profile.gpxData = await gpxResponse.text();
    }
    return race;
  }));
}

export async function loadRaceCatalog(personalData) {
  const saved = await personalData.repository.list("raceCatalog");
  const settings = await personalData.getSettings();
  if (settings.raceCatalogInitialized) return saved;
  if (saved.length) {
    await personalData.initializeRaceCatalog(saved);
    return saved;
  }

  const bundled = await loadBundledCatalog();
  if (bundled === null) {
    await personalData.saveSettings({ ...settings, raceCatalogInitialized: true });
    return [];
  }
  return personalData.initializeRaceCatalog(bundled);
}
