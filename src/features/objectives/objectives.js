// Onglet Objectifs : prochaine course mise en avant, autres courses à venir, courses passées.

import { listObjectives } from "../../domain/objectives.js";
import { toDateKey } from "../../domain/dates.js";
import { el } from "../../ui/dom.js";
import { formatCountdown, formatDateRange, formatNumber } from "../../ui/format.js";

function renderCountdown(daysLeft) {
  const { text, label } = formatCountdown(daysLeft);
  return el("span", { className: "objective-countdown" }, [
    el("span", { text, attrs: { "aria-hidden": "true" } }),
    el("span", { className: "visually-hidden", text: `, ${label}` })
  ]);
}

/** Distance et D+ d’une fiche, ou son résumé de calendrier. */
function formatRaceFigures(race) {
  const figures = [
    Number.isFinite(race.distanceKm) ? `${formatNumber(race.distanceKm)} km` : "",
    Number.isFinite(race.ascentMeters) ? `${formatNumber(race.ascentMeters)} m D+` : ""
  ].filter(Boolean);
  return figures.length ? figures.join(" · ") : race.calendarDetails || "";
}

/**
 * Une fiche du catalogue ouvre sa page ; une course personnelle ouvre sa modification.
 * @param {Object} race Objectif renvoyé par listObjectives.
 * @param {{ isNext?: boolean, isPast?: boolean, onEdit: (race: Object) => void }} options
 */
function renderObjectiveCard(race, { isNext = false, isPast = false, onEdit }) {
  let open;
  if (race.eventType === "race") {
    open = el("a", {
      className: "calendar-item-open",
      text: race.name,
      attrs: { href: `./race.html?id=${encodeURIComponent(race.id)}` }
    });
  } else {
    open = el("button", {
      className: "calendar-item-open",
      text: race.name,
      attrs: { type: "button", "aria-haspopup": "dialog" }
    });
    open.addEventListener("click", () => onEdit(race));
  }
  const figures = formatRaceFigures(race);
  const details = [
    el("p", {
      className: "calendar-event-description",
      text: formatDateRange(race.date, race.endDate)
    }),
    figures ? el("p", { className: "objective-figures", text: figures }) : ""
  ];
  // Prochaine course : le compte à rebours, en grand, se lit avant le nom.
  if (isNext) {
    return el("article", { className: "calendar-item objective-card is-next" }, [
      el("div", { className: "objective-card-main" }, [
        el("span", { className: "calendar-event-category", text: "PROCHAINE COURSE" }),
        renderCountdown(race.daysLeft),
        el("h2", {}, [open]),
        ...details
      ])
    ]);
  }
  return el("article", { className: "calendar-item objective-card" }, [
    el("div", { className: "objective-card-main" }, [el("h3", {}, [open]), ...details]),
    isPast ? "" : renderCountdown(race.daysLeft)
  ]);
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.container Zone de la liste.
 * @param {(race: Object) => void} options.onEditPersonalRace
 * @returns {(sources: { races: Array<Object>, personalRaces: Array<Object> }) => void}
 *   Affiche les objectifs ; rappelé à chaque changement des courses.
 */
export function createObjectivesView({ container, onEditPersonalRace: onEdit }) {
  let sources = null;

  function render(nextSources = sources) {
    if (!nextSources) return;
    sources = nextSources;
    const { upcoming, past } = listObjectives(sources, toDateKey(new Date()));
    const children = upcoming.length
      ? [
          renderObjectiveCard(upcoming[0], { isNext: true, onEdit }),
          ...upcoming.slice(1).map(race => renderObjectiveCard(race, { onEdit }))
        ]
      : [el("p", { className: "calendar-empty", text: "Aucune course à venir." })];
    if (past.length) {
      children.push(
        el("details", { className: "objectives-past" }, [
          el("summary", {}, [
            el("span", { text: `Courses passées (${past.length})` }),
            el("span", {
              className: "objectives-past-chevron",
              text: "⌄",
              attrs: { "aria-hidden": "true" }
            })
          ]),
          ...past.map(race => renderObjectiveCard(race, { isPast: true, onEdit }))
        ])
      );
    }
    // Le repli des courses passées survit au rafraîchissement.
    const wasOpen = container.querySelector(".objectives-past")?.open;
    container.replaceChildren(...children);
    if (wasOpen) container.querySelector(".objectives-past").open = true;
  }

  // Le compte à rebours suit la date du jour au retour au premier plan.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });

  return render;
}
