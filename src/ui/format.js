// Formats d’affichage en français, partagés par toutes les pages.

import { parseDateKey } from "../domain/dates.js";

const LOCALE = "fr-FR";

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric"
});
const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long" });
const shortDayMonthFormatter = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const weekdayDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short"
});
const monthYearFormatter = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const relativeDayFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

/** 26 octobre 2026 */
export const formatLongDate = date => longDateFormatter.format(date);
/** 26 oct. */
export const formatShortDayMonth = date => shortDayMonthFormatter.format(date);
/** lun. 26 oct. */
export const formatWeekdayDate = date => weekdayDateFormatter.format(date);
/** octobre 2026 */
export const formatMonthYear = date => monthYearFormatter.format(date);
/** 1 234,5 (une décimale au plus) */
export const formatNumber = value => numberFormatter.format(value);
/** aujourd’hui, hier, il y a 3 jours */
export const formatDaysAgo = days => relativeDayFormatter.format(-days, "day");

/**
 * Période entre deux clés AAAA-MM-JJ : « 26 octobre 2026 », « 26 octobre – 28 octobre 2026 »
 * ou « 30 décembre 2026 – 2 janvier 2027 » ; l’année n’est répétée que si elle change.
 * @returns {string} "" si la date de début est invalide.
 */
export function formatDateRange(startKey, endKey) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey || startKey);
  if (!start || !end || startKey === (endKey || startKey)) {
    return start ? formatLongDate(start) : "";
  }
  const startText =
    start.getFullYear() === end.getFullYear()
      ? dayMonthFormatter.format(start)
      : formatLongDate(start);
  return `${startText} – ${formatLongDate(end)}`;
}

/** Première lettre en majuscule, selon les règles du français. */
export function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);
}
