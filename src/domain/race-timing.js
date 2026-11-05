// Heure de passage estimée en un point du parcours, d’après les temps du plan aux ravitos.

const MINUTES_PER_DAY = 24 * 60;
// Écart toléré au-delà du dernier ravito (km de la fiche un peu plus courts que la trace).
const END_TOLERANCE_KM = 1;

/** « 2:40 » → 160 minutes ; null si la valeur n’est pas une durée h:mm. */
export function parseClockMinutes(value) {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 78 → « 1h18 ». */
export function formatElapsed(minutes) {
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, "0")}`;
}

/** 1 438 → « 23:58 » ; l’heure repart de 00:00 après minuit. */
export function formatClock(minutes) {
  const value = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/**
 * Temps écoulé et heure estimés à une distance, en interpolant entre le départ et les ravitos
 * du scénario choisi, au prorata de la distance.
 * @param {Array<{ km?: number, elapsed?: string[], clocks?: string[] }>} checkpoints
 * @param {number} scenarioIndex
 * @param {number} km
 * @returns {{ elapsedMinutes: number, clock: string | null } | null} null sans temps au-delà.
 */
export function estimatePassage(checkpoints, scenarioIndex, km) {
  const timed = (checkpoints || [])
    .map(checkpoint => ({
      km: checkpoint.km,
      elapsed: parseClockMinutes(checkpoint.elapsed?.[scenarioIndex]),
      clock: parseClockMinutes(checkpoint.clocks?.[scenarioIndex])
    }))
    .filter(anchor => Number.isFinite(anchor.km) && anchor.km > 0 && anchor.elapsed !== null)
    .sort((a, b) => a.km - b.km);
  if (!timed.length || !Number.isFinite(km) || km < 0) return null;
  const last = timed[timed.length - 1];
  if (km > last.km + END_TOLERANCE_KM) return null;

  const anchors = [{ km: 0, elapsed: 0 }, ...timed];
  const target = Math.min(km, last.km);
  const nextIndex = Math.max(
    1,
    anchors.findIndex(anchor => anchor.km >= target)
  );
  const previous = anchors[nextIndex - 1];
  const next = anchors[nextIndex];
  const ratio = next.km > previous.km ? (target - previous.km) / (next.km - previous.km) : 0;
  const elapsedMinutes = previous.elapsed + ratio * (next.elapsed - previous.elapsed);

  const withClock = timed.find(anchor => anchor.clock !== null);
  const clock = withClock
    ? formatClock(withClock.clock - withClock.elapsed + elapsedMinutes)
    : null;
  return { elapsedMinutes: Math.round(elapsedMinutes), clock };
}
