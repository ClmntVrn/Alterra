// Durées exprimées en minutes.

export const MAX_DURATION_MINUTES = 9999 * 60 + 59;

/**
 * Durée saisie rapidement : 45 (minutes), 90 ou 90min (1:30), 130, 1h30 ou 1:30 (1 h 30),
 * 1020 (10 h 20).
 * @returns {number|null} Minutes, null si vide, NaN si invalide.
 */
export function parseDuration(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!text) return null;
  let hours = 0;
  let minutes;
  let match;
  if ((match = /^(\d{1,4})[:h](\d{1,2})?$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2] || 0);
    if (minutes > 59) return NaN;
  } else if ((match = /^(\d{1,4})(?:min|mn|m)$/.exec(text))) {
    minutes = Number(match[1]);
  } else if (/^\d{1,6}$/.test(text)) {
    if (text.length <= 2) {
      minutes = Number(text);
    } else {
      hours = Number(text.slice(0, -2));
      minutes = Number(text.slice(-2));
      if (minutes > 59) return NaN;
    }
  } else {
    return NaN;
  }
  const total = hours * 60 + minutes;
  return total > 0 && total <= MAX_DURATION_MINUTES ? total : NaN;
}

/** @returns {string} Format de saisie h:mm, par exemple 1:05. */
export function formatDurationClock(durationMinutes) {
  const totalMinutes = Math.round(durationMinutes);
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/**
 * @param {number} durationMinutes
 * @param {{ minuteUnit?: boolean }} [options] minuteUnit : « 1 h 30 min » au lieu de « 1 h 30 ».
 */
export function formatDuration(durationMinutes, { minuteUnit = false } = {}) {
  const totalMinutes = Math.round(durationMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes}${minuteUnit ? " min" : ""}`;
}
