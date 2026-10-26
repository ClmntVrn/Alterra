import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PERSONAL_DATA_COLLECTIONS,
  PERSONAL_DATA_FORMAT_VERSION,
  createEmptyPersonalData,
  migratePersonalData,
  validatePersonalData
} from "../../src/domain/backup-format.js";

const workout = {
  id: "w1",
  date: "2026-10-24",
  type: "trail",
  title: "Sortie",
  status: "completed"
};
const personalRace = { id: "r1", name: "Course", date: "2026-11-28" };
const raceSheet = {
  id: "fiche",
  name: "Fiche",
  date: "2026-10-31",
  calendarDetails: "56 km",
  distanceKm: 56,
  ascentMeters: 2450
};

const formatTwo = () => ({
  formatVersion: 2,
  plannedSessions: [workout],
  activities: [],
  raceEvents: [{ ...personalRace, eventType: "personalRace" }],
  raceCatalog: [raceSheet],
  racePlans: [],
  nutritionProducts: [],
  equipment: [],
  settings: { browserStorage: { "alterra-fiche-checkpoints": "[]" } }
});

test("le format courant est le 3, avec workouts et personalRaces", () => {
  assert.equal(PERSONAL_DATA_FORMAT_VERSION, 3);
  const empty = createEmptyPersonalData();
  assert.deepEqual(
    Object.keys(empty).filter(key => Array.isArray(empty[key])),
    [...PERSONAL_DATA_COLLECTIONS]
  );
});

test("une sauvegarde au format 2 est migrée vers le format 3", () => {
  const original = formatTwo();
  const snapshot = structuredClone(original);
  const migrated = validatePersonalData(original);
  assert.equal(migrated.formatVersion, 3);
  assert.deepEqual(migrated.workouts, [workout]);
  assert.deepEqual(migrated.personalRaces, [personalRace], "eventType est retiré");
  assert.equal("plannedSessions" in migrated, false);
  assert.equal("raceEvents" in migrated, false);
  assert.deepEqual(migrated.raceCatalog, [raceSheet]);
  assert.deepEqual(migrated.settings, original.settings);
  assert.deepEqual(original, snapshot, "la sauvegarde d’origine n’est pas modifiée");
});

test("une sauvegarde au format 1 sans catalogue reçoit un catalogue vide", () => {
  const { raceCatalog: _raceCatalog, ...formatOne } = { ...formatTwo(), formatVersion: 1 };
  const migrated = validatePersonalData(formatOne);
  assert.equal(migrated.formatVersion, 3);
  assert.deepEqual(migrated.raceCatalog, []);
  assert.deepEqual(migrated.workouts, [workout]);
});

test("une sauvegarde au format 3 est acceptée telle quelle", () => {
  const formatThree = validatePersonalData(formatTwo());
  assert.deepEqual(validatePersonalData(formatThree), formatThree);
  assert.deepEqual(migratePersonalData(formatThree), formatThree);
});

test("les formats inconnus et les données invalides sont refusés", () => {
  assert.throws(
    () => validatePersonalData({ ...formatTwo(), formatVersion: 4 }),
    /non prise en charge/
  );
  assert.throws(() => validatePersonalData(null), /doivent être un objet/);
  assert.throws(
    () => validatePersonalData({ ...formatTwo(), plannedSessions: [workout, workout] }),
    /Identifiant en double dans « workouts »/
  );
  assert.throws(
    () => validatePersonalData({ ...formatTwo(), raceEvents: "x" }),
    /« personalRaces » doit être une liste/
  );
  assert.throws(
    () =>
      validatePersonalData({ ...formatTwo(), raceCatalog: [{ ...raceSheet, distanceKm: "56" }] }),
    /informations de référence/
  );
  assert.throws(
    () => validatePersonalData({ ...formatTwo(), settings: { browserStorage: { autre: "x" } } }),
    /donnée locale du navigateur/
  );
});

// Vérification facultative sur une vraie sauvegarde, gardée hors du dépôt :
// ALTERRA_BACKUP=chemin/vers/alterra-sauvegarde.json npm test
test(
  "une vraie sauvegarde est migrée sans perte",
  { skip: !process.env.ALTERRA_BACKUP && "ALTERRA_BACKUP non défini" },
  () => {
    const original = JSON.parse(readFileSync(process.env.ALTERRA_BACKUP, "utf8"));
    const migrated = validatePersonalData(original);
    assert.equal(migrated.formatVersion, 3);
    const strip = records => records.map(({ eventType: _eventType, ...record }) => record);
    if (original.formatVersion < 3) {
      assert.deepEqual(migrated.workouts, strip(original.plannedSessions));
      assert.deepEqual(migrated.personalRaces, strip(original.raceEvents));
    }
    for (const collection of [
      "raceCatalog",
      "racePlans",
      "activities",
      "nutritionProducts",
      "equipment"
    ]) {
      assert.deepEqual(migrated[collection], original[collection], collection);
    }
    assert.deepEqual(migrated.settings, original.settings);
    assert.deepEqual(validatePersonalData(migrated), migrated, "la migration est stable");
  }
);
