import { isDateKey } from "./dates.js";

export const PERSONAL_DATA_FORMAT_VERSION = 3;

/** Formats de sauvegarde acceptés à l’import ; les anciens sont migrés vers le format courant. */
export const SUPPORTED_FORMAT_VERSIONS = Object.freeze([1, 2, 3]);

export const PERSONAL_DATA_COLLECTIONS = Object.freeze([
  "workouts",
  "activities",
  "personalRaces",
  "raceCatalog",
  "racePlans",
  "nutritionProducts",
  "equipment"
]);

/** Collections renommées au format 3 (ancien nom → nouveau nom). */
export const RENAMED_COLLECTIONS = Object.freeze({
  plannedSessions: "workouts",
  raceEvents: "personalRaces"
});

/**
 * @typedef {Object} PersonalData
 * @property {number} formatVersion
 * @property {Array<Object>} workouts Séances prévues ou réalisées.
 * @property {Array<Object>} activities Non utilisée, conservée pour compatibilité.
 * @property {Array<Object>} personalRaces Courses ajoutées depuis le calendrier.
 * @property {Array<Object>} raceCatalog Fiches de course de référence.
 * @property {Array<Object>} racePlans Plans personnels des courses.
 * @property {Array<Object>} nutritionProducts
 * @property {Array<Object>} equipment
 * @property {Record<string, unknown>} settings
 */

export function createEmptyPersonalData() {
  return {
    formatVersion: PERSONAL_DATA_FORMAT_VERSION,
    workouts: [],
    activities: [],
    personalRaces: [],
    raceCatalog: [],
    racePlans: [],
    nutritionProducts: [],
    equipment: [],
    settings: {}
  };
}

/** Retire le champ d’affichage `eventType`, enregistré par erreur avant la version 0.8.10. */
function withoutDisplayFields(records) {
  if (!Array.isArray(records)) return records;
  return records.map(record => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const { eventType: _eventType, ...rest } = record;
    return rest;
  });
}

/**
 * Convertit une sauvegarde d’un format accepté vers le format courant, sans modifier l’original.
 * @param {unknown} data
 * @returns {Object}
 */
export function migratePersonalData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Les données personnelles doivent être un objet.");
  }
  if (!SUPPORTED_FORMAT_VERSIONS.includes(data.formatVersion)) {
    throw new Error(`Version des données non prise en charge : ${data.formatVersion}.`);
  }
  const migrated = { ...data, formatVersion: PERSONAL_DATA_FORMAT_VERSION };
  if (data.formatVersion < 3) {
    for (const [oldName, newName] of Object.entries(RENAMED_COLLECTIONS)) {
      migrated[newName] = data[oldName];
      delete migrated[oldName];
    }
  }
  // Le format 1 ne contenait pas encore le catalogue de courses.
  if (data.formatVersion === 1 && migrated.raceCatalog === undefined) migrated.raceCatalog = [];
  migrated.workouts = withoutDisplayFields(migrated.workouts);
  migrated.personalRaces = withoutDisplayFields(migrated.personalRaces);
  return migrated;
}

function validateRaceSheet(item) {
  if (
    typeof item.name !== "string" ||
    typeof item.date !== "string" ||
    typeof item.calendarDetails !== "string" ||
    !Number.isFinite(item.distanceKm) ||
    !Number.isFinite(item.ascentMeters)
  ) {
    throw new TypeError(`La course « ${item.id} » ne contient pas ses informations de référence.`);
  }
  if (
    item.endDate !== undefined &&
    (!isDateKey(item.date) || !isDateKey(item.endDate) || item.endDate < item.date)
  ) {
    throw new TypeError(`La date de fin de la course « ${item.id} » est invalide.`);
  }
  if (item.profile?.gpx && typeof item.profile.gpxData !== "string") {
    throw new TypeError(`La trace GPX de « ${item.id} » est absente de la sauvegarde.`);
  }
}

/**
 * Migre puis vérifie une sauvegarde ; l’original n’est pas modifié.
 * @param {unknown} data
 * @returns {PersonalData} Données au format courant.
 */
export function validatePersonalData(data) {
  const migrated = migratePersonalData(data);

  for (const collection of PERSONAL_DATA_COLLECTIONS) {
    if (!Array.isArray(migrated[collection])) {
      throw new TypeError(`La collection « ${collection} » doit être une liste.`);
    }
    const ids = new Set();
    for (const item of migrated[collection]) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof item.id !== "string" ||
        item.id.trim() === ""
      ) {
        throw new TypeError(`Chaque élément de « ${collection} » doit avoir un identifiant.`);
      }
      if (ids.has(item.id)) {
        throw new Error(`Identifiant en double dans « ${collection} » : ${item.id}.`);
      }
      ids.add(item.id);
      if (collection === "raceCatalog") validateRaceSheet(item);
    }
  }
  const { settings } = migrated;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new TypeError("Les préférences personnelles doivent être un objet.");
  }
  if (settings.browserStorage !== undefined) {
    const browserStorage = settings.browserStorage;
    if (!browserStorage || typeof browserStorage !== "object" || Array.isArray(browserStorage)) {
      throw new TypeError("L’état local du navigateur doit être un objet.");
    }
    for (const [key, value] of Object.entries(browserStorage)) {
      if (!key.startsWith("alterra-") || typeof value !== "string") {
        throw new TypeError("Une donnée locale du navigateur n’est pas valide.");
      }
    }
  }

  return migrated;
}
