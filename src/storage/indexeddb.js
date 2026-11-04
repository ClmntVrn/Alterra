import {
  PERSONAL_DATA_COLLECTIONS,
  RENAMED_COLLECTIONS,
  validatePersonalData
} from "../domain/backup-format.js";
import { createPendingChange, pendingKey, stableStringify } from "../domain/sync.js";

const DATABASE_NAME = "alterra-personal-data";
// 3 : collections renommées (plannedSessions → workouts, raceEvents → personalRaces).
// 4 : file des modifications à envoyer en ligne (syncQueue) et état de la connexion (syncState),
// propres à l’appareil et absents des sauvegardes.
const DATABASE_VERSION = 4;
const SETTINGS_KEY = "root";
const SYNC_QUEUE = "syncQueue";
const SYNC_STATE = "syncState";
const SYNC_STATE_KEY = "root";

/** Note une modification locale dans la file d’envoi, dans la même transaction. */
function enqueue(transaction, collection, id, deleted) {
  transaction
    .objectStore(SYNC_QUEUE)
    .put(createPendingChange(collection, id, { deleted, changedAt: new Date().toISOString() }));
}

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
      for (const store of ["settings", SYNC_QUEUE, SYNC_STATE]) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "key" });
        }
      }
      moveRenamedCollections(database, request.transaction);
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

/**
 * Recopie les anciennes collections sous leur nouveau nom, puis les supprime. Tout se passe dans
 * la transaction de mise à niveau : en cas d’échec, la base reste intacte dans sa version précédente.
 */
function moveRenamedCollections(database, transaction) {
  for (const [oldName, newName] of Object.entries(RENAMED_COLLECTIONS)) {
    if (!database.objectStoreNames.contains(oldName)) continue;
    const request = transaction.objectStore(oldName).getAll();
    request.onsuccess = () => {
      const target = transaction.objectStore(newName);
      // eventType : champ d’affichage enregistré par erreur avant la version 0.8.10.
      for (const { eventType: _eventType, ...record } of request.result) target.put(record);
      database.deleteObjectStore(oldName);
    };
  }
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
      const transaction = db.transaction([collection, SYNC_QUEUE], "readwrite");
      transaction.objectStore(collection).put(record);
      enqueue(transaction, collection, record.id, false);
      await transactionComplete(transaction);
    },

    async remove(collection, id) {
      assertCollection(collection);
      const db = await getDatabase();
      const transaction = db.transaction([collection, SYNC_QUEUE], "readwrite");
      const store = transaction.objectStore(collection);
      const request = store.getKey(id);
      return new Promise((resolve, reject) => {
        let removed = false;
        request.onsuccess = () => {
          if (request.result !== undefined) {
            removed = true;
            store.delete(id);
            enqueue(transaction, collection, id, true);
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

    /** Remplace tout ; les ajouts et les retraits partent aussi en ligne. */
    async replaceAll(backup) {
      const data = validatePersonalData(backup);
      const db = await getDatabase();
      const storeNames = [...PERSONAL_DATA_COLLECTIONS, "settings", SYNC_QUEUE];
      const transaction = db.transaction(storeNames, "readwrite");
      for (const collection of PERSONAL_DATA_COLLECTIONS) {
        const store = transaction.objectStore(collection);
        const keptIds = new Set(data[collection].map(record => record.id));
        store.getAllKeys().onsuccess = event => {
          for (const id of event.target.result) {
            if (!keptIds.has(id)) enqueue(transaction, collection, id, true);
          }
          store.clear();
          for (const record of data[collection]) {
            store.put(record);
            enqueue(transaction, collection, record.id, false);
          }
        };
      }
      const settings = transaction.objectStore("settings");
      settings.clear();
      settings.put({ key: SETTINGS_KEY, value: data.settings });
      await transactionComplete(transaction);
    },

    /** @returns {Promise<import("../domain/sync.js").PendingChange[]>} */
    async listPending() {
      const db = await getDatabase();
      const transaction = db.transaction(SYNC_QUEUE, "readonly");
      return requestResult(transaction.objectStore(SYNC_QUEUE).getAll(), transaction);
    },

    /** Met toutes les données de l’appareil dans la file, pour un premier envoi. */
    async enqueueAll() {
      const db = await getDatabase();
      const transaction = db.transaction([...PERSONAL_DATA_COLLECTIONS, SYNC_QUEUE], "readwrite");
      for (const collection of PERSONAL_DATA_COLLECTIONS) {
        transaction.objectStore(collection).getAllKeys().onsuccess = event => {
          for (const id of event.target.result) enqueue(transaction, collection, id, false);
        };
      }
      await transactionComplete(transaction);
    },

    /** Retire de la file les modifications envoyées, sauf celles refaites entre-temps. */
    async clearPending(changes) {
      const db = await getDatabase();
      const transaction = db.transaction(SYNC_QUEUE, "readwrite");
      const queue = transaction.objectStore(SYNC_QUEUE);
      for (const change of changes) {
        queue.get(change.key).onsuccess = event => {
          if (event.target.result?.changedAt === change.changedAt) queue.delete(change.key);
        };
      }
      await transactionComplete(transaction);
    },

    /**
     * Applique des changements venus d’en ligne sans les remettre dans la file ; une modification
     * locale faite entre-temps l’emporte.
     * @returns {Promise<number>} Nombre d’enregistrements réellement modifiés.
     */
    async applyRemote({ saves, removes }) {
      if (!saves.length && !removes.length) return 0;
      const changes = [...saves, ...removes];
      const collections = [...new Set(changes.map(change => change.collection))];
      collections.forEach(assertCollection);
      const db = await getDatabase();
      const transaction = db.transaction([...collections, SYNC_QUEUE], "readwrite");
      const queue = transaction.objectStore(SYNC_QUEUE);
      let changed = 0;
      const unlessPending = (collection, id, apply) => {
        queue.getKey(pendingKey(collection, id)).onsuccess = event => {
          if (event.target.result === undefined) apply(transaction.objectStore(collection));
        };
      };
      for (const { collection, record } of saves) {
        unlessPending(collection, record.id, store => {
          store.get(record.id).onsuccess = event => {
            if (stableStringify(event.target.result) === stableStringify(record)) return;
            store.put(record);
            changed += 1;
          };
        });
      }
      for (const { collection, id } of removes) {
        unlessPending(collection, id, store => {
          store.getKey(id).onsuccess = event => {
            if (event.target.result === undefined) return;
            store.delete(id);
            changed += 1;
          };
        });
      }
      await transactionComplete(transaction);
      return changed;
    },

    async getSyncState() {
      const db = await getDatabase();
      const transaction = db.transaction(SYNC_STATE, "readonly");
      const entry = await requestResult(
        transaction.objectStore(SYNC_STATE).get(SYNC_STATE_KEY),
        transaction
      );
      return entry?.value ?? {};
    },

    async saveSyncState(value) {
      const db = await getDatabase();
      const transaction = db.transaction(SYNC_STATE, "readwrite");
      transaction.objectStore(SYNC_STATE).put({ key: SYNC_STATE_KEY, value });
      await transactionComplete(transaction);
    }
  });
}
