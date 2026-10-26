// Plan personnel d’une course (racePlans) appliqué à sa fiche de référence (raceCatalog).

/**
 * Le plan apporte scénarios, temps cibles, horaires de passage, nutrition et rappels ;
 * ses ravitos complètent ceux de la fiche ayant le même identifiant.
 * @param {Object} race
 * @param {Object | null} plan
 */
export function applyPersonalPlan(race, plan) {
  if (!plan) return race;
  const scenarios = Array.isArray(plan.scenarios) ? plan.scenarios : [];
  const defaultScenario =
    Number.isInteger(plan.defaultScenario) &&
    plan.defaultScenario >= 0 &&
    plan.defaultScenario < scenarios.length
      ? plan.defaultScenario
      : 0;
  const privateCheckpoints = new Map(
    (Array.isArray(plan.checkpoints) ? plan.checkpoints : [])
      .filter(checkpoint => checkpoint && typeof checkpoint.id === "string")
      .map(checkpoint => [checkpoint.id, checkpoint])
  );
  const finishCheckpoint = privateCheckpoints.get("finish");
  return {
    ...race,
    targetTime:
      typeof plan.targetTime === "string" ? plan.targetTime : scenarios[defaultScenario]?.duration,
    targetFinish:
      typeof plan.targetFinish === "string"
        ? plan.targetFinish
        : finishCheckpoint?.clocks?.[defaultScenario],
    scenarios,
    defaultScenario,
    checkpoints: (race.checkpoints || []).map(checkpoint => ({
      ...checkpoint,
      ...(privateCheckpoints.get(checkpoint.id) || {})
    })),
    nutrition: plan.nutrition && typeof plan.nutrition === "object" ? plan.nutrition : null,
    reminders: plan.reminders && typeof plan.reminders === "object" ? plan.reminders : null
  };
}

/** Les champs indispensables à l’affichage d’une fiche. */
export function hasRequiredRaceFields(race) {
  return Boolean(
    race.id &&
    race.name &&
    race.date &&
    Number.isFinite(race.distanceKm) &&
    Number.isFinite(race.ascentMeters)
  );
}
