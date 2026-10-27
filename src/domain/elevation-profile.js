// Profil d’altitude d’une trace GPX, en coordonnées du graphique SVG (viewBox 900 × 285).

/** Zone de tracé du graphique. */
export const PLOT = Object.freeze({ left: 52, right: 884, top: 26, bottom: 213 });

const EARTH_RADIUS_KM = 6371;
const ELEVATION_ROUNDING = 200;
const MAX_SAMPLES = 250;
// Variation d’altitude en dessous de laquelle le dénivelé n’avance pas : filtre le bruit du GPS.
const CLIMB_THRESHOLD_METERS = 5;

const toRadians = degrees => (degrees * Math.PI) / 180;

/**
 * Distance cumulée de chaque point (formule de haversine).
 * @param {Array<{ latitude: number, longitude: number, elevation: number }>} trackpoints
 * @returns {{ points: Array<{ elevation: number, distanceKm: number }>, distanceKm: number }}
 */
export function measureTrack(trackpoints) {
  if (trackpoints.length < 2) {
    throw new Error("Le GPX ne contient pas assez de points de trace.");
  }
  let distanceKm = 0;
  const points = trackpoints.map((point, index) => {
    if (index > 0) {
      const previous = trackpoints[index - 1];
      const latitudeDelta = toRadians(point.latitude - previous.latitude);
      const longitudeDelta = toRadians(point.longitude - previous.longitude);
      const a =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(toRadians(previous.latitude)) *
          Math.cos(toRadians(point.latitude)) *
          Math.sin(longitudeDelta / 2) ** 2;
      distanceKm += EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return { elevation: point.elevation, distanceKm };
  });
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("La distance de la trace GPX est invalide.");
  }
  return { points, distanceKm };
}

/**
 * Altitude interpolée à une distance de la trace.
 * @param {Array<{ elevation: number, distanceKm: number }>} points Trace mesurée.
 */
function elevationAt(points, km) {
  let nextIndex = points.findIndex(point => point.distanceKm >= km);
  if (nextIndex < 0) return points[points.length - 1].elevation;
  if (nextIndex < 1) nextIndex = 1;
  const previous = points[nextIndex - 1];
  const next = points[nextIndex];
  const segment = next.distanceKm - previous.distanceKm;
  const ratio = segment > 0 ? (km - previous.distanceKm) / segment : 0;
  return previous.elevation + ratio * (next.elevation - previous.elevation);
}

/**
 * Dénivelés positif et négatif entre deux distances de la trace, en mètres entiers.
 * @param {Array<{ elevation: number, distanceKm: number }>} points Trace mesurée.
 * @param {number} fromKm
 * @param {number} toKm
 */
export function measureClimb(points, fromKm, toKm) {
  const elevations = [
    elevationAt(points, fromKm),
    ...points
      .filter(point => point.distanceKm > fromKm && point.distanceKm < toKm)
      .map(point => point.elevation),
    elevationAt(points, toKm)
  ];
  let reference = elevations[0];
  let ascent = 0;
  let descent = 0;
  for (const elevation of elevations.slice(1)) {
    if (elevation - reference >= CLIMB_THRESHOLD_METERS) {
      ascent += elevation - reference;
      reference = elevation;
    } else if (reference - elevation >= CLIMB_THRESHOLD_METERS) {
      descent += reference - elevation;
      reference = elevation;
    }
  }
  return { ascentMeters: Math.round(ascent), descentMeters: Math.round(descent) };
}

/**
 * Points du profil et repères (départ, ravitos, arrivée) placés sur la trace.
 * @param {Array<{ latitude: number, longitude: number, elevation: number }>} trackpoints
 * @param {Array<{ id: string, km?: number }>} [checkpoints]
 */
export function buildElevationProfile(trackpoints, checkpoints = []) {
  const { points, distanceKm } = measureTrack(trackpoints);
  const elevations = points.map(point => point.elevation);
  const minElevation =
    Math.floor(Math.min(...elevations) / ELEVATION_ROUNDING) * ELEVATION_ROUNDING;
  let maxElevation = Math.ceil(Math.max(...elevations) / ELEVATION_ROUNDING) * ELEVATION_ROUNDING;
  if (maxElevation <= minElevation) maxElevation = minElevation + ELEVATION_ROUNDING;

  const pointAt = targetKm => {
    const target = Math.max(0, Math.min(distanceKm, targetKm));
    const elevation = elevationAt(points, target);
    return {
      km: target,
      elevation,
      x: PLOT.left + (target / distanceKm) * (PLOT.right - PLOT.left),
      y:
        PLOT.bottom -
        ((elevation - minElevation) / (maxElevation - minElevation)) * (PLOT.bottom - PLOT.top)
    };
  };

  const stride = Math.max(1, Math.ceil(points.length / MAX_SAMPLES));
  const samples = points
    .filter((point, index) => index % stride === 0 || index === points.length - 1)
    .map(point => pointAt(point.distanceKm))
    .map(point => [point.x, point.y]);
  const markers = [{ id: "start", ...pointAt(0) }];
  for (const checkpoint of checkpoints) {
    if (!Number.isFinite(checkpoint.km)) continue;
    const routeKm = checkpoint.id === "finish" ? distanceKm : Math.min(checkpoint.km, distanceKm);
    markers.push({ id: checkpoint.id, ...pointAt(routeKm) });
  }
  if (!markers.some(marker => marker.id === "finish")) {
    markers.push({ id: "finish", ...pointAt(distanceKm) });
  }

  return { distanceKm, minElevation, maxElevation, samples, markers, points };
}

/** Pas « rond » (1, 2, 2,5, 5 ou 10 × 10ⁿ) pour environ quatre graduations d’altitude. */
export function computeElevationStep(elevationRange) {
  const rawStep = elevationRange / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const factor =
    normalizedStep <= 1
      ? 1
      : normalizedStep <= 2
        ? 2
        : normalizedStep <= 2.5
          ? 2.5
          : normalizedStep <= 5
            ? 5
            : 10;
  return factor * magnitude;
}

/**
 * Position atteinte : le dernier ravito coché sans interruption depuis le départ.
 * @param {ReturnType<typeof buildElevationProfile>} profile
 * @param {Set<string>} checkpointIds Ravitos de la fiche.
 * @param {(id: string) => boolean} isChecked
 * @returns {{ marker: Object, points: Array<[number, number]>, remainingKm: number } | null}
 */
export function computeProgress(profile, checkpointIds, isChecked) {
  const progressMarkers = profile.markers.filter(
    marker => marker.id === "start" || checkpointIds.has(marker.id)
  );
  let completedCount = 0;
  for (const marker of progressMarkers.slice(1)) {
    if (!isChecked(marker.id)) break;
    completedCount += 1;
  }
  const marker = progressMarkers[completedCount];
  if (!marker) return null;
  let points = profile.samples.filter(point => point[0] <= marker.x);
  const next = profile.samples.find(point => point[0] > marker.x);
  const previous = points[points.length - 1];
  if (next && previous && previous[0] !== marker.x) {
    const ratio = (marker.x - previous[0]) / (next[0] - previous[0]);
    points = [...points, [marker.x, previous[1] + ratio * (next[1] - previous[1])]];
  }
  return { marker, points, remainingKm: Math.max(0, profile.distanceKm - marker.km) };
}
