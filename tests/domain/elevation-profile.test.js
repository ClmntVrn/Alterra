import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLOT,
  buildElevationProfile,
  computeAxisStep,
  computeProgress,
  computeSections,
  computeSlopeSegments,
  gradeAt,
  measureClimb,
  measureTrack,
  slopeBand
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

test("computeAxisStep choisit un pas rond", () => {
  assert.equal(computeAxisStep(1000), 250);
  assert.equal(computeAxisStep(800), 200);
  assert.equal(computeAxisStep(1400), 500);
  assert.equal(computeAxisStep(3000), 1000);
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

test("buildElevationProfile place la trace dans la zone de tracé demandée", () => {
  const plot = { left: 46, right: 378, top: 30, bottom: 216 };
  const profile = buildElevationProfile(track, [], plot);
  const [start, finish] = profile.markers;
  assert.deepEqual([start.x, start.y, finish.x], [46, 216, 378]);
  assert.equal(profile.plot, plot);
});

test("buildElevationProfile adapte l’échelle d’altitude au relief", () => {
  const flat = [500, 530, 510, 560].map((elevation, index) => ({
    latitude: 45 + index * 0.01,
    longitude: 6,
    elevation
  }));
  const profile = buildElevationProfile(flat);
  assert.equal(profile.elevationStep, 20);
  assert.deepEqual([profile.minElevation, profile.maxElevation], [500, 560]);
});

test("buildElevationProfile zoome sur une partie de la trace", () => {
  const plot = { left: 0, right: 100, top: 0, bottom: 100 };
  const profile = buildElevationProfile(
    track,
    [
      { id: "a", km: 5 },
      { id: "b", km: 15 }
    ],
    plot,
    { fromKm: 10, toKm: 20 }
  );
  assert.deepEqual([profile.fromKm, profile.toKm], [10, 20]);
  assert.equal(profile.samples[0][0], 0);
  assert.equal(profile.samples.at(-1)[0], 100);
  assert.deepEqual(
    profile.markers.map(marker => `${marker.id}:${marker.inView}`),
    ["start:false", "a:false", "b:true", "finish:false"]
  );
  assert.ok(Math.abs(profile.markers[2].x - 50) < 1e-9);
  // Entre 10 et 20 km, l’altitude va d’environ 1 405 à 1 270 m (pic à 1 450 m au km 11,12).
  assert.deepEqual([profile.minElevation, profile.maxElevation], [1250, 1450]);

  const ids = new Set(["a", "b"]);
  assert.deepEqual(computeProgress(profile, ids, () => false).points, [], "départ hors zoom");
  const atA = computeProgress(profile, ids, id => id === "a");
  assert.deepEqual(atA.points, [], "ravito avant la zone affichée");
  const atB = computeProgress(profile, ids, () => true);
  assert.equal(atB.points[0][0], 0);
  assert.equal(atB.points.at(-1)[0], profile.markers[2].x);
});

test("slopeBand et gradeAt classent la pente en montée comme en descente", () => {
  assert.deepEqual([0, 4.9, -5, 9.9, 10, -25].map(slopeBand), [
    "easy",
    "easy",
    "medium",
    "medium",
    "hard",
    "hard"
  ]);
  const points = [0, 1, 2].map(distanceKm => ({ distanceKm, elevation: distanceKm * 80 }));
  assert.ok(Math.abs(gradeAt(points, 1) - 8) < 1e-9);
  assert.ok(Math.abs(gradeAt(points, 0) - 8) < 1e-9, "fenêtre tronquée au départ");
});

test("computeSlopeSegments regroupe les tronçons de même pente", () => {
  // 0–2 km à plat, 2–3 km à 12 %, 3–3,2 km à plat, 3,2–5 km à 12 %.
  const profile = [
    [0, 100],
    [2, 100],
    [3, 220],
    [3.2, 220],
    [5, 436]
  ].map(([distanceKm, elevation]) => ({ distanceKm, elevation }));
  const segments = computeSlopeSegments(profile);
  assert.deepEqual(
    segments.map(segment => segment.band),
    ["easy", "hard"],
    "le replat de 200 m rejoint la montée"
  );
  assert.equal(segments[0].fromKm, 0);
  assert.ok(Math.abs(segments.at(-1).toKm - 5) < 1e-9);
  assert.ok(Math.abs(segments[1].fromKm - 2) < 0.15, "la montée commence vers le km 2");
});

test("computeSections mesure chaque section entre deux repères", () => {
  const { points } = measureTrack(track);
  const sections = computeSections(points, [
    { id: "start", km: 0 },
    { id: "col", km: 11.12 },
    { id: "double", km: 11.12 },
    { id: "finish", km: 33.36 }
  ]);
  assert.deepEqual(
    sections.map(({ fromId, toId, ascentMeters, descentMeters }) => [
      fromId,
      toId,
      ascentMeters,
      descentMeters
    ]),
    [
      ["start", "col", 450, 0],
      ["double", "finish", 700, 250]
    ]
  );
});
