// Avancement en course : dernier ravito atteint et prochain ravito, d’après les ravitos cochés.

/**
 * Les ravitos sont atteints dans l’ordre : la progression s’arrête au premier non coché,
 * comme sur le profil.
 * @param {Array<{ id: string }>} checkpoints Ravitos dans l’ordre du parcours.
 * @param {(id: string) => boolean} isChecked
 * @returns {{ reached: Object | null, next: Object | null }} reached null : au départ ;
 *   next null : arrivée atteinte.
 */
export function findRaceProgress(checkpoints, isChecked) {
  let reached = null;
  for (const checkpoint of checkpoints) {
    if (!isChecked(checkpoint.id)) return { reached, next: checkpoint };
    reached = checkpoint;
  }
  return { reached, next: null };
}
