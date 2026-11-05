import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateKey } from "../../src/domain/dates.js";
import {
  WEEK_COUNT,
  averageOfPastWeeks,
  computeGuideLevels,
  computeWeeklyTotals,
  countHistoryWeeks,
  createWeekRange,
  createWeeks,
  filterCompletedWorkouts,
  filterWorkouts,
  getWorkoutsInWeek,
  listRaceResultsAsWorkouts,
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

test("listRaceResultsAsWorkouts compte seulement les courses validées, à leur date de départ", () => {
  const races = [
    { id: "a", name: "Prévue", date: "2026-10-04", distanceKm: 40 },
    {
      id: "b",
      name: "Faite",
      date: "2026-10-11",
      endDate: "2026-10-12",
      result: { type: "trail", distanceKm: 42.5, durationMinutes: 300, ascentMeters: 2100 }
    }
  ];
  assert.deepEqual(listRaceResultsAsWorkouts(races), [
    {
      id: "b",
      date: "2026-10-11",
      type: "trail",
      title: "Faite",
      status: "completed",
      distanceKm: 42.5,
      durationMinutes: 300,
      ascentMeters: 2100
    }
  ]);
  assert.equal(sumWorkouts(listRaceResultsAsWorkouts(races)).effort, 42.5 + 21);
});

test("filterWorkouts garde les séances prévues et réalisées des types demandés", () => {
  const workouts = [
    workout("2026-10-26"),
    workout("2026-10-27", { status: "planned" }),
    workout("2026-10-27", { status: "planned", type: "cycling" }),
    workout("pas une date", { status: "planned" })
  ];
  assert.equal(filterWorkouts(workouts, ["trail"]).length, 2);
});

test("averageOfPastWeeks ignore la semaine en cours", () => {
  const weeks = computeWeeklyTotals(createWeeks(new Date(2026, 9, 28)), [
    workout("2026-10-19", { distanceKm: 22 }),
    workout("2026-10-26", { distanceKm: 100 })
  ]);
  assert.equal(averageOfPastWeeks(weeks, "distance"), 2);
  assert.equal(averageOfPastWeeks(weeks.slice(-1), "distance"), 0);
});

test("createWeekRange va des semaines passées aux semaines à venir", () => {
  const weeks = createWeekRange(new Date(2026, 9, 28), 4, 4);
  assert.equal(weeks.length, 9);
  assert.equal(toDateKey(weeks[0].start), "2026-09-28");
  assert.equal(toDateKey(weeks[4].start), "2026-10-26");
  assert.equal(toDateKey(weeks.at(-1).end), "2026-11-29");
});

test("countHistoryWeeks remonte à la plus ancienne séance, entre 11 et 52 semaines", () => {
  const today = new Date(2026, 9, 28);
  assert.equal(countHistoryWeeks([], today), 11);
  assert.equal(countHistoryWeeks([workout("2026-10-01")], today), 11);
  assert.equal(countHistoryWeeks([workout("2026-07-01"), workout("2026-11-20")], today), 17);
  assert.equal(countHistoryWeeks([workout("2020-01-01"), workout("pas une date")], today), 52);
});

test("computeGuideLevels ajoute une ligne au milieu des grands écarts", () => {
  const kinds = levels => levels.map(level => `${level.kind} ${level.value}`);
  assert.deepEqual(kinds(computeGuideLevels(47, 30, 116, 28)), [
    "max 47",
    "average 30",
    "middle 15"
  ]);
  assert.deepEqual(kinds(computeGuideLevels(40, 0, 116, 28)), ["max 40", "middle 20"]);
  assert.deepEqual(kinds(computeGuideLevels(40, 38, 116, 28)), [
    "max 40",
    "average 38",
    "middle 19"
  ]);
  assert.deepEqual(kinds(computeGuideLevels(40, 20, 100, 28)), ["max 40", "average 20"]);
  assert.deepEqual(kinds(computeGuideLevels(1880, 1207, 116, 28)), [
    "max 1880",
    "average 1207",
    "middle 600"
  ]);
  assert.deepEqual(computeGuideLevels(0, 0, 116, 28), []);
});
