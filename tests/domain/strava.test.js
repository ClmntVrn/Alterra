import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyActivity,
  applyActivityToRace,
  convertActivity,
  findMatchingWorkout,
  findWorkoutToRemove,
  importedWorkoutId
} from "../../src/domain/strava.js";

const NOW = "2026-11-17T18:00:00.000Z";

/** Résumé d’activité tel que le renvoie l’API Strava (données fictives). */
function activity(overrides = {}) {
  return {
    id: 1001,
    name: "Sortie du matin",
    sport_type: "TrailRun",
    type: "Run",
    start_date: "2026-11-17T07:05:00Z",
    start_date_local: "2026-11-17T08:05:00Z",
    distance: 15234.6,
    total_elevation_gain: 812.4,
    moving_time: 6000,
    elapsed_time: 6610,
    average_heartrate: 148.6,
    max_heartrate: 171,
    ...overrides
  };
}

function workout(id, overrides = {}) {
  return {
    id,
    date: "2026-11-17",
    type: "trail",
    title: "Sortie longue",
    status: "planned",
    createdAt: "2026-11-10T08:00:00.000Z",
    ...overrides
  };
}

test("convertActivity lit l’heure locale, le temps total et arrondit les chiffres", () => {
  assert.deepEqual(convertActivity(activity()), {
    type: "trail",
    date: "2026-11-17",
    time: "08:05",
    stravaActivityId: "1001",
    title: "Sortie du matin",
    distanceKm: 15.23,
    ascentMeters: 812,
    durationMinutes: 110,
    heartRateAvg: 149,
    heartRateMax: 171
  });
});

test("convertActivity range chaque sport Strava dans son type et ignore les autres", () => {
  const typeOf = sportType => convertActivity(activity({ sport_type: sportType }))?.type ?? null;
  assert.equal(typeOf("Run"), "running");
  assert.equal(typeOf("GravelRide"), "cycling");
  assert.equal(typeOf("WeightTraining"), "strength");
  assert.equal(typeOf("Walk"), "hiking");
  assert.equal(typeOf("BackcountrySki"), "skiTouring");
  assert.equal(typeOf("Swim"), null);
  assert.equal(typeOf("AlpineSki"), null);
  // Ancienne activité sans `sport_type` : le champ `type` suffit.
  assert.equal(convertActivity(activity({ sport_type: undefined, type: "Hike" })).type, "hiking");
});

test("convertActivity omet les chiffres absents ou nuls et refuse une date illisible", () => {
  const fields = convertActivity(
    activity({
      sport_type: "WeightTraining",
      distance: 0,
      total_elevation_gain: 0,
      average_heartrate: undefined,
      max_heartrate: undefined,
      elapsed_time: 20
    })
  );
  assert.deepEqual(Object.keys(fields).sort(), [
    "date",
    "durationMinutes",
    "stravaActivityId",
    "time",
    "title",
    "type"
  ]);
  assert.equal(fields.durationMinutes, 1);
  assert.equal(convertActivity(activity({ start_date_local: "" })), null);
  assert.equal(convertActivity(activity({ start_date_local: "2026-02-30T08:00:00Z" })), null);
  assert.equal(convertActivity(null), null);
});

test("findMatchingWorkout préfère la séance prévue la plus proche en heure", () => {
  const fields = convertActivity(activity());
  const workouts = [
    workout("sans-heure"),
    workout("soir", { time: "18:00" }),
    workout("matin", { time: "07:30" }),
    workout("autre-type", { type: "running", time: "08:05" }),
    workout("autre-jour", { date: "2026-11-16", time: "08:05" }),
    workout("deja-faite", { status: "completed", time: "08:05" })
  ];
  assert.equal(findMatchingWorkout(workouts, fields).id, "matin");
  assert.equal(findMatchingWorkout(workouts.slice(0, 1), fields).id, "sans-heure");
});

test("findMatchingWorkout reprend une séance saisie à la main, mais pas une déjà reliée", () => {
  const fields = convertActivity(activity());
  const manual = workout("main", { status: "completed" });
  const linked = workout("reliee", { status: "planned", stravaActivityId: "999" });
  assert.equal(findMatchingWorkout([linked, manual], fields).id, "main");
  assert.equal(findMatchingWorkout([linked], fields), null);
  const same = workout("meme", {
    status: "completed",
    stravaActivityId: "1001",
    date: "2026-11-01"
  });
  assert.equal(findMatchingWorkout([manual, same], fields).id, "meme", "lien déjà fait");
});

test("applyActivity marque la séance prévue réalisée avec les chiffres de Strava", () => {
  const planned = workout("prevue", {
    time: "08:00",
    distanceKm: 20,
    ascentMeters: 1000,
    durationMinutes: 150,
    notes: "Allure facile",
    heartRateAvg: 140
  });
  const result = applyActivity([planned], activity({ average_heartrate: undefined }), NOW);
  assert.equal(result.created, false);
  assert.deepEqual(result.workout, {
    ...planned,
    time: "08:05",
    status: "completed",
    completedAt: NOW,
    stravaActivityId: "1001",
    distanceKm: 15.23,
    ascentMeters: 812,
    durationMinutes: 110,
    heartRateAvg: 140,
    heartRateMax: 171
  });
  assert.equal(planned.status, "planned", "la séance d’origine n’est pas modifiée");
});

