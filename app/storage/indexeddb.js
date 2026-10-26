import { PERSONAL_DATA_COLLECTIONS, validatePersonalData } from "../domain/models.js";

const DATABASE_NAME = "alterra-personal-data";
const DATABASE_VERSION = 2;
const SETTINGS_KEY = "root";

function openDatabase() {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("IndexedDB n’est pas disponible dans ce navigateur."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const collection of PERSONAL_DATA_COLLECTIONS) {
        if (!database.objectStoreNames.contains(collection)) {
          database.createObjectStore(collection, { keyPath: "id" });
        }
      }
      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () =>
      reject(request.error || new Error("Impossible d’ouvrir la base locale."));
    request.onblocked = () =>
      reject(new Error("La base locale est bloquée par un autre onglet Alterra."));
  });
}

function requestResult(request, transaction) {
  return new Promise((resolve, reject) => {
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error("La requête IndexedDB a échoué."));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () =>
      reject(transaction.error || new Error("La transaction IndexedDB a échoué."));
    transaction.onabort = () =>
      reject(transaction.error || new Error("La transaction IndexedDB a été annulée."));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("La transaction IndexedDB a échoué."));
    transaction.onabort = () =>
      reject(transaction.error || new Error("La transaction IndexedDB a été annulée."));
  });
}

export function createIndexedDbAdapter() {
  let databasePromise;
  const getDatabase = () => {
    if (!databasePromise) databasePromise = openDatabase();
    return databasePromise;
  };

  function assertCollection(collection) {
    if (!PERSONAL_DATA_COLLECTIONS.includes(collection)) {
      throw new RangeError(`Collection personnelle inconnue : ${collection}.`);
    }
  }

  return Object.freeze({
    async list(collection) {
      assertCollection(collection);
      const db = await getDatabase();
      const transaction = db.transaction(collection, "readonly");
      return requestResult(transaction.objectStore(collection).getAll(), transaction);
    },

    async get(collection, id) {
      assertCollection(collection);
      const db = await getDatabase();
      const transaction = db.transaction(collection, "readonly");
      return requestResult(transaction.objectStore(collection).get(id), transaction).then(
        record => record ?? null
      );
    },

    async save(collection, record) {
      assertCollection(collection);
      const db = await getDatabase();
      const transaction = db.transaction(collection, "readwrite");
      transaction.objectStore(collection).put(record);
      await transactionComplete(transaction);
    },

    async remove(collection, id) {
      assertCollection(collection);
      const db = await getDatabase();
      const transaction = db.transaction(collection, "readwrite");
      const store = transaction.objectStore(collection);
      const request = store.getKey(id);
      return new Promise((resolve, reject) => {
        let removed = false;
        request.onsuccess = () => {
          if (request.result !== undefined) {
            removed = true;
            store.delete(id);
          }
        };
        request.onerror = () =>
          reject(request.error || new Error("La suppression IndexedDB a échoué."));
        transaction.oncomplete = () => resolve(removed);
        transaction.onerror = () =>
          reject(transaction.error || new Error("La transaction IndexedDB a échoué."));
        transaction.onabort = () =>
          reject(transaction.error || new Error("La transaction IndexedDB a été annulée."));
      });
    },

    async getSettings() {
      const db = await getDatabase();
      const transaction = db.transaction("settings", "readonly");
      const entry = await requestResult(
        transaction.objectStore("settings").get(SETTINGS_KEY),
        transaction
      );
      return entry?.value ?? {};
    },

    async saveSettings(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Les préférences personnelles doivent être un objet.");
      }
      const db = await getDatabase();
      const transaction = db.transaction("settings", "readwrite");
      transaction.objectStore("settings").put({ key: SETTINGS_KEY, value });
      await transactionComplete(transaction);
    },

    async initializeRaceCatalog(records) {
      const db = await getDatabase();
      const settings = await this.getSettings();
      if (settings.raceCatalogInitialized) {
        const existing = db.transaction("raceCatalog", "readonly");
        return requestResult(existing.objectStore("raceCatalog").getAll(), existing);
      }
      const transaction = db.transaction(["raceCatalog", "settings"], "readwrite");
      const catalog = transaction.objectStore("raceCatalog");
      const settingsStore = transaction.objectStore("settings");
      catalog.clear();
      records.forEach(record => catalog.put(record));
      settingsStore.put({
        key: SETTINGS_KEY,
        value: { ...settings, raceCatalogInitialized: true }
      });
      await transactionComplete(transaction);
      return records;
    },

    async replaceAll(data) {
      validatePersonalData(data);
      const db = await getDatabase();
      const storeNames = [...PERSONAL_DATA_COLLECTIONS, "settings"];
      const transaction = db.transaction(storeNames, "readwrite");
      for (const collection of PERSONAL_DATA_COLLECTIONS) {
        const store = transaction.objectStore(collection);
        store.clear();
        data[collection].forEach(record => store.put(record));
      }
      const settings = transaction.objectStore("settings");
      settings.clear();
      settings.put({ key: SETTINGS_KEY, value: data.settings });
      await transactionComplete(transaction);
    }
  });
}
