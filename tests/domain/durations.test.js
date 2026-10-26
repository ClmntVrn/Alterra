import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DURATION_MINUTES,
  formatDuration,
  formatDurationClock,
  parseDuration
} from "../../src/domain/durations.js";

test("parseDuration lit les saisies rapides", () => {
  const cases = {
    45: 45,
    90: 90,
    "90min": 90,
    "90 mn": 90,
    130: 90,
    "1h30": 90,
    "1:30": 90,
    "1h": 60,
    1020: 620,
    3000: 1800
  };
  for (const [input, minutes] of Object.entries(cases)) {
    assert.equal(parseDuration(input), minutes, input);
  }
});

test("parseDuration rend null pour une saisie vide", () => {
  assert.equal(parseDuration(""), null);
  assert.equal(parseDuration("   "), null);
  assert.equal(parseDuration(undefined), null);
});

test("parseDuration refuse les durées invalides", () => {
  for (const value of ["1075", "1:75", "0", "abc", "1,5"]) {
    assert.ok(Number.isNaN(parseDuration(value)), value);
  }
});

test("parseDuration plafonne à 9 999 h 59", () => {
  assert.equal(parseDuration("999959"), MAX_DURATION_MINUTES);
  assert.ok(Number.isNaN(parseDuration("9999:60")));
});

test("formatDurationClock affiche h:mm", () => {
  assert.equal(formatDurationClock(45), "0:45");
  assert.equal(formatDurationClock(620), "10:20");
  assert.equal(formatDurationClock(61), "1:01");
});

test("formatDuration affiche une durée lisible", () => {
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(90), "1 h 30");
  assert.equal(formatDuration(90, { minuteUnit: true }), "1 h 30 min");
  assert.equal(formatDuration(0), "0 min");
});
