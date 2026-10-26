// En-tête d’une fiche : nom, date, chiffres clés et objectifs.

import { el } from "../../ui/dom.js";
import { formatDateRange, formatNumber } from "../../ui/format.js";

export function renderRaceHeader(race) {
  const subtitle = [
    formatDateRange(race.date, race.endDate),
    race.startTime ? `Départ ${race.startTime}` : "",
    race.route || ""
  ]
    .filter(Boolean)
    .join(" · ");
  const hero = el("section", { className: "hero" }, [
    el("h1", { text: race.name }),
    el("p", { className: "sub", text: subtitle })
  ]);

  const values = [
    [`${formatNumber(race.distanceKm)} km`, "Distance"],
    [`${formatNumber(race.ascentMeters)} m`, "D+"],
    race.targetTime ? [race.targetTime, "Temps cible"] : null
  ].filter(Boolean);
  const stats = el(
    "div",
    { className: "stats" },
    values.map(([value, label]) =>
      el("div", { className: "stat" }, [el("strong", { text: value }), el("span", { text: label })])
    )
  );
  stats.style.gridTemplateColumns = `repeat(${values.length}, minmax(0, 1fr))`;
  hero.append(stats);
  if (race.distanceNote) hero.append(el("p", { className: "sub", text: race.distanceNote }));

  const pills = [
    race.targetFinish ? `Arrivée cible ${race.targetFinish}` : "",
    race.cutoff ? `Barrière max. ${race.cutoff}` : "",
    race.stones ? `${race.stones} Running Stones` : ""
  ].filter(Boolean);
  if (pills.length) {
    hero.append(
      el(
        "div",
        { className: "pills" },
        pills.map(text => el("span", { className: "pill", text }))
      )
    );
  }
  return hero;
}
