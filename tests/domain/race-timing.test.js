import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimatePassage,
  formatClock,
  formatElapsed,
  parseClockMinutes
} from "../../src/domain/race-timing.js";

const checkpoints = [
  { id: "a", km: 10, elapsed: ["1:00", "1:20"], clocks: ["23:00", "23:20"] },
  { id: "sans-temps", km: 15 },
  { id: "finish", km: 30, elapsed: ["3:00", "4:00"], clocks: ["01:00", "02:00"] }
];

test("parseClockMinutes, formatElapsed et formatClock", () => {
  assert.deepEqual(["2:40", "12:05", " 0:30 ", "2h40", "1:75", ""].map(parseClockMinutes), [
    160,
    725,
    30,
    null,
    null,
    null
  ]);
  assert.equal(formatElapsed(78), "1h18");
  assert.equal(formatElapsed(59.6), "1h00");
  assert.deepEqual(
    [formatClock(1438), formatClock(1450), formatClock(-10)],
    ["23:58", "00:10", "23:50"]
  );
});

test("estimatePassage interpole entre le départ et les ravitos du scénario", () => {
  assert.deepEqual(estimatePassage(checkpoints, 0, 5), { elapsedMinutes: 30, clock: "22:30" });
  assert.deepEqual(estimatePassage(checkpoints, 0, 20), { elapsedMinutes: 120, clock: "00:00" });
  assert.deepEqual(estimatePassage(checkpoints, 1, 20), { elapsedMinutes: 160, clock: "00:40" });
  assert.deepEqual(estimatePassage(checkpoints, 0, 0), { elapsedMinutes: 0, clock: "22:00" });
  assert.deepEqual(
    estimatePassage(checkpoints, 0, 30.5),
    { elapsedMinutes: 180, clock: "01:00" },
    "trace un peu plus longue que la fiche"
  );
  assert.equal(estimatePassage(checkpoints, 0, 32), null);
  assert.equal(estimatePassage(checkpoints, 2, 5), null, "scénario sans temps");
  assert.equal(estimatePassage([], 0, 5), null);
});
