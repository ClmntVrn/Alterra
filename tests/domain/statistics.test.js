import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateKey } from "../../src/domain/dates.js";
import {
  WEEK_COUNT,
  computeWeeklyTotals,
  createWeeks,
  filterCompletedWorkouts,
  getWorkoutsInWeek,
  sumWorkouts
} from "../../src/domain/statistics.js";

const workout = (date, values = {}) => ({ status: "completed", type: "trail", date, ...values });

test("createWeeks couvre 12 semaines du lundi au dimanche, la dernière contenant aujourd’hui", () => {
  const weeks = createWeeks(new Date(2026, 9, 28));
  assert.equal(weeks.length, WEEK_COUNT);
  assert.equal(toDateKey(weeks.at(-1).start), "2026-10-26");
  assert.equal(toDateKey(weeks.at(-1).end), "2026-11-01");
  assert.equal(toDateKey(weeks[0].start), "2026-08-10");
});

test("sumWorkouts additionne et calcule le km-effort", () => {
  const totals = sumWorkouts([
    workout("2026-10-26", { distanceKm: 10, durationMinutes: 60, ascentMeters: 500 }),
    workout("2026-10-27", { distanceKm: 5.5, durationMinutes: 30 })
  ]);
  assert.deepEqual(totals, { distance: 15.5, duration: 90, ascent: 500, effort: 20.5 });
});

test("sumWorkouts ignore les valeurs absentes ou négatives", () => {
  const totals = sumWorkouts([workout("2026-10-26", { distanceKm: -3, ascentMeters: "400" })]);
  assert.deepEqual(totals, { distance: 0, duration: 0, ascent: 0, effort: 0 });
});

test("filterCompletedWorkouts garde les séances réalisées des types demandés", () => {
  const workouts = [
    workout("2026-10-26"),
    workout("2026-10-26", { type: "running" }),
    workout("2026-10-26", { type: "cycling" }),
    workout("2026-10-26", { status: "planned" }),
    workout("2026-02-30")
  ];
  assert.equal(filterCompletedWorkouts(workouts, ["trail", "running"]).length, 2);
  assert.equal(filterCompletedWorkouts(workouts, ["cycling"]).length, 1);
});

test("computeWeeklyTotals compte une séance une seule fois, dans la semaine de son début", () => {
  const weeks = computeWeeklyTotals(createWeeks(new Date(2026, 9, 28)), [
    workout("2026-10-25", { distanceKm: 30, endDate: "2026-10-27" }),
    workout("2026-11-01", { distanceKm: 8 }),
    workout("2026-01-01", { distanceKm: 99 })
  ]);
  assert.equal(weeks.at(-2).totals.distance, 30);
  assert.equal(weeks.at(-1).totals.distance, 8);
  assert.equal(
    weeks.reduce((sum, week) => sum + week.totals.distance, 0),
    38
  );
});

test("computeWeeklyTotals ne modifie pas les semaines reçues (pas de double comptage)", () => {
  const weeks = createWeeks(new Date(2026, 9, 28));
  const workouts = [workout("2026-10-26", { distanceKm: 10 })];
  computeWeeklyTotals(weeks, workouts);
  const again = computeWeeklyTotals(weeks, workouts);
  assert.equal(weeks.at(-1).totals.distance, 0);
  assert.equal(again.at(-1).totals.distance, 10);
});

test("getWorkoutsInWeek sélectionne les séances qui commencent dans la semaine", () => {
  const [week] = createWeeks(new Date(2026, 9, 28), 1);
  const workouts = [workout("2026-10-26"), workout("2026-11-01"), workout("2026-11-02")];
  assert.equal(getWorkoutsInWeek(workouts, week).length, 2);
});
