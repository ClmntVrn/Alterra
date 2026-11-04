import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateKey } from "../../src/domain/dates.js";
import {
  comparePeriods,
  computeChange,
  findRecords,
  getPeriod,
  listPeriods,
  splitBySport,
  summarize
} from "../../src/domain/period-statistics.js";

const day = (year, month, date) => new Date(year, month - 1, date);
const keys = period => [toDateKey(period.start), toDateKey(period.end)];
const workout = (date, values = {}) => ({ date, type: "trail", status: "completed", ...values });

test("getPeriod donne la semaine, le mois ou l’année civile d’une date", () => {
  const date = day(2026, 11, 4);
  assert.deepEqual(keys(getPeriod(date, "week")), ["2026-11-02", "2026-11-08"]);
  assert.deepEqual(keys(getPeriod(date, "month")), ["2026-11-01", "2026-11-30"]);
  assert.deepEqual(keys(getPeriod(date, "year")), ["2026-01-01", "2026-12-31"]);
  assert.deepEqual(keys(getPeriod(day(2028, 2, 10), "month")), ["2028-02-01", "2028-02-29"]);
});

test("listPeriods finit par la période en cours et passe d’une année à l’autre", () => {
  const months = listPeriods(day(2026, 2, 15), "month", 3);
  assert.deepEqual(months.map(keys), [
    ["2025-12-01", "2025-12-31"],
    ["2026-01-01", "2026-01-31"],
    ["2026-02-01", "2026-02-28"]
  ]);
  assert.equal(listPeriods(day(2026, 11, 4), "year").length, 6);
  assert.equal(listPeriods(day(2026, 11, 4), "week").length, 12);
});

test("summarize compte les séances en plus des totaux", () => {
  assert.deepEqual(summarize([workout("2026-11-01", { distanceKm: 10, ascentMeters: 300 })]), {
    distance: 10,
    duration: 0,
    ascent: 300,
    effort: 13,
    count: 1
  });
});

test("comparePeriods compare la période en cours à la précédente à la même date", () => {
  const workouts = [
    workout("2026-10-02", { distanceKm: 10 }),
    workout("2026-10-20", { distanceKm: 30 }),
    workout("2026-11-03", { distanceKm: 12 })
  ];
  const today = day(2026, 11, 4);
  const result = comparePeriods(workouts, getPeriod(today, "month"), today);
  assert.equal(result.isToDate, true);
  assert.equal(result.current.distance, 12);
  assert.equal(result.previous.distance, 10, "seulement du 1er au 4 octobre");
  assert.deepEqual(keys(result.previousPeriod), ["2026-10-01", "2026-10-31"]);
});

test("comparePeriods compare une période terminée à toute la précédente", () => {
  const workouts = [
    workout("2026-09-30", { distanceKm: 8 }),
    workout("2026-10-20", { distanceKm: 30 })
  ];
  const result = comparePeriods(workouts, getPeriod(day(2026, 10, 1), "month"), day(2026, 11, 4));
  assert.equal(result.isToDate, false);
  assert.equal(result.current.distance, 30);
  assert.equal(result.previous.distance, 8);
});

test("comparePeriods coupe au dernier jour d’un mois précédent plus court", () => {
  const workouts = [workout("2026-02-28", { distanceKm: 5 })];
  const today = day(2026, 3, 30);
  assert.equal(comparePeriods(workouts, getPeriod(today, "month"), today).previous.distance, 5);
});

test("computeChange rend l’évolution relative, ou null sans base", () => {
  assert.equal(computeChange(112, 100), 0.12);
  assert.equal(computeChange(50, 100), -0.5);
  assert.equal(computeChange(10, 0), null);
});

test("findRecords trouve la plus longue sortie, le plus gros D+ et les meilleures périodes", () => {
  const long = workout("2026-10-05", { distanceKm: 42, durationMinutes: 300, ascentMeters: 900 });
  const steep = workout("2026-10-12", { distanceKm: 15, durationMinutes: 180, ascentMeters: 1500 });
  const records = findRecords([
    long,
    steep,
    workout("2026-11-02", { distanceKm: 20 }),
    workout("2026-11-03", { distanceKm: 30 })
  ]);
  assert.equal(records.distance, long);
  assert.equal(records.ascent, steep);
  assert.equal(records.duration, long);
  assert.deepEqual(keys(records.week.period), ["2026-11-02", "2026-11-08"]);
  assert.equal(records.week.totals.distance, 50);
  assert.equal(records.month.totals.distance, 57);
  assert.deepEqual(keys(records.month.period), ["2026-10-01", "2026-10-31"]);
});

test("findRecords rend null tant qu’aucune valeur n’est saisie", () => {
  assert.deepEqual(findRecords([workout("2026-11-02", { durationMinutes: 40 })]), {
    distance: null,
    ascent: null,
    duration: workout("2026-11-02", { durationMinutes: 40 }),
    week: null,
    month: null
  });
});

test("splitBySport regroupe par type, du plus long au plus court en temps", () => {
  const split = splitBySport([
    workout("2026-11-02", { type: "running", durationMinutes: 50, distanceKm: 10 }),
    workout("2026-11-03", { type: "cycling", durationMinutes: 120, distanceKm: 50 }),
    workout("2026-11-04", { type: "running", durationMinutes: 40, distanceKm: 8 })
  ]);
  assert.deepEqual(
    split.map(({ type, totals }) => [type, totals.count, totals.duration, totals.distance]),
    [
      ["cycling", 1, 120, 50],
      ["running", 2, 90, 18]
    ]
  );
});
