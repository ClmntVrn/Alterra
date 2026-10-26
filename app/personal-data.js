import {
  createEmptyPersonalData,
  PERSONAL_DATA_COLLECTIONS,
  validatePersonalData
} from "./domain/models.js";
import { createPersonalDataRepository } from "./storage/repository.js";
import { createIndexedDbAdapter } from "./storage/indexeddb.js";

const LOCAL_STATE_PREFIX = "alterra-";

export function createPersonalDataStore() {
  const adapter = createIndexedDbAdapter();
  const repository = createPersonalDataRepository(adapter);
  return Object.freeze({
    repository,
    getSettings: () => adapter.getSettings(),
    saveSettings: value => adapter.saveSettings(value),
    initializeRaceCatalog: records => adapter.initializeRaceCatalog(records),

    async recordBackup(lastBackupAt) {
      const settings = await adapter.getSettings();
      await adapter.saveSettings({ ...settings, lastBackupAt });
    },

    async exportAll() {
      const data = createEmptyPersonalData();
      for (const collection of PERSONAL_DATA_COLLECTIONS) {
        data[collection] = await repository.list(collection);
      }
      data.settings = await adapter.getSettings();
      const browserStorage = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(LOCAL_STATE_PREFIX)) {
          browserStorage[key] = localStorage.getItem(key);
        }
      }
      data.settings = { ...data.settings, browserStorage, lastBackupAt: new Date().toISOString() };
      return validatePersonalData(data);
    },

    async restore(data) {
      validatePersonalData(data);
      await adapter.replaceAll(data);
      const browserStorage = data.settings.browserStorage || {};
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(LOCAL_STATE_PREFIX)) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(browserStorage)) {
        localStorage.setItem(key, value);
      }
    }
  });
}
