// Onglet Objectifs : prochaine course mise en avant, autres courses à venir, courses passées.

import { listObjectives } from "../../domain/objectives.js";
import { parseDateKey, toDateKey } from "../../domain/dates.js";
import { formatDuration } from "../../domain/durations.js";
import { el } from "../../ui/dom.js";
import {
  formatCountdown,
  formatDateRange,
  formatLongDate,
  formatNumber,
  formatShortDayMonth,
  formatShortMonth
} from "../../ui/format.js";

function renderCountdown(daysLeft) {
  const { text, label } = formatCountdown(daysLeft);
  return el("span", { className: "objective-countdown" }, [
    el("span", { text, attrs: { "aria-hidden": "true" } }),
    el("span", { className: "visually-hidden", text: `, ${label}` })
  ]);
}

/** Pastille de date façon calendrier : jour en grand, mois abrégé. */
function renderDateTile(dateKey) {
  const date = parseDateKey(dateKey);
  return el("time", { className: "objective-date", attrs: { datetime: dateKey } }, [
    el("strong", { text: String(date.getDate()), attrs: { "aria-hidden": "true" } }),
    el("span", { text: formatShortMonth(date), attrs: { "aria-hidden": "true" } }),
    el("span", { className: "visually-hidden", text: formatLongDate(date) })
  ]);
}

/** Distance et D+ connus d’une course, avec leur libellé. */
function listRaceFigures(race) {
  return [
    ["Distance", Number.isFinite(race.distanceKm) ? `${formatNumber(race.distanceKm)} km` : ""],
    ["D+", Number.isFinite(race.ascentMeters) ? `${formatNumber(race.ascentMeters)} m` : ""]
  ].filter(([, value]) => value);
}

/** Chiffres relevés à l’arrivée : distance, temps et D+. */
function formatResult({ distanceKm, durationMinutes, ascentMeters }) {
  return [
    `${formatNumber(distanceKm)} km`,
    formatDuration(durationMinutes),
    Number.isFinite(ascentMeters) ? `${formatNumber(ascentMeters)} m D+` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

/** « Valider » une course faite, ou « Terminée » pour revoir son résultat. */
function renderResultButton(race, onEditResult) {
  const isDone = Boolean(race.result);
  const button = el(
    "button",
    {
      className: `objective-result-button${isDone ? " is-done" : ""}`,
      attrs: { type: "button", "aria-haspopup": "dialog" }
    },
    [
      el("span", { text: isDone ? "✓ Terminée" : "Valider", attrs: { "aria-hidden": "true" } }),
      el("span", {
        className: "visually-hidden",
        text: isDone ? `Résultat de ${race.name}` : `Valider ${race.name}`
      })
    ]
  );
  button.addEventListener("click", () => onEditResult(race));
  return button;
}

/** 6 nov. ou 12 avr. – 13 avr. : l’année se lit dans le compte à rebours. */
function formatShortRange(race) {
  const start = formatShortDayMonth(parseDateKey(race.date));
  const end = race.endDate && race.endDate !== race.date ? parseDateKey(race.endDate) : null;
  return end ? `${start} – ${formatShortDayMonth(end)}` : start;
}

/** Une fiche du catalogue ouvre sa page ; une course personnelle ouvre sa modification. */
function renderOpen(race, onEdit) {
  if (race.eventType === "race") {
    return el("a", {
      className: "calendar-item-open",
      text: race.name,
      attrs: { href: `./pages/race.html?id=${encodeURIComponent(race.id)}` }
    });
  }
  const button = el("button", {
    className: "calendar-item-open",
    text: race.name,
    attrs: { type: "button", "aria-haspopup": "dialog" }
  });
  button.addEventListener("click", () => onEdit(race));
  return button;
}

/**
 * Prochaine course : compte à rebours en grand à droite, chiffres clés en dessous. Dès le départ,
 * elle peut être validée.
 */
function renderNextCard(race, { onEdit, onEditResult }) {
  const stats = [["Date", formatShortRange(race)], ...listRaceFigures(race)];
  return el("article", { className: "calendar-item objective-card is-next" }, [
    el("div", { className: "objective-next-heading" }, [
      el("div", {}, [
        el("span", { className: "calendar-event-category", text: "PROCHAINE COURSE" }),
        el("h2", {}, [renderOpen(race, onEdit)])
      ]),
      renderCountdown(race.daysLeft)
    ]),
    el(
      "dl",
      { className: "workout-stats" },
      stats.map(([label, value]) =>
        el("div", {}, [el("dt", { text: label }), el("dd", { text: value })])
      )
    ),
    race.daysLeft <= 0 ? renderResultButton(race, onEditResult) : ""
  ]);
}

/**
 * Autre course : pastille de date, nom et chiffres, compte à rebours à droite. Une course passée
 * ou sur plusieurs jours rappelle sa période complète ; une course passée se valide à droite, et
 * affiche alors son résultat.
 */
function renderCompactCard(race, { isPast, onEdit, onEditResult }) {
  const isMultiDay = race.endDate && race.endDate !== race.date;
  const details = [
    isPast || isMultiDay ? formatDateRange(race.date, race.endDate) : "",
    race.result
      ? formatResult(race.result)
      : listRaceFigures(race)
          .map(([label, value]) => (label === "D+" ? `${value} D+` : value))
          .join(" · ")
  ]
    .filter(Boolean)
    .join(" · ");
  return el("article", { className: "calendar-item objective-card" }, [
    renderDateTile(race.date),
    el("div", { className: "objective-card-main" }, [
      el("h3", {}, [renderOpen(race, onEdit)]),
      details ? el("p", { className: "calendar-event-description", text: details }) : ""
    ]),
    isPast ? renderResultButton(race, onEditResult) : renderCountdown(race.daysLeft)
  ]);
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.container Zone de la liste.
 * @param {(race: Object) => void} options.onEditPersonalRace
 * @param {(race: Object) => void} options.onEditResult Saisie du résultat d’une course faite.
 * @returns {(sources: { races: Array<Object>, personalRaces: Array<Object> }) => void}
 *   Affiche les objectifs ; rappelé à chaque changement des courses.
 */
export function createObjectivesView({ container, onEditPersonalRace: onEdit, onEditResult }) {
  let sources = null;

  function render(nextSources = sources) {
    if (!nextSources) return;
    sources = nextSources;
    const { upcoming, past } = listObjectives(sources, toDateKey(new Date()));
    const children = upcoming.length
      ? [
          renderNextCard(upcoming[0], { onEdit, onEditResult }),
          ...upcoming.slice(1).map(race => renderCompactCard(race, { onEdit, onEditResult }))
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
          ...past.map(race => renderCompactCard(race, { isPast: true, onEdit, onEditResult }))
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
