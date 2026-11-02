// Champs communs à une séance et au résultat d’une course : distance, durée, D+, ressenti, FC,
// météo et notes. Mêmes noms de champs, mêmes règles de saisie, mêmes noms d’enregistrement.

import { formatDuration, formatDurationClock, parseDuration } from "../../domain/durations.js";
import { parseDecimal } from "../../domain/numbers.js";
import { formatPace } from "../../domain/workouts.js";

/** Champs propres à une sortie réalisée. */
export const COMPLETED_FIELDS = Object.freeze([
  "perceivedEffort",
  "heartRateAvg",
  "heartRateMax",
  "weather"
]);

/**
 * Vérifie la durée, la distance et la FC, avec un message pour chaque saisie invalide.
 * @param {HTMLFormControlsCollection} fields
 * @returns {{ distanceKm: number, durationMinutes: number | null, parts: string[] }} Valeurs lues
 *   et éléments du résumé calculé (durée, allure).
 */
export function checkMeasures(fields) {
  const durationField = fields.namedItem("duration");
  const durationMinutes = parseDuration(durationField.value);
  durationField.setCustomValidity(
    Number.isNaN(durationMinutes)
      ? "Saisis une durée comme 45 (minutes), 130 (1:30) ou 1020 (10:20)."
      : ""
  );

  const heartRateAvgField = fields.namedItem("heartRateAvg");
  const heartRateMaxField = fields.namedItem("heartRateMax");
  heartRateMaxField.setCustomValidity(
    heartRateAvgField.value &&
      heartRateMaxField.value &&
      Number(heartRateMaxField.value) < Number(heartRateAvgField.value)
      ? "La FC max doit être supérieure ou égale à la FC moyenne."
      : ""
  );

  const distanceField = fields.namedItem("distanceKm");
  const distanceValue = distanceField.value.trim();
  const distanceKm = parseDecimal(distanceValue);
  const isInRange =
    !distanceValue ||
    (Number.isFinite(distanceKm) &&
      distanceKm >= 0.1 &&
      distanceKm <= 1000 &&
      /^\d+(?:[,.]\d{1,2})?$/.test(distanceValue));
  distanceField.setCustomValidity(
    isInRange ? "" : "Saisis une distance entre 0,1 et 1 000 km, avec au maximum deux décimales."
  );

  const parts = [];
  if (durationMinutes) parts.push(formatDuration(durationMinutes));
  const pace = formatPace(distanceKm, durationMinutes);
  if (pace) parts.push(`Allure ${pace}`);
  return { distanceKm, durationMinutes, parts };
}

/**
 * Remplit les champs depuis un enregistrement ; renvoie le ressenti choisi, sous forme de texte.
 * @param {HTMLFormControlsCollection} fields
 * @param {Object} record Séance ou résultat de course.
 */
export function fillMeasures(fields, record) {
  for (const field of ["ascentMeters", "heartRateAvg", "heartRateMax", "weather", "notes"]) {
    fields.namedItem(field).value = record[field] ?? "";
  }
  fields.namedItem("distanceKm").value = Number.isFinite(record.distanceKm)
    ? String(record.distanceKm).replace(".", ",")
    : "";
  fields.namedItem("duration").value =
    Number.isFinite(record.durationMinutes) && record.durationMinutes > 0
      ? formatDurationClock(record.durationMinutes)
      : "";
  if (!Number.isFinite(record.perceivedEffort)) return "";
  fields.namedItem("perceivedEffort").value = String(record.perceivedEffort);
  return String(record.perceivedEffort);
}

/**
 * Écrit dans `record` les valeurs saisies et retire celles laissées vides.
 * @param {Object} record Modifié sur place.
 * @param {FormData} formData
 * @param {{ completed: boolean }} options Sans réalisation, ressenti, FC et météo sont retirés.
 */
export function readMeasures(record, formData, { completed }) {
  const durationMinutes = parseDuration(formData.get("duration"));
  if (durationMinutes) record.durationMinutes = durationMinutes;
  else delete record.durationMinutes;
  const distanceValue = String(formData.get("distanceKm")).trim();
  if (distanceValue) record.distanceKm = parseDecimal(distanceValue);
  else delete record.distanceKm;
  const ascentValue = String(formData.get("ascentMeters")).trim();
  if (ascentValue) record.ascentMeters = Number(ascentValue);
  else delete record.ascentMeters;
  for (const field of ["perceivedEffort", "heartRateAvg", "heartRateMax"]) {
    const value = completed ? String(formData.get(field) ?? "").trim() : "";
    if (value) record[field] = Number(value);
    else delete record[field];
  }
  const weather = completed ? String(formData.get("weather")) : "";
  if (weather) record.weather = weather;
  else delete record.weather;
  const notes = String(formData.get("notes")).trim();
  if (notes) record.notes = notes;
  else delete record.notes;
  return record;
}

/**
 * Comportements de saisie : durée remise en h:mm en quittant le champ, ressenti retiré en
 * touchant à nouveau la note choisie.
 * @param {HTMLFormControlsCollection} fields
 * @param {{ getEffort: () => string, setEffort: (value: string) => void, onChange: () => void }}
 *   effort Ressenti choisi, tenu par le formulaire ; `onChange` met à jour le résumé.
 */
export function bindMeasureInputs(fields, { getEffort, setEffort, onChange }) {
  const durationField = fields.namedItem("duration");
  durationField.addEventListener("blur", () => {
    const durationMinutes = parseDuration(durationField.value);
    if (durationMinutes) durationField.value = formatDurationClock(durationMinutes);
    onChange();
  });
  for (const radio of fields.namedItem("perceivedEffort")) {
    radio.addEventListener("click", () => {
      if (radio.value === getEffort()) {
        radio.checked = false;
        setEffort("");
      } else {
        setEffort(radio.value);
      }
    });
  }
}
