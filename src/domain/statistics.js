// Totaux hebdomadaires des séances réalisées.

import { addDays, daysBetween, parseDateKey, startOfWeek } from "./dates.js";
import { positiveOrZero } from "./numbers.js";

export const WEEK_COUNT = 12;
/** Graphique de l’accueil : semaines passées (au moins, au plus) et semaines à venir. */
export const HISTORY_WEEKS = Object.freeze({ min: 4, max: 52 });
export const FUTURE_WEEKS = 4;

/** @typedef {{ distance: number, duration: number, ascent: number, effort: number }} Totals */
/** @typedef {{ start: Date, end: Date, totals: Totals }} Week */

/** @returns {Totals} */
export function createTotals() {
  return { distance: 0, duration: 0, ascent: 0, effort: 0 };
}

/** Ajoute une séance aux totaux ; km-effort = km + D+ en mètres / 100. */
export function addWorkoutToTotals(totals, workout) {
  const distance = positiveOrZero(workout.distanceKm);
  const ascent = positiveOrZero(workout.ascentMeters);
  totals.distance += distance;
  totals.duration += positiveOrZero(workout.durationMinutes);
  totals.ascent += ascent;
  totals.effort += distance + ascent / 100;
}

/** @returns {Totals} */
export function sumWorkouts(workouts) {
  const totals = createTotals();
  workouts.forEach(workout => addWorkoutToTotals(totals, workout));
  return totals;
}

/**
 * Courses validées vues comme des séances réalisées, pour les statistiques : type, distance,
 * durée, D+, ressenti, FC, météo et notes viennent du résultat saisi, la date est celle du départ.
 * @param {Array<Object>} races Courses du catalogue et personnelles.
 */
export function listRaceResultsAsWorkouts(races) {
  return races
    .filter(race => race.result && typeof race.result === "object")
    .map(race => ({
      ...race.result,
      id: race.id,
      date: race.date,
      title: race.name,
      status: "completed"
    }));
}

/**
 * Séances réalisées des types demandés, avec une date valide.
 * @param {Array<Object>} workouts
 * @param {string[]} types
 */
export function filterCompletedWorkouts(workouts, types) {
  return filterWorkouts(workouts, types).filter(workout => workout.status === "completed");
}

/**
 * Séances prévues ou réalisées des types demandés, avec une date valide : le prévu d’une semaine.
 * @param {Array<Object>} workouts
 * @param {string[]} types
 */
export function filterWorkouts(workouts, types) {
  return workouts.filter(
    workout => types.includes(workout.type) && parseDateKey(workout.date) !== null
  );
}

/**
 * Moyenne d’un total sur les semaines terminées (toutes sauf la dernière, en cours).
 * @param {Week[]} weeks
 * @param {keyof Totals} metric
 */
export function averageOfPastWeeks(weeks, metric) {
  const past = weeks.slice(0, -1);
  if (!past.length) return 0;
  return past.reduce((sum, week) => sum + week.totals[metric], 0) / past.length;
}

/**
 * Les `count` semaines (lundi → dimanche) qui finissent par celle de `today`, totaux à zéro.
 * @returns {Week[]}
 */
export function createWeeks(today, count = WEEK_COUNT) {
  const currentWeek = startOfWeek(today);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(currentWeek, -(count - index - 1) * 7);
    return { start, end: addDays(start, 6), totals: createTotals() };
  });
}

/**
 * Semaines de `past` semaines avant celle de `today` à `future` semaines après, totaux à zéro.
 * @returns {Week[]}
 */
export function createWeekRange(today, past, future) {
  const currentWeek = startOfWeek(today);
  return Array.from({ length: past + 1 + future }, (_, index) => {
    const start = addDays(currentWeek, (index - past) * 7);
    return { start, end: addDays(start, 6), totals: createTotals() };
  });
}

/**
 * Nombre de semaines passées à montrer : jusqu’à la semaine de la plus ancienne séance, dans les
 * bornes `min` et `max`.
 * @param {Array<Object>} workouts
 * @param {{ min: number, max: number }} bounds
 */
export function countHistoryWeeks(workouts, today, { min, max } = HISTORY_WEEKS) {
  const currentWeek = startOfWeek(today);
  let weeks = min;
  for (const workout of workouts) {
    const date = parseDateKey(workout.date);
    if (!date) continue;
    weeks = Math.max(weeks, daysBetween(startOfWeek(date), currentWeek) / 7);
  }
  return Math.min(weeks, max);
}

/**
 * Totaux de chaque semaine : une séance compte une seule fois, dans la semaine de sa date de
 * début ; les séances hors période sont ignorées.
 * @param {Week[]} weeks Non modifiées.
 * @returns {Week[]} Nouvelles semaines avec leurs totaux.
 */
export function computeWeeklyTotals(weeks, workouts) {
  const result = weeks.map(week => ({ ...week, totals: createTotals() }));
  for (const workout of workouts) {
    const date = parseDateKey(workout.date);
    if (!date) continue;
    const index = daysBetween(result[0].start, startOfWeek(date)) / 7;
    if (index < 0 || index >= result.length) continue;
    addWorkoutToTotals(result[index].totals, workout);
  }
  return result;
}

/** Séances dont la date de début tombe dans la semaine. */
export function getWorkoutsInWeek(workouts, week) {
  return workouts.filter(workout => {
    const date = parseDateKey(workout.date);
    return date !== null && date >= week.start && date <= week.end;
  });
}
