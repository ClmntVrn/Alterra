// Statistiques par semaine, mois ou année : totaux, comparaison avec la période précédente,
// records et répartition par sport. Les séances reçues sont déjà réalisées et filtrées.

import { addDays, daysBetween, parseDateKey, startOfWeek, toDateKey } from "./dates.js";
import { positiveOrZero } from "./numbers.js";
import { getWorkoutsInWeek, sumWorkouts } from "./statistics.js";

/** @typedef {"week" | "month" | "year"} PeriodKind */
/** @typedef {{ kind: PeriodKind, start: Date, end: Date }} Period Bornes incluses, à minuit. */
/** @typedef {import("./statistics.js").Totals & { count: number }} Summary */

export const PERIOD_COUNTS = Object.freeze({ week: 12, month: 12, year: 6 });

/** @returns {Date} Premier jour de la période de `date`, à minuit. */
function startOfPeriod(date, kind) {
  if (kind === "week") return startOfWeek(date);
  if (kind === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(date.getFullYear(), 0, 1);
}

/** @returns {Date} Début de la période décalée de `count` périodes. */
function shiftPeriodStart(start, kind, count) {
  if (kind === "week") return addDays(start, count * 7);
  if (kind === "month") return new Date(start.getFullYear(), start.getMonth() + count, 1);
  return new Date(start.getFullYear() + count, 0, 1);
}

/** @returns {Period} Semaine (lundi → dimanche), mois ou année civile contenant `date`. */
export function getPeriod(date, kind) {
  const start = startOfPeriod(date, kind);
  return { kind, start, end: addDays(shiftPeriodStart(start, kind, 1), -1) };
}

/** @returns {Period[]} Les `count` périodes qui finissent par celle de `today`, de la plus ancienne. */
export function listPeriods(today, kind, count = PERIOD_COUNTS[kind]) {
  const current = startOfPeriod(today, kind);
  return Array.from({ length: count }, (_, index) =>
    getPeriod(shiftPeriodStart(current, kind, index - count + 1), kind)
  );
}

/** @returns {Summary} Totaux et nombre de séances. */
export function summarize(workouts) {
  return { ...sumWorkouts(workouts), count: workouts.length };
}

/** @returns {Summary} Totaux des séances commencées entre `start` et `end` inclus. */
function summarizeRange(workouts, start, end) {
  return summarize(getWorkoutsInWeek(workouts, { start, end }));
}

/**
 * Totaux d’une période et de la précédente. Pour la période en cours, la précédente est coupée au
 * même nombre de jours écoulés (« à date ») : 1er au 4 novembre contre 1er au 4 octobre.
 * @param {Period} period
 * @param {Date} today
 * @returns {{ current: Summary, previous: Summary, previousPeriod: Period, isToDate: boolean }}
 */
export function comparePeriods(workouts, period, today) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const previousPeriod = getPeriod(addDays(period.start, -1), period.kind);
  const isToDate = day >= period.start && day < period.end;
  let previousEnd = previousPeriod.end;
  if (isToDate) {
    const sameDay = addDays(previousPeriod.start, daysBetween(period.start, day));
    if (sameDay < previousEnd) previousEnd = sameDay;
  }
  return {
    current: summarizeRange(workouts, period.start, period.end),
    previous: summarizeRange(workouts, previousPeriod.start, previousEnd),
    previousPeriod,
    isToDate
  };
}

/** @returns {number | null} Évolution relative (0,12 pour +12 %), null sans base de comparaison. */
export function computeChange(current, previous) {
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) return null;
  return (current - previous) / previous;
}

/** @returns {Object | null} Séance la plus haute sur `field`, la plus ancienne en cas d’égalité. */
function findBestWorkout(workouts, field) {
  let best = null;
  for (const workout of workouts) {
    const value = positiveOrZero(workout[field]);
    if (value > positiveOrZero(best?.[field]) && parseDateKey(workout.date)) best = workout;
  }
  return best;
}

/** @returns {{ period: Period, totals: Summary } | null} Période la plus longue en distance. */
function findBestPeriod(workouts, kind) {
  const groups = new Map();
  for (const workout of workouts) {
    const date = parseDateKey(workout.date);
    if (!date) continue;
    const key = toDateKey(startOfPeriod(date, kind));
    if (!groups.has(key)) groups.set(key, { period: getPeriod(date, kind), workouts: [] });
    groups.get(key).workouts.push(workout);
  }
  let best = null;
  for (const group of groups.values()) {
    const totals = summarize(group.workouts);
    const isBetter = best
      ? totals.distance > best.totals.distance ||
        (totals.distance === best.totals.distance && group.period.start < best.period.start)
      : totals.distance > 0;
    if (isBetter) best = { period: group.period, totals };
  }
  return best;
}

/**
 * Records sur toutes les séances reçues ; chaque record vaut null tant qu’il n’existe pas.
 * @returns {{ distance: Object|null, ascent: Object|null, duration: Object|null,
 *   week: { period: Period, totals: Summary }|null, month: { period: Period, totals: Summary }|null }}
 */
export function findRecords(workouts) {
  return {
    distance: findBestWorkout(workouts, "distanceKm"),
    ascent: findBestWorkout(workouts, "ascentMeters"),
    duration: findBestWorkout(workouts, "durationMinutes"),
    week: findBestPeriod(workouts, "week"),
    month: findBestPeriod(workouts, "month")
  };
}

/**
 * Totaux par type de séance, du plus long au plus court en temps (puis en distance).
 * @returns {Array<{ type: string, totals: Summary }>}
 */
export function splitBySport(workouts) {
  const groups = new Map();
  for (const workout of workouts) {
    if (!groups.has(workout.type)) groups.set(workout.type, []);
    groups.get(workout.type).push(workout);
  }
  return [...groups]
    .map(([type, items]) => ({ type, totals: summarize(items) }))
    .sort((a, b) => b.totals.duration - a.totals.duration || b.totals.distance - a.totals.distance);
}
