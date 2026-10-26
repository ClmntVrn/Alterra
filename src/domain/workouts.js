// Règles des séances d’entraînement (collection plannedSessions).

import { addDays, formatTimeOfDay, parseDateKey, toDateKey } from "./dates.js";

const MINUTES_PER_DAY = 1440;

/** @typedef {"planned" | "completed" | "toCheck"} WorkoutState */

/**
 * Fin d’une séance déduite de son début et de sa durée ; sans heure, elle part de minuit.
 * @param {string} date Clé AAAA-MM-JJ du début.
 * @param {string} [time] Heure de début HH:mm.
 * @param {number|null} [durationMinutes]
 * @returns {{ endDate: string, endTime: string|null }} endTime est null sans heure de début.
 */
export function computeWorkoutEnd(date, time, durationMinutes) {
  const start = parseDateKey(date);
  if (!start || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { endDate: date, endTime: null };
  }
  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];
  const startMinutes = hours * 60 + minutes;
  // Une séance qui finit pile à minuit reste sur la veille.
  const end = addDays(start, Math.floor((startMinutes + durationMinutes - 1) / MINUTES_PER_DAY));
  const endMinutes = Math.round(startMinutes + durationMinutes) % MINUTES_PER_DAY;
  return { endDate: toDateKey(end), endTime: time ? formatTimeOfDay(endMinutes) : null };
}

/**
 * Une séance prévue dont la dernière journée est passée est « à vérifier ».
 * @param {{ status: string, date: string, endDate?: string }} workout
 * @param {string} todayKey Clé AAAA-MM-JJ du jour.
 * @returns {WorkoutState}
 */
export function getWorkoutState(workout, todayKey) {
  if (workout.status === "completed") return "completed";
  return (workout.endDate || workout.date) < todayKey ? "toCheck" : "planned";
}

/** @returns {string} Allure « m:ss min/km », ou "" si distance ou durée manquent. */
export function formatPace(distanceKm, durationMinutes) {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return "";
  }
  const secondsPerKm = Math.round((durationMinutes * 60) / distanceKm);
  const paceMinutes = Math.floor(secondsPerKm / 60);
  const paceSeconds = String(secondsPerKm % 60).padStart(2, "0");
  return `${paceMinutes}:${paceSeconds} min/km`;
}
