// Dates locales de l’appareil. Une « clé de date » est une chaîne AAAA-MM-JJ.

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86400000;

/**
 * @param {Date} date
 * @returns {string} Clé AAAA-MM-JJ dans le fuseau local.
 */
export function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

/**
 * @param {unknown} value
 * @returns {Date|null} Minuit local du jour, ou null si la clé est invalide (ex. 2026-02-30).
 */
export function parseDateKey(value) {
  if (typeof value !== "string") return null;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** @param {unknown} value */
export function isDateKey(value) {
  return parseDateKey(value) !== null;
}

/** Bornes incluses ; les clés AAAA-MM-JJ se comparent dans l’ordre lexicographique. */
export function isDateKeyInRange(key, startKey, endKey = startKey) {
  return key >= startKey && key <= endKey;
}

/** @returns {Date} Nouvelle date décalée de `days` jours calendaires. */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** @returns {Date} Lundi à minuit de la semaine de `date`. */
export function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  return addDays(start, -daysSinceMonday);
}

/** Nombre de jours calendaires de `start` à `end`, insensible aux changements d’heure. */
export function daysBetween(start, end) {
  return Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      MS_PER_DAY
  );
}

/**
 * Heure saisie rapidement : 9, 930, 9h30 et 09:30 donnent 09:30.
 * @returns {string|null} "" si vide, "HH:mm" si valide, null sinon.
 */
export function parseTimeOfDay(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!text) return "";
  const match = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(text) || /^(\d{1,2})(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return formatTimeOfDay(hours * 60 + minutes);
}

/** @param {number} minutesSinceMidnight */
export function formatTimeOfDay(minutesSinceMidnight) {
  const hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
