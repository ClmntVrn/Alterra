// Totaux hebdomadaires des séances réalisées.

import { addDays, daysBetween, parseDateKey, startOfWeek } from "./dates.js";
import { positiveOrZero } from "./numbers.js";

export const WEEK_COUNT = 12;

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
 * Séances réalisées des types demandés, avec une date valide.
 * @param {Array<Object>} workouts
 * @param {string[]} types
 */
export function filterCompletedWorkouts(workouts, types) {
  return workouts.filter(
    workout =>
      workout.status === "completed" &&
      types.includes(workout.type) &&
      parseDateKey(workout.date) !== null
  );
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