test("applyActivity retire les chiffres prévus que Strava ne donne pas", () => {
  const planned = workout("renfo", {
    type: "strength",
    distanceKm: 3,
    ascentMeters: 50,
    durationMinutes: 45
  });
  const { workout: saved } = applyActivity(
    [planned],
    activity({ sport_type: "WeightTraining", distance: 0, total_elevation_gain: 0 }),
    NOW
  );
  assert.equal(saved.durationMinutes, 110);
  assert.equal("distanceKm" in saved, false);
  assert.equal("ascentMeters" in saved, false);
});

test("applyActivity crée une séance réalisée, avec une fin le lendemain si besoin", () => {
  const result = applyActivity(
    [],
    activity({ start_date_local: "2026-11-17T22:00:00Z", elapsed_time: 4 * 3600 }),
    NOW
  );
  assert.equal(result.created, true);
  assert.deepEqual(result.workout, {
    id: importedWorkoutId("1001"),
    createdAt: NOW,
    distanceKm: 15.23,
    ascentMeters: 812,
    durationMinutes: 240,
    heartRateAvg: 149,
    heartRateMax: 171,
    title: "Sortie du matin",
    type: "trail",
    date: "2026-11-17",
    time: "22:00",
    status: "completed",
    stravaActivityId: "1001",
    completedAt: NOW,
    endDate: "2026-11-18"
  });
});

test("applyActivity met à jour une activité modifiée sans la dupliquer", () => {
  const first = applyActivity([], activity(), NOW).workout;
  const later = "2026-11-18T09:00:00.000Z";
  const result = applyActivity(
    [first],
    activity({ name: "Trail des crêtes", distance: 16000 }),
    later
  );
  assert.equal(result.created, false);
  assert.equal(result.workout.id, first.id);
  assert.equal(result.workout.distanceKm, 16);
  assert.equal(result.workout.title, "Trail des crêtes", "nom changé sur Strava");
  assert.equal(result.workout.completedAt, NOW);
});

test("applyActivity ignore un sport non importé", () => {
  assert.equal(applyActivity([workout("x")], activity({ sport_type: "Swim" }), NOW), null);
});

test("findWorkoutToRemove ne vise que la séance créée par l’import", () => {
  const created = workout(importedWorkoutId(1001), { stravaActivityId: "1001" });
  const matched = workout("prevue", { stravaActivityId: "1002" });
  assert.equal(findWorkoutToRemove([created, matched], 1001), created);
  assert.equal(findWorkoutToRemove([created, matched], 1002), null);
});

function race(id, overrides = {}) {
  return { id, name: "Trail des Cimes", date: "2026-11-17", createdAt: "2026-09-01", ...overrides };
}

test("applyActivityToRace remplit le résultat de la course du jour en gardant ressenti et notes", () => {
  const races = [
    race("autre-jour", { date: "2026-11-10" }),
    race("cimes", { result: { type: "trail", distanceKm: 40, perceivedEffort: 8, notes: "Dur" } })
  ];
  assert.deepEqual(applyActivityToRace(races, activity()), {
    ...races[1],
    result: {
      type: "trail",
      distanceKm: 15.23,
      ascentMeters: 812,
      durationMinutes: 110,
      heartRateAvg: 149,
      heartRateMax: 171,
      perceivedEffort: 8,
      notes: "Dur",
      stravaActivityId: "1001"
    }
  });
  assert.equal(races[1].result.distanceKm, 40, "la course d’origine n’est pas modifiée");
});

test("applyActivityToRace couvre une course sur plusieurs jours, mais seulement à pied", () => {
  const races = [race("ultra", { date: "2026-11-16", endDate: "2026-11-18" })];
  assert.equal(applyActivityToRace(races, activity({ sport_type: "Run" })).result.type, "running");
  assert.equal(applyActivityToRace(races, activity({ sport_type: "Ride" })), null);
  assert.equal(applyActivityToRace(races, activity({ sport_type: "Hike" })), null);
  assert.equal(applyActivityToRace([race("passee", { date: "2026-11-01" })], activity()), null);
});

test("applyActivityToRace garde l’activité la plus longue du jour de course", () => {
  const warmUp = activity({ id: 1, sport_type: "Run", distance: 2000 });
  const main = activity({ id: 2, distance: 42000 });
  const afterWarmUp = applyActivityToRace([race("cimes")], warmUp);
  const afterMain = applyActivityToRace([afterWarmUp], main);
  assert.equal(afterMain.result.stravaActivityId, "2");
  assert.equal(afterMain.result.distanceKm, 42);
  assert.equal(applyActivityToRace([afterMain], warmUp), null, "l’échauffement devient une séance");
  const renamed = applyActivityToRace([afterMain], activity({ id: 2, distance: 42500 }));
  assert.equal(renamed.result.distanceKm, 42.5, "l’activité déjà reliée est mise à jour");
});
