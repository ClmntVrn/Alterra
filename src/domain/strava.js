// Import des activités Strava : conversion d’une activité en séance et rapprochement avec les
// séances déjà enregistrées. Règles pures, partagées par l’application et le serveur.

import { isDateKey } from "./dates.js";
import { computeWorkoutEnd } from "./workouts.js";

/** Sports Strava importés (`sport_type`) et type de séance correspondant ; les autres sont ignorés. */
export const STRAVA_SPORT_TYPES = Object.freeze({
  TrailRun: "trail",
  Run: "running",
  Ride: "cycling",
  GravelRide: "cycling",
  MountainBikeRide: "cycling",
  VirtualRide: "cycling",
  WeightTraining: "strength",
  Workout: "strength",
  Hike: "hiking",
  Walk: "hiking",
  BackcountrySki: "skiTouring",
  NordicSki: "skiTouring"
});

/** Préfixe de l’identifiant d’une séance créée par l’import. */
const IMPORTED_ID_PREFIX = "strava-";

/** Chiffres que l’activité remplace sur la séance ; la FC n’est remplacée que si Strava la donne. */
const REPLACED_MEASURES = ["distanceKm", "ascentMeters", "durationMinutes"];
const HEART_RATE_MEASURES = ["heartRateAvg", "heartRateMax"];

/** @returns {string} Identifiant de la séance créée pour une activité. */
export function importedWorkoutId(activityId) {
  return `${IMPORTED_ID_PREFIX}${activityId}`;
}

const positive = value => (Number.isFinite(value) && value > 0 ? value : null);

/**
 * Séance tirée d’une activité Strava (résumé de l’API), sans identifiant ni dates d’écriture.
 * L’heure locale de départ donne la date et l’heure ; la durée est le temps total, arrêts compris.
 * @param {Object} activity
 * @returns {Object|null} null pour un sport non importé ou une activité sans date lisible.
 */
export function convertActivity(activity) {
  const type = STRAVA_SPORT_TYPES[activity?.sport_type ?? activity?.type];
  // Strava écrit l’heure locale suivie d’un « Z » trompeur : on n’en lit que les chiffres.
  const start = String(activity?.start_date_local ?? "");
  const date = start.slice(0, 10);
  const time = start.slice(11, 16);
  if (!type || !isDateKey(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const fields = { type, date, time, stravaActivityId: String(activity.id) };
  const name = String(activity.name ?? "").trim();
  if (name) fields.title = name.slice(0, 100);
  const distance = positive(activity.distance);
  if (distance) fields.distanceKm = Math.round(distance / 10) / 100;
  const ascent = positive(activity.total_elevation_gain);
  if (ascent) fields.ascentMeters = Math.round(ascent);
  const elapsed = positive(activity.elapsed_time);
  if (elapsed) fields.durationMinutes = Math.max(1, Math.round(elapsed / 60));
  const average = positive(activity.average_heartrate);
  if (average) fields.heartRateAvg = Math.round(average);
  const max = positive(activity.max_heartrate);
  if (max) fields.heartRateMax = Math.round(max);
  return fields;
}

const minutesOf = time => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * Séance à laquelle rattacher l’activité convertie : celle déjà reliée à cette activité ; sinon
 * une séance prévue du même jour et du même type, la plus proche en heure ; sinon une séance
 * réalisée du même jour et du même type sans lien Strava (saisie à la main).
 * @param {Object[]} workouts
 * @param {Object} fields Résultat de `convertActivity`.
 * @returns {Object|null}
 */
export function findMatchingWorkout(workouts, fields) {
  const linked = workouts.find(workout => workout.stravaActivityId === fields.stravaActivityId);
  if (linked) return linked;
  const candidates = workouts.filter(
    workout =>
      !workout.stravaActivityId && workout.date === fields.date && workout.type === fields.type
  );
  const gap = workout =>
    workout.time ? Math.abs(minutesOf(workout.time) - minutesOf(fields.time)) : Infinity;
  const closest = list => [...list].sort((a, b) => gap(a) - gap(b))[0] ?? null;
  return (
    closest(candidates.filter(workout => workout.status !== "completed")) ??
    closest(candidates.filter(workout => workout.status === "completed"))
  );
}

/**
 * Séance à enregistrer pour une activité Strava : la séance rapprochée, marquée réalisée avec les
 * chiffres de Strava, ou une nouvelle séance réalisée. Le ressenti, la météo et les notes sont
 * gardés, comme le nom d’une séance rapprochée.
 * @param {Object[]} workouts Séances enregistrées.
 * @param {Object} activity Activité Strava.
 * @param {string} nowIso Heure de l’import (ISO), pour les dates d’écriture.
 * @returns {{ workout: Object, created: boolean } | null} null pour une activité non importée.
 */
export function applyActivity(workouts, activity, nowIso) {
  const fields = convertActivity(activity);
  if (!fields) return null;
  const existing = findMatchingWorkout(workouts, fields);
  const workout = existing
    ? { ...existing }
    : { id: importedWorkoutId(fields.stravaActivityId), createdAt: nowIso };
  for (const key of REPLACED_MEASURES) {
    if (key in fields) workout[key] = fields[key];
    else delete workout[key];
  }
  for (const key of HEART_RATE_MEASURES) {
    if (key in fields) workout[key] = fields[key];
  }
  // Une séance créée par l’import suit le nom donné sur Strava ; une séance rapprochée garde le sien.
  if (
    fields.title &&
    (workout.id === importedWorkoutId(fields.stravaActivityId) || !workout.title)
  ) {
    workout.title = fields.title;
  }
  Object.assign(workout, {
    type: fields.type,
    date: fields.date,
    time: fields.time,
    status: "completed",
    stravaActivityId: fields.stravaActivityId
  });
  workout.completedAt = existing?.completedAt || nowIso;
  const { endDate } = computeWorkoutEnd(workout.date, workout.time, workout.durationMinutes);
  if (endDate > workout.date) workout.endDate = endDate;
  else delete workout.endDate;
  return { workout, created: !existing };
}

/**
 * Séance à supprimer quand l’activité est supprimée sur Strava : seulement celle que l’import a
 * créée. Une séance prévue ou saisie à la main, puis rapprochée, reste telle quelle.
 * @returns {Object|null}
 */
export function findWorkoutToRemove(workouts, activityId) {
  const id = importedWorkoutId(activityId);
  return workouts.find(workout => workout.id === id) ?? null;
}
