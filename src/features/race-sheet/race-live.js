// Bloc « En course » d’une fiche : prochain ravito, ce qui reste jusqu’à lui, et un grand bouton
// pour le cocher. Tout vient des ravitos de la fiche, du plan et de la trace GPX.

import { measureClimb } from "../../domain/elevation-profile.js";
import { findRaceProgress } from "../../domain/race-progress.js";
import { el } from "../../ui/dom.js";
import { formatNumber } from "../../ui/format.js";

/**
 * @param {Object} race Fiche avec plan personnel appliqué et au moins un ravito.
 * @param {Object} checkpoints Section des ravitos, qui garde l’état coché et le scénario.
 * @param {(id: string) => boolean} checkpoints.isChecked
 * @param {(id: string) => void} checkpoints.toggle
 * @param {() => number} checkpoints.getScenarioIndex
 */
export function createLiveSection(race, { isChecked, toggle, getScenarioIndex }) {
  const label = el("span", { className: "live-label" });
  const title = el("h2", { className: "live-next", attrs: { "aria-live": "polite" } });
  const stats = el("dl", { className: "live-stats" });
  const remaining = el("p", { className: "live-remaining" });
  const reachButton = el("button", { className: "live-reach", attrs: { type: "button" } });
  const undoButton = el("button", {
    className: "live-undo",
    text: "Annuler",
    attrs: { type: "button" }
  });
  const element = el(
    "section",
    { className: "section live-section", attrs: { "aria-label": "En course" } },
    [
      label,
      title,
      stats,
      remaining,
      el("div", { className: "live-actions" }, [undoButton, reachButton])
    ]
  );
  /** @type {ReturnType<import("../../domain/elevation-profile.js").buildElevationProfile> | null} */
  let profile = null;

  const progress = () => findRaceProgress(race.checkpoints, isChecked);

  function measureLeg(reached, next) {
    if (!profile) return null;
    const from = profile.markers.find(marker => marker.id === (reached?.id ?? "start"));
    const to = profile.markers.find(marker => marker.id === next.id);
    return from && to && to.km > from.km ? measureClimb(profile.points, from.km, to.km) : null;
  }

  function update() {
    const { reached, next } = progress();
    undoButton.hidden = !reached;
    if (reached) undoButton.setAttribute("aria-label", `Décocher ${reached.name}`);
    if (!next) {
      label.textContent = "COURSE TERMINÉE";
      title.textContent = reached.name;
      stats.replaceChildren();
      remaining.hidden = true;
      reachButton.hidden = true;
      return;
    }

    const isFinish = next.id === "finish";
    label.textContent = isFinish ? "VERS L’ARRIVÉE" : "PROCHAIN RAVITO";
    title.textContent = next.name;
    const fromKm = reached ? reached.km : 0;
    const values = [];
    if (Number.isFinite(next.km) && Number.isFinite(fromKm)) {
      values.push(["Distance", `${formatNumber(next.km - fromKm)} km`]);
    }
    const climb = measureLeg(reached, next);
    if (climb) {
      values.push(["D+", `${formatNumber(climb.ascentMeters)} m`]);
      values.push(["D−", `${formatNumber(climb.descentMeters)} m`]);
    }
    const clock = next.clocks?.[getScenarioIndex()];
    if (clock) values.push(["Passage", clock]);
    stats.replaceChildren(
      ...values.map(([name, value]) =>
        el("div", {}, [el("dt", { text: name }), el("dd", { text: value })])
      )
    );

    const finishKm =
      race.checkpoints.find(checkpoint => checkpoint.id === "finish")?.km ?? race.distanceKm;
    remaining.hidden = isFinish || !Number.isFinite(fromKm);
    remaining.textContent = remaining.hidden
      ? ""
      : `Arrivée dans ${formatNumber(finishKm - fromKm)} km`;
    reachButton.hidden = false;
    reachButton.textContent = isFinish ? "Arrivée atteinte" : "Ravito atteint";
    reachButton.setAttribute("aria-label", `Marquer ${next.name} comme atteint`);
  }

  reachButton.addEventListener("click", () => {
    const { next } = progress();
    if (next) toggle(next.id);
  });
  undoButton.addEventListener("click", () => {
    const { reached } = progress();
    if (reached) toggle(reached.id);
  });
  update();

  return {
    element,
    update,
    /** La trace GPX, une fois lue, apporte le dénivelé jusqu’au prochain ravito. */
    setProfile(value) {
      profile = value;
      update();
    }
  };
}
