// Cartes des courses dans la vue jour du calendrier : toute la carte se touche.

import { el } from "../../ui/dom.js";
import { formatDateRange } from "../../ui/format.js";

/** Course du catalogue : la carte mène à sa fiche. */
export function renderRaceCard(race) {
  const card = el("article", { className: "calendar-item calendar-race-item" }, [
    el("span", {
      className: "calendar-event-category",
      text: [race.startTime, race.organizer ? `COURSE · ${race.organizer}` : "COURSE"]
        .filter(Boolean)
        .join(" · ")
    }),
    el("h3", {}, [
      el("a", {
        className: "calendar-item-open calendar-event-link",
        text: race.name,
        attrs: { href: `./race.html?id=${encodeURIComponent(race.id)}` }
      })
    ])
  ]);
  const details = [
    race.endDate ? formatDateRange(race.date, race.endDate) : "",
    race.calendarDetails
  ]
    .filter(Boolean)
    .join(" · ");
  if (details) card.append(el("p", { className: "calendar-event-description", text: details }));
  return card;
}

/**
 * Course ajoutée depuis le calendrier : la carte ouvre sa modification.
 * @param {Object} race
 * @param {() => void} onOpen
 */
export function renderPersonalRaceCard(race, onOpen) {
  const openButton = el("button", {
    className: "calendar-item-open",
    text: race.name,
    attrs: { type: "button", "aria-haspopup": "dialog" }
  });
  openButton.addEventListener("click", onOpen);
  const card = el("article", { className: "calendar-item calendar-race-item" }, [
    el("span", { className: "calendar-event-category", text: "COURSE" }),
    el("h3", {}, [openButton])
  ]);
  if (race.endDate) {
    card.append(
      el("p", {
        className: "calendar-event-description",
        text: formatDateRange(race.date, race.endDate)
      })
    );
  }
  return card;
}
