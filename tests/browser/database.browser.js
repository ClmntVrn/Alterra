// Base locale : mise à niveau d’une base en version 2, export, import et refus d’une sauvegarde invalide.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { createFormatTwoBackup, createRaceSheet } from "./fixtures.js";
import { openHome, openToday, readDatabase, todayKey } from "./helpers.js";

let browser;
let page;
let today;

const legacyWorkout = date => ({
  id: "seance-ancienne",
  date,
  type: "running",
  title: "Footing d’avant",
  status: "completed",
  time: "07:00",
  distanceKm: 8,
  durationMinutes: 45,
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:00.000Z"
});
const legacyRace = date => ({ id: "course-ancienne", name: "Course d’avant", date });

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
  await page.gotoBlank();
  today = await todayKey(page);
  // Base telle que l’enregistrait la version 0.8.14 : version 2, anciens noms de collections,
  // et une course modifiée avec le champ d’affichage eventType enregistré par erreur.
  await page.evaluate(
    (workout, race, sheet) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("alterra-personal-data", 2);
        request.onupgradeneeded = () => {
          const database = request.result;
          for (const name of [
            "plannedSessions",
            "activities",
            "raceEvents",
            "raceCatalog",
            "racePlans",
            "nutritionProducts",
            "equipment"
          ]) {
            database.createObjectStore(name, { keyPath: "id" });
          }
          database.createObjectStore("settings", { keyPath: "key" });
          const transaction = request.transaction;
          transaction.objectStore("plannedSessions").put(workout);
          transaction.objectStore("raceEvents").put({ ...race, eventType: "personalRace" });
          transaction.objectStore("raceCatalog").put(sheet);
          transaction.objectStore("settings").put({
            key: "root",
            value: { raceCatalogInitialized: true, lastBackupAt: "2026-10-20T08:00:00.000Z" }
          });
        };
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
      }),
    legacyWorkout(today),
    legacyRace(today),
    createRaceSheet(today)
  );
});

after(() => browser?.close());

const exportAll = () =>
  page.evaluate(async () => {
    const { createPersonalDataStore } = await import("/src/storage/personal-data.js");
    return createPersonalDataStore().exportAll();
  });
const restore = backup =>
  page.evaluate(async backup => {
    const { createPersonalDataStore } = await import("/src/storage/personal-data.js");
    try {
      await createPersonalDataStore().restore(backup);
      return null;
    } catch (error) {
      return error.message;
    }
  }, backup);
const withoutBackupDate = data => ({ ...data, settings: { ...data.settings, lastBackupAt: null } });

test("au lancement, la base passe de la version 2 à la version 3 sans perte", async () => {
  await openHome(page);
  const database = await readDatabase(page);
  assert.equal(database.version, 3);
  assert.deepEqual(database.stores.sort(), [
    "activities",
    "equipment",
    "nutritionProducts",
    "personalRaces",
    "raceCatalog",
    "racePlans",
    "settings",
    "workouts"
  ]);
  assert.deepEqual(database.data.workouts, [legacyWorkout(today)]);
  assert.deepEqual(database.data.personalRaces, [legacyRace(today)], "eventType est retiré");
  assert.deepEqual(database.data.raceCatalog, [createRaceSheet(today)]);
  assert.deepEqual(database.data.settings, [
    {
      key: "root",
      value: { raceCatalogInitialized: true, lastBackupAt: "2026-10-20T08:00:00.000Z" }
    }
  ]);
});

test("les données migrées s’affichent dans le calendrier", async () => {
  await openToday(page);
  await page.waitFor(() => document.querySelector(".calendar-training-item"));
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("#calendarEventDetails h3")].map(title => title.textContent)
    ),
    ["Ultra de test", "Footing d’avant", "Course d’avant"]
  );
});

test("l’export est au format 3 et se réimporte à l’identique", async () => {
  const exported = await exportAll();
  assert.equal(exported.formatVersion, 3);
  assert.equal("plannedSessions" in exported, false);
  assert.deepEqual(exported.workouts, [legacyWorkout(today)]);
  assert.equal(await restore(exported), null);
  assert.deepEqual(withoutBackupDate(await exportAll()), withoutBackupDate(exported));
});

test("une sauvegarde au format 2 s’importe dans la nouvelle version", async () => {
  assert.equal(await restore(createFormatTwoBackup(today)), null);
  const exported = await exportAll();
  assert.deepEqual(
    exported.workouts.map(workout => workout.id),
    ["seance-v2"]
  );
  assert.deepEqual(exported.personalRaces, [
    { id: "course-v2", name: "Course importée", date: today }
  ]);
  assert.equal(await page.evaluate(() => localStorage.getItem("alterra-test-etat")), "[]");
});

test("une sauvegarde invalide est refusée et les données restent intactes", async () => {
  const before = withoutBackupDate(await exportAll());
  const invalid = { ...createFormatTwoBackup(today), formatVersion: 9 };
  assert.match(await restore(invalid), /Version des données non prise en charge : 9/);
  assert.deepEqual(withoutBackupDate(await exportAll()), before);
});

test("aucune erreur JavaScript", () => {
  assert.deepEqual(page.errors, []);
});
