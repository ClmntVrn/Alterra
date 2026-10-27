// Éléments communs à la carte et au détail d’une séance : chiffres, catégorie, case « réalisée ».

import { formatDuration } from "../../domain/durations.js";
import { formatPace } from "../../domain/workouts.js";
import { el } from "../../ui/dom.js";
import { formatNumber } from "../../ui/format.js";
import {
  WORKOUT_STATE_LABELS,
  WORKOUT_TYPE_LABELS,
  WORKOUT_WEATHER_LABELS
} from "./workout-labels.js";

const CHECK_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12.5 4 4 8-9"></path></svg>';

// Chiffres de la carte selon le type, comme sur Strava : l’allure compte en course à pied,
// le dénivelé en trail et à vélo.
const SUMMARY_STATS = {
  trail: ["distance", "ascent", "duration"],
  running: ["distance", "pace", "duration"],
  cycling: ["distance", "ascent", "duration"],
  strength: ["duration"]
};
const DEFAULT_SUMMARY_STATS = ["distance", "ascent", "duration"];

function readStats(workout) {
  const pace = formatPace(workout.distanceKm, workout.durationMinutes);
  const isCompleted = workout.status === "completed";
  return {
    distance: Number.isFinite(workout.distanceKm)
      ? ["Distance", `${formatNumber(workout.distanceKm)} km`]
      : null,
    ascent: Number.isFinite(workout.ascentMeters)
      ? ["D+", `${formatNumber(workout.ascentMeters)} m`]
      : null,
    duration: Number.isFinite(workout.durationMinutes)
      ? ["Durée", formatDuration(workout.durationMinutes)]
      : null,
    pace: pace ? ["Allure", pace.replace(" min/km", " /km")] : null,
    effort:
      isCompleted && Number.isFinite(workout.perceivedEffort)
        ? ["Ressenti", `${workout.perceivedEffort}/10`]
        : null,
    heartRateAvg:
      isCompleted && Number.isFinite(workout.heartRateAvg)
        ? ["FC moy.", `${workout.heartRateAvg} bpm`]
        : null,
    heartRateMax:
      isCompleted && Number.isFinite(workout.heartRateMax)
        ? ["FC max", `${workout.heartRateMax} bpm`]
        : null,
    weather:
      isCompleted && WORKOUT_WEATHER_LABELS[workout.weather]
        ? ["Météo", WORKOUT_WEATHER_LABELS[workout.weather]]
        : null
  };
}

/**
 * @param {Object} workout
 * @param {{ full?: boolean }} [options] full : tous les chiffres, pour le détail.
 * @returns {HTMLElement | null} null si aucun chiffre n’est renseigné.
 */
export function renderWorkoutStats(workout, { full = false } = {}) {
  const stats = readStats(workout);
  const keys = full ? Object.keys(stats) : SUMMARY_STATS[workout.type] || DEFAULT_SUMMARY_STATS;
  const items = keys
    .map(key => stats[key])
    .filter(Boolean)
    .map(([label, value]) => el("div", {}, [el("dt", { text: label }), el("dd", { text: value })]));
  if (!items.length) return null;
  return el("dl", { className: `workout-stats${full ? " is-full" : ""}` }, items);
}

/** « TRAIL · RÉALISÉ » ; le type est omis quand il sert déjà de nom à la séance. */
export function formatWorkoutCategory(workout, state) {
  const type = WORKOUT_TYPE_LABELS[workout.type];
  return [type === workout.title ? "" : type, WORKOUT_STATE_LABELS[state]]
    .filter(Boolean)
    .join(" · ")
    .toLocaleUpperCase("fr-FR");
}

/**
 * Case ronde pour marquer la séance réalisée d’un toucher.
 * @param {Object} workout
 * @param {{ onSetCompleted: (completed: boolean) => Promise<void>, onError: (message: string, error: unknown) => void }} handlers
 */
export function createCompletedCheck(workout, { onSetCompleted, onError }) {
  const checkbox = el("input", { attrs: { type: "checkbox" } });
  checkbox.checked = workout.status === "completed";
  checkbox.setAttribute(
    "aria-label",
    `${checkbox.checked ? "Remettre à faire" : "Marquer comme réalisée"} : ${workout.title}`
  );
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      await onSetCompleted(checkbox.checked);
    } catch (error) {
      checkbox.checked = workout.status === "completed";
      checkbox.disabled = false;
      onError("La mise à jour a échoué. Réessaie.", error);
    }
  });
  const mark = el("span", { className: "workout-check-mark" });
  mark.innerHTML = CHECK_ICON;
  return el("label", { className: "workout-check" }, [checkbox, mark]);
}
