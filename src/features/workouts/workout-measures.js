// Champs communs à une séance et au résultat d’une course : distance, durée, D+, ressenti, FC,
// météo et notes. Mêmes noms de champs, mêmes règles de saisie, mêmes noms d’enregistrement.

import { durationFromParts, formatDuration, splitDuration } from "../../domain/durations.js";
import { parseDecimal } from "../../domain/numbers.js";
import { formatRate } from "./workout-parts.js";

/** Champs propres à une sortie réalisée. */
export const COMPLETED_FIELDS = Object.freeze([
  "perceivedEffort",
  "heartRateAvg",
  "heartRateMax",
  "weather"
]);

/** @returns {number|null} Minutes saisies dans les cases h et min, null si vides, NaN si invalides. */
export function readDuration(source) {
  const read = name =>
    source instanceof FormData ? source.get(name) : source.namedItem(name).value;
  return durationFromParts(read("durationHours"), read("durationMins"));
}

/**
 * Vérifie la durée, la distance et la FC, avec un message pour chaque saisie invalide.
 * @param {HTMLFormControlsCollection} fields
 * @returns {{ distanceKm: number, durationMinutes: number | null, parts: string[] }} Valeurs lues
 *   et éléments du résumé calculé (durée, allure).
 */
export function checkMeasures(fields) {
  const hoursField = fields.namedItem("durationHours");
  const durationMinutes = readDuration(fields);
  hoursField.setCustomValidity(
    Number.isNaN(durationMinutes)
      ? "Saisis une durée en heures et minutes, par exemple 1 h 30."
      : durationMinutes === null && "required" in hoursField.dataset
        ? "Saisis la durée."
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
  const rate = formatRate(fields.namedItem("type").value, distanceKm, durationMinutes);
  if (rate) parts.push(`${rate.label} ${rate.value}`);
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
  fillDuration(fields, record.durationMinutes);
  if (!Number.isFinite(record.perceivedEffort)) return "";
  fields.namedItem("perceivedEffort").value = String(record.perceivedEffort);
  return String(record.perceivedEffort);
}

/** Remplit les cases h et min ; une durée absente les laisse vides. */
function fillDuration(fields, durationMinutes) {
  const hasDuration = Number.isFinite(durationMinutes) && durationMinutes > 0;
  const { hours, minutes } = hasDuration ? splitDuration(durationMinutes) : {};
  fields.namedItem("durationHours").value = hasDuration && hours ? String(hours) : "";
  fields.namedItem("durationMins").value = hasDuration ? String(minutes) : "";
}

/**
 * Écrit dans `record` les valeurs saisies et retire celles laissées vides.
 * @param {Object} record Modifié sur place.
 * @param {FormData} formData
 * @param {{ completed: boolean }} options Sans réalisation, ressenti, FC et météo sont retirés.
 */
export function readMeasures(record, formData, { completed }) {
  const durationMinutes = readDuration(formData);
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
 * Comportements de saisie : minutes au-delà de 59 reportées en heures en quittant la case, ressenti retiré en
 * touchant à nouveau la note choisie.
 * @param {HTMLFormControlsCollection} fields
 * @param {{ getEffort: () => string, setEffort: (value: string) => void, onChange: () => void }}
 *   effort Ressenti choisi, tenu par le formulaire ; `onChange` met à jour le résumé.
 */
export function bindMeasureInputs(fields, { getEffort, setEffort, onChange }) {
  for (const name of ["durationHours", "durationMins"]) {
    fields.namedItem(name).addEventListener("blur", () => {
      const durationMinutes = readDuration(fields);
      if (durationMinutes > 59 && Number(fields.namedItem("durationMins").value) > 59) {
        fillDuration(fields, durationMinutes);
      }
      onChange();
    });
  }
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
