// Durées exprimées en minutes.

export const MAX_DURATION_MINUTES = 9999 * 60 + 59;

/**
 * Durée saisie en deux cases, heures et minutes : une case vide compte pour 0 et les minutes
 * peuvent dépasser 59 (90 min = 1 h 30).
 * @returns {number|null} Minutes, null si les deux cases sont vides, NaN si invalide.
 */
export function durationFromParts(hours, minutes) {
  const hoursText = String(hours ?? "").trim();
  const minutesText = String(minutes ?? "").trim();
  if (!hoursText && !minutesText) return null;
  if (![hoursText, minutesText].every(text => /^\d{0,4}$/.test(text))) return NaN;
  const total = Number(hoursText || 0) * 60 + Number(minutesText || 0);
  return total > 0 && total <= MAX_DURATION_MINUTES ? total : NaN;
}

/** @returns {{ hours: number, minutes: number }} 95 → 1 h et 35 min. */
export function splitDuration(durationMinutes) {
  const totalMinutes = Math.round(durationMinutes);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * @param {number} durationMinutes
 * @param {{ minuteUnit?: boolean }} [options] minuteUnit : « 1 h 30 min » au lieu de « 1 h 30 ».
 */
export function formatDuration(durationMinutes, { minuteUnit = false } = {}) {
  const { hours, minutes } = splitDuration(durationMinutes);
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes}${minuteUnit ? " min" : ""}`;
}
