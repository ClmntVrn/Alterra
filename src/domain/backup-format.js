import { isDateKey } from "./dates.js";

export const PERSONAL_DATA_FORMAT_VERSION = 2;

export const PERSONAL_DATA_COLLECTIONS = Object.freeze([
  "plannedSessions",
  "activities",
  "raceEvents",
  "raceCatalog",
  "racePlans",
  "nutritionProducts",
  "equipment"
]);

/**
 * @typedef {Object} PersonalData
 * @property {number} formatVersion
 * @property {Array<Object>} plannedSessions
 * @property {Array<Object>} activities
 * @property {Array<Object>} raceEvents
 * @property {Array<Object>} raceCatalog
 * @property {Array<Object>} racePlans
 * @property {Array<Object>} nutritionProducts
 * @property {Array<Object>} equipment
 * @property {Record<string, unknown>} settings
 */

export function createEmptyPersonalData() {
  return {
    formatVersion: PERSONAL_DATA_FORMAT_VERSION,
    plannedSessions: [],
    activities: [],
    raceEvents: [],
    raceCatalog: [],
    racePlans: [],
    nutritionProducts: [],
    equipment: [],
    settings: {}
  };
}

export function validatePersonalData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Les données personnelles doivent être un objet.");
  }
  if (data.formatVersion !== 1 && data.formatVersion !== PERSONAL_DATA_FORMAT_VERSION) {
    throw new Error(`Version des données non prise en charge : ${data.formatVersion}.`);
  }

  for (const collection of PERSONAL_DATA_COLLECTIONS) {
    if (
      data.formatVersion === 1 &&
      collection === "raceCatalog" &&
      data[collection] === undefined
    ) {
      data[collection] = [];
    }
    if (!Array.isArray(data[collection])) {
      throw new TypeError(`La collection « ${collection} » doit être une liste.`);
    }
    const ids = new Set();
    for (const item of data[collection]) {
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
      if (collection === "raceCatalog") {
        if (
          typeof item.name !== "string" ||
          typeof item.date !== "string" ||
          typeof item.calendarDetails !== "string" ||
          !Number.isFinite(item.distanceKm) ||
          !Number.isFinite(item.ascentMeters)
        ) {
          throw new TypeError(
            `La course « ${item.id} » ne contient pas ses informations de référence.`
          );
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
    }
  }
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
    throw new TypeError("Les préférences personnelles doivent être un objet.");
  }
  if (data.settings.browserStorage !== undefined) {
    const browserStorage = data.settings.browserStorage;
    if (!browserStorage || typeof browserStorage !== "object" || Array.isArray(browserStorage)) {
      throw new TypeError("L’état local du navigateur doit être un objet.");
    }
    for (const [key, value] of Object.entries(browserStorage)) {
      if (!key.startsWith("alterra-") || typeof value !== "string") {
        throw new TypeError("Une donnée locale du navigateur n’est pas valide.");
      }
    }
  }
  if (data.formatVersion === 1) data.formatVersion = PERSONAL_DATA_FORMAT_VERSION;

  return data;
}
