// Actions communes aux tests navigateur.

/** Clé AAAA-MM-JJ du jour, dans le fuseau du navigateur. */
export function todayKey(page) {
  return page.evaluate(() => {
    const today = new Date();
    const pad = value => String(value).padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  });
}

/** Enregistre des données par le stockage de l’application (la page doit être celle du site). */
export function saveRecords(page, collection, records) {
  return page.evaluate(
    async (collection, records) => {
      const { createPersonalDataStore } = await import("/src/storage/personal-data.js");
      const { repository } = createPersonalDataStore();
      for (const record of records) await repository.save(collection, record);
    },
    collection,
    records
  );
}

/** Ouvre l’accueil et attend l’affichage du calendrier et des événements enregistrés. */
export async function openHome(page) {
  await page.goto("/index.html");
  await page.waitFor(
    () =>
      document.querySelectorAll(".calendar-day").length > 0 &&
      !document.getElementById("personalDataLastBackup").hidden,
    { message: "L’accueil ne s’est pas affiché." }
  );
}

/** Affiche la journée du jour dans le calendrier. */
export function openToday(page) {
  return page.evaluate(() =>
    document.querySelector(".calendar-day.is-today .calendar-date-button").click()
  );
}

/** Contenu brut de la base locale : version, collections et enregistrements. */
export function readDatabase(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("alterra-personal-data");
        request.onsuccess = () => {
          const database = request.result;
          const stores = [...database.objectStoreNames];
          const result = { version: database.version, stores, data: {} };
          const transaction = database.transaction(stores, "readonly");
          for (const store of stores) {
            transaction.objectStore(store).getAll().onsuccess = event => {
              result.data[store] = event.target.result;
            };
          }
          transaction.oncomplete = () => {
            database.close();
            resolve(result);
          };
        };
        request.onerror = () => reject(request.error);
      })
  );
}
