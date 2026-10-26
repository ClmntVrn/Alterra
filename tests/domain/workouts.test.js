import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWorkoutEnd, formatPace, getWorkoutState } from "../../src/domain/workouts.js";

test("computeWorkoutEnd reste sur la journée pour une séance courte", () => {
  assert.deepEqual(computeWorkoutEnd("2026-10-26", "09:30", 620), {
    endDate: "2026-10-26",
    endTime: "19:50"
  });
});

test("computeWorkoutEnd passe sur les jours suivants après minuit", () => {
  assert.deepEqual(computeWorkoutEnd("2026-10-26", "22:00", 1800), {
    endDate: "2026-10-28",
    endTime: "04:00"
  });
  assert.deepEqual(computeWorkoutEnd("2026-12-31", "23:00", 120), {
    endDate: "2027-01-01",
    endTime: "01:00"
  });
});

test("computeWorkoutEnd garde la veille pour une fin pile à minuit", () => {
  assert.deepEqual(computeWorkoutEnd("2026-10-26", "22:00", 120), {
    endDate: "2026-10-26",
    endTime: "00:00"
  });
});

test("computeWorkoutEnd part de minuit sans heure de début", () => {
  assert.deepEqual(computeWorkoutEnd("2026-10-26", "", 1440), {
    endDate: "2026-10-26",
    endTime: null
  });
  assert.deepEqual(computeWorkoutEnd("2026-10-26", "", 1441), {
    endDate: "2026-10-27",
    endTime: null
  });
});

test("computeWorkoutEnd sans durée valide garde la date de début", () => {
  for (const duration of [null, NaN, 0, -5]) {
    assert.deepEqual(computeWorkoutEnd("2026-10-26", "09:00", duration), {
      endDate: "2026-10-26",
      endTime: null
    });
  }
});

test("getWorkoutState distingue prévu, réalisé et à vérifier", () => {
  const today = "2026-10-26";
  assert.equal(getWorkoutState({ status: "completed", date: "2026-10-01" }, today), "completed");
  assert.equal(getWorkoutState({ status: "planned", date: "2026-10-26" }, today), "planned");
  assert.equal(getWorkoutState({ status: "planned", date: "2026-10-25" }, today), "toCheck");
  assert.equal(
    getWorkoutState({ status: "planned", date: "2026-10-25", endDate: "2026-10-26" }, today),
    "planned"
  );
});

test("formatPace calcule l’allure en min/km", () => {
  assert.equal(formatPace(21.1, 90), "4:16 min/km");
  assert.equal(formatPace(10, 50), "5:00 min/km");
  assert.equal(formatPace(80, 1800), "22:30 min/km");
});

test("formatPace est vide sans distance ou durée valide", () => {
  assert.equal(formatPace(0, 50), "");
  assert.equal(formatPace(10, null), "");
  assert.equal(formatPace(NaN, 50), "");
});
