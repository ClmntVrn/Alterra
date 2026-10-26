import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  isDateKey,
  isDateKeyInRange,
  parseDateKey,
  parseTimeOfDay,
  startOfWeek,
  toDateKey
} from "../../src/domain/dates.js";

test("toDateKey complète mois et jour sur deux chiffres", () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("parseDateKey rend minuit local et refuse les dates impossibles", () => {
  const date = parseDateKey("2026-10-26");
  assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate()], [2026, 9, 26]);
  assert.equal(date.getHours(), 0);
  assert.equal(parseDateKey("2026-02-30"), null);
  assert.equal(parseDateKey("2026-2-3"), null);
  assert.equal(parseDateKey(undefined), null);
  assert.equal(isDateKey("2028-02-29"), true);
  assert.equal(isDateKey("2027-02-29"), false);
});

test("isDateKeyInRange inclut les bornes et accepte une fin absente", () => {
  assert.equal(isDateKeyInRange("2026-10-26", "2026-10-26", "2026-10-28"), true);
  assert.equal(isDateKeyInRange("2026-10-28", "2026-10-26", "2026-10-28"), true);
  assert.equal(isDateKeyInRange("2026-10-29", "2026-10-26", "2026-10-28"), false);
  assert.equal(isDateKeyInRange("2026-10-26", "2026-10-26"), true);
});

test("addDays traverse les mois et les années sans modifier l’original", () => {
  const original = new Date(2026, 11, 31);
  assert.equal(toDateKey(addDays(original, 1)), "2027-01-01");
  assert.equal(toDateKey(addDays(original, -31)), "2026-11-30");
  assert.equal(toDateKey(original), "2026-12-31");
});

test("startOfWeek renvoie le lundi, y compris depuis un dimanche", () => {
  assert.equal(toDateKey(startOfWeek(new Date(2026, 9, 26))), "2026-10-26");
  assert.equal(toDateKey(startOfWeek(new Date(2026, 10, 1))), "2026-10-26");
  assert.equal(toDateKey(startOfWeek(new Date(2026, 9, 28, 23, 30))), "2026-10-26");
});

test("daysBetween compte des jours calendaires malgré le changement d’heure", () => {
  // Passage à l’heure d’hiver en France dans la nuit du 24 au 25 octobre 2026.
  assert.equal(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26)), 2);
  assert.equal(daysBetween(new Date(2026, 9, 26), new Date(2026, 9, 24)), -2);
});

test("parseTimeOfDay accepte les saisies rapides", () => {
  assert.equal(parseTimeOfDay("9"), "09:00");
  assert.equal(parseTimeOfDay("930"), "09:30");
  assert.equal(parseTimeOfDay("1730"), "17:30");
  assert.equal(parseTimeOfDay("9h30"), "09:30");
  assert.equal(parseTimeOfDay("22h"), "22:00");
  assert.equal(parseTimeOfDay(" 09:30 "), "09:30");
  assert.equal(parseTimeOfDay(""), "");
  assert.equal(parseTimeOfDay(null), "");
});

test("parseTimeOfDay refuse les heures impossibles", () => {
  for (const value of ["2560", "24", "9:75", "abc", "12345"]) {
    assert.equal(parseTimeOfDay(value), null, value);
  }
});
