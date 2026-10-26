import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPersonalPlan, hasRequiredRaceFields } from "../../src/domain/race-plan.js";

const race = {
  id: "fiche",
  name: "Course",
  date: "2026-10-26",
  distanceKm: 42,
  ascentMeters: 2000,
  checkpoints: [
    { id: "ravito-1", name: "Col", km: 12 },
    { id: "finish", name: "Arrivée", km: 42 }
  ]
};

test("applyPersonalPlan sans plan rend la fiche telle quelle", () => {
  assert.equal(applyPersonalPlan(race, null), race);
});

test("applyPersonalPlan complète les ravitos par identifiant et déduit les cibles", () => {
  const result = applyPersonalPlan(race, {
    scenarios: [
      { id: "a", name: "Prudent", duration: "8:00" },
      { id: "b", name: "Objectif", duration: "7:30" }
    ],
    defaultScenario: 1,
    checkpoints: [
      { id: "ravito-1", clocks: ["09:00", "08:45"] },
      { id: "finish", clocks: ["14:00", "13:30"] },
      { id: "inconnu", clocks: ["10:00"] },
      null
    ]
  });
  assert.equal(result.targetTime, "7:30");
  assert.equal(result.targetFinish, "13:30");
  assert.equal(result.defaultScenario, 1);
  assert.deepEqual(result.checkpoints[0], {
    id: "ravito-1",
    name: "Col",
    km: 12,
    clocks: ["09:00", "08:45"]
  });
  assert.equal(result.checkpoints.length, 2);
  assert.equal(result.nutrition, null);
  assert.equal(race.checkpoints[0].clocks, undefined, "la fiche d’origine n’est pas modifiée");
});

test("applyPersonalPlan ramène un scénario par défaut hors limites au premier", () => {
  const plan = { scenarios: [{ duration: "6:00" }], defaultScenario: 3, targetTime: "5:59" };
  const result = applyPersonalPlan(race, plan);
  assert.equal(result.defaultScenario, 0);
  assert.equal(result.targetTime, "5:59");
});

test("hasRequiredRaceFields exige identifiant, nom, date, distance et dénivelé", () => {
  assert.equal(hasRequiredRaceFields(race), true);
  assert.equal(hasRequiredRaceFields({ ...race, distanceKm: "42" }), false);
  assert.equal(hasRequiredRaceFields({ ...race, name: "" }), false);
});
