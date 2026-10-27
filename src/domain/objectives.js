// Objectifs : courses du catalogue et courses personnelles, à venir ou passées.

import { compareEventTimes } from "./calendar.js";
import { daysBetween, parseDateKey } from "./dates.js";

const compareDates = (left, right) =>
  left.date.localeCompare(right.date) || compareEventTimes(left, right);

/**
 * Une course reste à venir jusqu’à son dernier jour inclus.
 * @param {{ races: Array<Object>, personalRaces: Array<Object> }} sources
 * @param {string} todayKey Date du jour, AAAA-MM-JJ.
 * @returns {{ upcoming: Array<Object>, past: Array<Object> }} À venir de la plus proche à la plus
 *   lointaine, passées de la plus récente à la plus ancienne. Chaque course porte `eventType` et
 *   `daysLeft`, le nombre de jours avant son départ (négatif une fois partie).
 */
export function listObjectives({ races, personalRaces }, todayKey) {
  const today = parseDateKey(todayKey);
  const objectives = [
    ...races.map(race => ({ ...race, eventType: "race" })),
    ...personalRaces
      .filter(race => typeof race.name === "string")
      .map(race => ({ ...race, eventType: "personalRace" }))
  ]
    .filter(race => parseDateKey(race.date))
    .map(race => ({ ...race, daysLeft: daysBetween(today, parseDateKey(race.date)) }));
  const isUpcoming = race => (race.endDate || race.date) >= todayKey;
  return {
    upcoming: objectives.filter(isUpcoming).sort(compareDates),
    past: objectives.filter(race => !isUpcoming(race)).sort((a, b) => compareDates(b, a))
  };
}
