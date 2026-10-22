export const PERSONAL_DATA_FORMAT_VERSION = 1;

export const PERSONAL_DATA_COLLECTIONS = Object.freeze([
  "plannedSessions",
  "activities",
  "raceEvents",
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
  if (data.formatVersion !== PERSONAL_DATA_FORMAT_VERSION) {
    throw new Error(`Version des données non prise en charge : ${data.formatVersion}.`);
  }

  for (const collection of PERSONAL_DATA_COLLECTIONS) {
    if (!Array.isArray(data[collection])) {
      throw new TypeError(`La collection « ${collection} » doit être une liste.`);
    }
    const ids = new Set();
    for (const item of data[collection]) {
      if (!item || typeof item !== "object" || Array.isArray(item) ||
          typeof item.id !== "string" || item.id.trim() === "") {
        throw new TypeError(`Chaque élément de « ${collection} » doit avoir un identifiant.`);
      }
      if (ids.has(item.id)) {
        throw new Error(`Identifiant en double dans « ${collection} » : ${item.id}.`);
      }
      ids.add(item.id);
    }
  }
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
    throw new TypeError("Les préférences personnelles doivent être un objet.");
  }

  return data;
}
