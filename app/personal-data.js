import {
  createEmptyPersonalData,
  PERSONAL_DATA_COLLECTIONS,
  validatePersonalData
} from "./domain/models.js";
import { createPersonalDataRepository } from "./storage/repository.js";
import { createIndexedDbAdapter } from "./storage/indexeddb.js";

export function createPersonalDataStore() {
  const adapter = createIndexedDbAdapter();
  const repository = createPersonalDataRepository(adapter);
  return Object.freeze({
    repository,

    async exportAll() {
      const data = createEmptyPersonalData();
      for (const collection of PERSONAL_DATA_COLLECTIONS) {
        data[collection] = await repository.list(collection);
      }
      data.settings = await adapter.getSettings();
      return validatePersonalData(data);
    },

    async restore(data) {
      validatePersonalData(data);
      await adapter.replaceAll(data);
    }
  });
}
