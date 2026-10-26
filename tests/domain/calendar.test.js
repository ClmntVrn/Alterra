import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareEventTimes,
  groupMonthEventsByDate,
  listEventsOnDate
} from "../../src/domain/calendar.js";

const sources = ({ races = [], personalRaces = [], workouts = [] } = {}) => ({
  races,
  personalRaces,
  workouts
});

test("listEventsOnDate réunit les trois sources et les trie par heure", () => {
  const events = listEventsOnDate(
    sources({
      races: [{ id: "r", name: "Ultra", date: "2026-10-26", startTime: "06:00" }],
      personalRaces: [{ id: "p", name: "10 km", date: "2026-10-26" }],
      workouts: [{ id: "w", date: "2026-10-26", time: "18:30" }]
    }),
    "2026-10-26"
  );
  assert.deepEqual(
    events.map(event => [event.id, event.eventType]),
    [
      ["r", "race"],
      ["w", "workout"],
      ["p", "personalRace"]
    ]
  );
});

test("listEventsOnDate inclut chaque jour d’une période, bornes comprises", () => {
  const data = sources({
    personalRaces: [{ name: "Raid", date: "2026-10-30", endDate: "2026-11-01" }]
  });
  assert.equal(listEventsOnDate(data, "2026-10-29").length, 0);
  assert.equal(listEventsOnDate(data, "2026-10-30").length, 1);
  assert.equal(listEventsOnDate(data, "2026-11-01").length, 1);
  assert.equal(listEventsOnDate(data, "2026-11-02").length, 0);
});

test("listEventsOnDate ignore une course personnelle sans nom ou à la date invalide", () => {
  const data = sources({
    personalRaces: [{ date: "2026-10-26" }, { name: "Course", date: "2026-02-30" }]
  });
  assert.deepEqual(listEventsOnDate(data, "2026-10-26"), []);
});

test("groupMonthEventsByDate découpe une période qui déborde du mois", () => {
  const events = groupMonthEventsByDate(
    sources({ workouts: [{ id: "w", date: "2026-09-29", endDate: "2026-10-02" }] }),
    new Date(2026, 9, 1)
  );
  assert.deepEqual(Object.keys(events), ["2026-10-01", "2026-10-02"]);
  assert.equal(events["2026-10-01"][0].eventType, "workout");
});

test("groupMonthEventsByDate ignore les événements hors du mois", () => {
  const events = groupMonthEventsByDate(
    sources({ races: [{ date: "2026-11-01" }, { date: "2026-09-30" }] }),
    new Date(2026, 9, 1)
  );
  assert.deepEqual(events, {});
});

test("compareEventTimes place les événements sans heure à la fin", () => {
  const sorted = [{ time: "" }, { time: "07:00" }, {}, { time: "05:30" }].sort(compareEventTimes);
  assert.deepEqual(
    sorted.map(event => event.time),
    ["05:30", "07:00", "", undefined]
  );
});
