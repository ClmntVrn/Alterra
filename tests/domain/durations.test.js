import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DURATION_MINUTES,
  durationFromParts,
  formatDuration,
  splitDuration
} from "../../src/domain/durations.js";

test("durationFromParts additionne les heures et les minutes", () => {
  const cases = [
    ["1", "", 60],
    ["1", "30", 90],
    ["", "45", 45],
    ["0", "90", 90],
    [" 10 ", "20", 620],
    ["30", "0", 1800]
  ];
  for (const [hours, minutes, total] of cases) {
    assert.equal(durationFromParts(hours, minutes), total, `${hours} h ${minutes}`);
  }
});

test("durationFromParts rend null pour deux cases vides", () => {
  assert.equal(durationFromParts("", ""), null);
  assert.equal(durationFromParts("  ", undefined), null);
});

test("durationFromParts refuse les durées invalides", () => {
  for (const [hours, minutes] of [
    ["0", "0"],
    ["1,5", ""],
    ["-1", ""],
    ["abc", "10"]
  ]) {
    assert.ok(Number.isNaN(durationFromParts(hours, minutes)), `${hours} h ${minutes}`);
  }
});

test("durationFromParts plafonne à 9 999 h 59", () => {
  assert.equal(durationFromParts("9999", "59"), MAX_DURATION_MINUTES);
  assert.ok(Number.isNaN(durationFromParts("9999", "60")));
});

test("splitDuration sépare heures et minutes", () => {
  assert.deepEqual(splitDuration(45), { hours: 0, minutes: 45 });
  assert.deepEqual(splitDuration(620), { hours: 10, minutes: 20 });
});

test("formatDuration affiche une durée lisible", () => {
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(90), "1 h 30");
  assert.equal(formatDuration(90, { minuteUnit: true }), "1 h 30 min");
  assert.equal(formatDuration(0), "0 min");
});
