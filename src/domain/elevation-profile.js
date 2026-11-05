// Profil d’altitude d’une trace GPX, en coordonnées du graphique SVG.

/** Zone de tracé par défaut ; la fiche la calcule selon la largeur de l’écran. */
export const PLOT = Object.freeze({ left: 52, right: 884, top: 26, bottom: 213 });

const EARTH_RADIUS_KM = 6371;
// Écart d’altitude minimal de l’échelle : une section presque plate n’est pas grossie à l’excès.
const MIN_ELEVATION_RANGE = 40;
const MAX_SAMPLES = 400;
// Demi-fenêtre de calcul de la pente, en km.
const SLOPE_WINDOW_KM = 0.15;
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
export function elevationAt(points, km) {
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
 * @param {{ left: number, right: number, top: number, bottom: number }} [plot] Zone de tracé.
 * @param {{ fromKm: number, toKm: number } | null} [view] Partie affichée (zoom) ; toute la
 *   trace par défaut. L’échelle d’altitude suit la partie affichée.
 */
export function buildElevationProfile(trackpoints, checkpoints = [], plot = PLOT, view = null) {
  const { points, distanceKm } = measureTrack(trackpoints);
  const fromKm = Math.max(0, Math.min(distanceKm, view?.fromKm ?? 0));
  const toKm = Math.max(fromKm, Math.min(distanceKm, view?.toKm ?? distanceKm));
  const spanKm = toKm - fromKm || distanceKm;

  const stride = Math.max(
    1,
    Math.ceil(points.filter(p => p.distanceKm > fromKm && p.distanceKm < toKm).length / MAX_SAMPLES)
  );
  const sampleKms = [
    fromKm,
    ...points
      .filter(point => point.distanceKm > fromKm && point.distanceKm < toKm)
      .filter((point, index) => index % stride === 0)
      .map(point => point.distanceKm),
    toKm
  ];
  const elevations = sampleKms.map(km => elevationAt(points, km));
  const rawMin = Math.min(...elevations);
  const rawMax = Math.max(...elevations);
  const elevationStep = computeAxisStep(Math.max(rawMax - rawMin, MIN_ELEVATION_RANGE));
  // Bornes au demi-pas : l’échelle colle au relief sans partir de zéro.
  const bound = elevationStep / 2;
  const minElevation = Math.floor(rawMin / bound) * bound;
  let maxElevation = Math.ceil(rawMax / bound) * bound;
  if (maxElevation <= minElevation) maxElevation = minElevation + elevationStep;

  const xAt = km => plot.left + ((km - fromKm) / spanKm) * (plot.right - plot.left);
  const yAt = elevation =>
    plot.bottom -
    ((elevation - minElevation) / (maxElevation - minElevation)) * (plot.bottom - plot.top);
  const pointAt = targetKm => {
    const km = Math.max(0, Math.min(distanceKm, targetKm));
    const elevation = elevationAt(points, km);
    return { km, elevation, x: xAt(km), y: yAt(elevation) };
  };
  /** Courbe [x, y] entre deux distances, limitée à la partie affichée. */
  const curve = (startKm, endKm) => {
    const start = Math.max(fromKm, startKm);
    const end = Math.min(toKm, endKm);
    if (end <= start) return start <= toKm ? [[xAt(start), yAt(elevationAt(points, start))]] : [];
    return [start, ...sampleKms.filter(km => km > start && km < end), end].map(km => [
      xAt(km),
      yAt(elevationAt(points, km))
    ]);
  };

  const markers = [{ id: "start", ...pointAt(0) }];
  for (const checkpoint of checkpoints) {
    if (!Number.isFinite(checkpoint.km)) continue;
    const routeKm = checkpoint.id === "finish" ? distanceKm : Math.min(checkpoint.km, distanceKm);
    markers.push({ id: checkpoint.id, ...pointAt(routeKm) });
  }
  if (!markers.some(marker => marker.id === "finish")) {
    markers.push({ id: "finish", ...pointAt(distanceKm) });
  }
  for (const marker of markers) marker.inView = marker.km >= fromKm && marker.km <= toKm;

  return {
    distanceKm,
    fromKm,
    toKm,
    minElevation,
    maxElevation,
    elevationStep,
    samples: curve(fromKm, toKm),
    markers,
    points,
    plot,
    xAt,
    yAt,
    curve
  };
}

/** Classe de pente : moins de 5 %, de 5 à 10 %, 10 % et plus, en montée comme en descente. */
export const SLOPE_LIMITS = Object.freeze({ easy: 5, medium: 10 });

/** @returns {"easy" | "medium" | "hard"} */
export function slopeBand(gradePercent) {
  const grade = Math.abs(gradePercent);
  if (grade < SLOPE_LIMITS.easy) return "easy";
  if (grade < SLOPE_LIMITS.medium) return "medium";
  return "hard";
}

/**
 * Pente moyenne autour d’une distance, en %, lissée sur une fenêtre pour ignorer le bruit du GPS.
 * @param {Array<{ elevation: number, distanceKm: number }>} points Trace mesurée.
 */
export function gradeAt(points, km, windowKm = SLOPE_WINDOW_KM) {
  const total = points[points.length - 1].distanceKm;
  const from = Math.max(0, km - windowKm);
  const to = Math.min(total, km + windowKm);
  if (to <= from) return 0;
  return ((elevationAt(points, to) - elevationAt(points, from)) / ((to - from) * 1000)) * 100;
}

/**
 * Tronçons de même classe de pente sur toute la trace ; un tronçon trop court rejoint le précédent.
 * @param {Array<{ elevation: number, distanceKm: number }>} points Trace mesurée.
 * @returns {Array<{ fromKm: number, toKm: number, band: "easy" | "medium" | "hard" }>}
 */
export function computeSlopeSegments(points, { stepKm = 0.1, minKm = 0.3 } = {}) {
  const total = points[points.length - 1].distanceKm;
  const segments = [];
  for (let index = 0; index * stepKm < total; index += 1) {
    const from = index * stepKm;
    const to = Math.min(total, from + stepKm);
    const band = slopeBand(gradeAt(points, (from + to) / 2));
    const last = segments[segments.length - 1];
    if (last?.band === band) last.toKm = to;
    else segments.push({ fromKm: from, toKm: to, band });
  }
  const merged = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && (last.band === segment.band || segment.toKm - segment.fromKm < minKm)) {
      last.toKm = segment.toKm;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

/**
 * Sections entre deux repères consécutifs : distance, D+ et D−.
 * @param {Array<{ elevation: number, distanceKm: number }>} points Trace mesurée.
 * @param {Array<{ id: string, km: number }>} markers Repères du profil, du départ à l’arrivée.
 */
export function computeSections(points, markers) {
  return markers
    .slice(1)
    .map((to, index) => {
      const from = markers[index];
      return {
        fromId: from.id,
        toId: to.id,
        fromKm: from.km,
        toKm: to.km,
        distanceKm: to.km - from.km,
        ...measureClimb(points, from.km, to.km)
      };
    })
    .filter(section => section.distanceKm > 0);
}

/** Pas « rond » (1, 2, 2,5, 5 ou 10 × 10ⁿ) pour environ quatre graduations d’altitude ou de km. */
export function computeAxisStep(range) {
  const rawStep = range / 4;
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
  // Partie affichée seulement : rien avant le début d’un zoom, tout si le ravito est au-delà.
  const points = marker.km < profile.fromKm ? [] : profile.curve(profile.fromKm, marker.km);
  return { marker, points, remainingKm: Math.max(0, profile.distanceKm - marker.km) };
}
