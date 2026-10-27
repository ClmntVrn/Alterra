import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLOT,
  buildElevationProfile,
  computeElevationStep,
  computeProgress,
  measureClimb,
  measureTrack
} from "../../src/domain/elevation-profile.js";

// Trace fictive plein nord : 0,1° de latitude ≈ 11,12 km entre chaque point.
const track = [1000, 1450, 1200, 1900].map((elevation, index) => ({
  latitude: 45 + index * 0.1,
  longitude: 6,
  elevation
}));

test("measureTrack cumule les distances de la trace", () => {
  const { points, distanceKm } = measureTrack(track);
  assert.equal(points[0].distanceKm, 0);
  assert.ok(Math.abs(points[1].distanceKm - 11.12) < 0.01);
  assert.ok(Math.abs(distanceKm - 33.36) < 0.01);
});

test("measureTrack refuse une trace trop courte ou immobile", () => {
  assert.throws(() => measureTrack(track.slice(0, 1)), /pas assez de points/);
  assert.throws(() => measureTrack([track[0], track[0]]), /distance de la trace/);
});

test("buildElevationProfile arrondit les altitudes et place les repères", () => {
  const profile = buildElevationProfile(track, [
    { id: "col", km: 11.12 },
    { id: "sans-km" },
    { id: "loin", km: 500 }
  ]);
  assert.equal(profile.minElevation, 1000);
  assert.equal(profile.maxElevation, 2000);
  assert.deepEqual(
    profile.markers.map(marker => marker.id),
    ["start", "col", "loin", "finish"]
  );
  const [start, col, loin, finish] = profile.markers;
  assert.deepEqual([start.x, start.y], [PLOT.left, PLOT.bottom]);
  assert.ok(Math.abs(col.elevation - 1450) < 1);
  assert.equal(loin.km, profile.distanceKm, "un repère au-delà de la trace est ramené à l’arrivée");
  assert.equal(finish.x, PLOT.right);
  assert.equal(profile.samples.length, 4);
});

test("buildElevationProfile réutilise le repère d’arrivée de la fiche", () => {
  const profile = buildElevationProfile(track, [{ id: "finish", km: 30 }]);
  const finish = profile.markers.filter(marker => marker.id === "finish");
  assert.equal(finish.length, 1);
  assert.equal(finish[0].km, profile.distanceKm);
});

test("computeElevationStep choisit un pas rond", () => {
  assert.equal(computeElevationStep(1000), 250);
  assert.equal(computeElevationStep(800), 200);
  assert.equal(computeElevationStep(1400), 500);
  assert.equal(computeElevationStep(3000), 1000);
});

test("computeProgress s’arrête au premier ravito non coché", () => {
  const profile = buildElevationProfile(track, [
    { id: "a", km: 10 },
    { id: "b", km: 20 },
    { id: "finish", km: 33 }
  ]);
  const ids = new Set(["a", "b", "finish"]);
  const atStart = computeProgress(profile, ids, () => false);
  assert.equal(atStart.marker.id, "start");
  assert.equal(atStart.points.length, 1);

  const checked = new Set(["a", "finish"]);
  const progress = computeProgress(profile, ids, id => checked.has(id));
  assert.equal(progress.marker.id, "a");
  assert.ok(Math.abs(progress.remainingKm - (profile.distanceKm - 10)) < 1e-9);
  assert.equal(progress.points.at(-1)[0], progress.marker.x, "le tracé s’arrête sur le ravito");
});

test("measureClimb cumule montées et descentes entre deux distances", () => {
  const { points } = measureTrack(track);
  assert.deepEqual(measureClimb(points, 0, 33.36), { ascentMeters: 1150, descentMeters: 250 });
  assert.deepEqual(measureClimb(points, 0, 11.12), { ascentMeters: 450, descentMeters: 0 });
  // À mi-chemin du deuxième segment : 1 450 → 1 325 m.
  assert.deepEqual(measureClimb(points, 11.12, 16.68), { ascentMeters: 0, descentMeters: 125 });
});

test("measureClimb ignore les petites variations d’altitude du GPS", () => {
  const noisy = [1000, 1003, 999, 1002, 1010].map((elevation, index) => ({
    elevation,
    distanceKm: index
  }));
  assert.deepEqual(measureClimb(noisy, 0, 4), { ascentMeters: 10, descentMeters: 0 });
});
