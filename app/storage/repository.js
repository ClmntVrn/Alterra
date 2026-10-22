import { PERSONAL_DATA_COLLECTIONS } from "../domain/models.js";

const collectionNames = new Set(PERSONAL_DATA_COLLECTIONS);

function assertCollection(collection) {
  if (!collectionNames.has(collection)) {
    throw new RangeError(`Collection personnelle inconnue : ${collection}.`);
  }
}

function assertRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      typeof record.id !== "string" || record.id.trim() === "") {
    throw new TypeError("Un enregistrement doit être un objet avec un identifiant.");
  }
}

/**
 * @typedef {Object} PersonalDataStorageAdapter
 * @property {(collection: string) => Promise<Array<Object>>} list
 * @property {(collection: string, id: string) => Promise<Object|null>} get
 * @property {(collection: string, record: Object) => Promise<void>} save
 * @property {(collection: string, id: string) => Promise<boolean>} remove
 */

/**
 * Expose une interface stable au-dessus du stockage local ou distant.
 * L'adaptateur IndexedDB sera ajouté à l'étape de persistance.
 * @param {PersonalDataStorageAdapter} adapter
 */
export function createPersonalDataRepository(adapter) {
  for (const method of ["list", "get", "save", "remove"]) {
    if (typeof adapter?.[method] !== "function") {
      throw new TypeError(`L’adaptateur de stockage doit fournir la méthode « ${method} ».`);
    }
  }

  return Object.freeze({
    async list(collection) {
      assertCollection(collection);
      const records = await adapter.list(collection);
      if (!Array.isArray(records)) {
        throw new TypeError(`Le stockage doit retourner une liste pour « ${collection} ».`);
      }
      records.forEach(assertRecord);
      return records;
    },

    async get(collection, id) {
      assertCollection(collection);
      if (typeof id !== "string" || id.trim() === "") {
        throw new TypeError("Un identifiant valide est nécessaire pour lire un enregistrement.");
      }
      const record = await adapter.get(collection, id);
      if (record !== null) assertRecord(record);
      return record;
    },

    async save(collection, record) {
      assertCollection(collection);
      assertRecord(record);
      await adapter.save(collection, record);
    },

    async remove(collection, id) {
      assertCollection(collection);
      if (typeof id !== "string" || id.trim() === "") {
        throw new TypeError("Un identifiant valide est nécessaire pour supprimer un enregistrement.");
      }
      return adapter.remove(collection, id);
    }
  });
}
