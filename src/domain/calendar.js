// Événements du calendrier : courses du catalogue, courses personnelles et séances.

import { isDateKeyInRange, parseDateKey, toDateKey } from "./dates.js";

/**
 * @typedef {Object} CalendarSources
 * @property {Array<Object>} races Fiches du catalogue.
 * @property {Array<Object>} personalRaces Courses ajoutées depuis le calendrier.
 * @property {Array<Object>} workouts Séances prévues ou réalisées.
 */

/** Trie par heure de départ ; les événements sans heure passent après. */
export function compareEventTimes(left, right) {
  const leftTime = left.eventType === "race" ? left.startTime : left.time;
  const rightTime = right.eventType === "race" ? right.startTime : right.time;
  const validLeftTime = typeof leftTime === "string" && leftTime ? leftTime : null;
  const validRightTime = typeof rightTime === "string" && rightTime ? rightTime : null;
  if (!validLeftTime) return validRightTime ? 1 : 0;
  if (!validRightTime) return -1;
  return validLeftTime.localeCompare(validRightTime);
}

/**
 * @param {CalendarSources} sources
 * @param {string} dateKey
 */
export function listEventsOnDate({ races, personalRaces, workouts }, dateKey) {
  return [
    ...races
      .filter(race => isDateKeyInRange(dateKey, race.date, race.endDate))
      .map(race => ({ ...race, eventType: "race" })),
    ...personalRaces
      .filter(
        race =>
          typeof race.name === "string" &&
          parseDateKey(race.date) &&
          isDateKeyInRange(dateKey, race.date, race.endDate)
      )
      .map(race => ({ ...race, eventType: "personalRace" })),
    ...workouts
      .filter(workout => isDateKeyInRange(dateKey, workout.date, workout.endDate))
      .map(workout => ({ ...workout, eventType: "workout" }))
  ].sort(compareEventTimes);
}

/**
 * Regroupe par clé de date les événements du mois ; un événement sur plusieurs jours
 * apparaît sur chacun d’eux.
 * @param {CalendarSources} sources
 * @param {Date} month Premier jour du mois.
 * @returns {Record<string, Array<Object>>}
 */
export function groupMonthEventsByDate({ races, personalRaces, workouts }, month) {
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthStart = toDateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = toDateKey(new Date(month.getFullYear(), month.getMonth(), daysInMonth));
  const events = {};
  const allEvents = [
    ...races.map(race => ({ ...race, eventType: "race" })),
    ...personalRaces.map(race => ({ ...race, eventType: "personalRace" })),
    ...workouts.map(workout => ({ ...workout, eventType: "workout" }))
  ];
  for (const event of allEvents) {
    const startDate = event.date;
    const endDate = event.endDate || startDate;
    if (endDate < monthStart || startDate > monthEnd) continue;
    const start = parseDateKey(startDate < monthStart ? monthStart : startDate);
    const end = parseDateKey(endDate > monthEnd ? monthEnd : endDate);
    if (!start || !end) continue;
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      (events[toDateKey(day)] ||= []).push(event);
    }
  }
  for (const dayEvents of Object.values(events)) dayEvents.sort(compareEventTimes);
  return events;
}
