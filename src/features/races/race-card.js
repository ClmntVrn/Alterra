// Cartes des courses dans la vue jour du calendrier.

import { el } from "../../ui/dom.js";
import { formatDateRange } from "../../ui/format.js";

/** Course du catalogue, avec un lien vers sa fiche. */
export function renderRaceCard(race) {
  return el("article", { className: "calendar-item calendar-race-item" }, [
    el("span", {
      className: "calendar-event-category",
      text: [race.startTime, race.organizer ? `COURSE · ${race.organizer}` : "COURSE"]
        .filter(Boolean)
        .join(" · ")
    }),
    el("h3", { text: race.name }),
    el("p", {
      className: "calendar-event-description",
      text: `${formatDateRange(race.date, race.endDate)} · ${race.calendarDetails}`
    }),
    el("a", {
      className: "calendar-event-link",
      text: "Ouvrir le plan de course",
      attrs: {
        href: `./race.html?id=${encodeURIComponent(race.id)}`,
        "aria-label": `Ouvrir la fiche de ${race.name}`
      }
    })
  ]);
}

/**
 * Course ajoutée depuis le calendrier.
 * @param {Object} race
 * @param {Object} handlers
 * @param {() => void} handlers.onEdit
 * @param {() => Promise<void>} handlers.onDelete
 * @param {(message: string, error: unknown) => void} handlers.onError
 */
export function renderPersonalRaceCard(race, { onEdit, onDelete, onError }) {
  const editButton = el("button", {
    className: "calendar-session-details",
    text: "Modifier",
    attrs: { type: "button", "aria-label": `Modifier la course : ${race.name}` }
  });
  editButton.addEventListener("click", onEdit);

  const deleteButton = el("button", {
    className: "calendar-delete-button",
    text: "×",
    attrs: { type: "button", "aria-label": `Supprimer la course : ${race.name}` }
  });
  deleteButton.title = "Supprimer la course";
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Supprimer la course « ${race.name} » ? Cette action est définitive.`)) {
      return;
    }
    deleteButton.disabled = true;
    try {
      await onDelete();
    } catch (error) {
      deleteButton.disabled = false;
      onError("La suppression a échoué. Réessaie.", error);
    }
  });

  return el("article", { className: "calendar-item calendar-race-item" }, [
    el("div", { className: "calendar-training-header" }, [
      el("span", { className: "calendar-event-category", text: "COURSE" })
    ]),
    el("h3", { text: race.name }),
    el("p", {
      className: "calendar-event-description",
      text: formatDateRange(race.date, race.endDate)
    }),
    el("div", { className: "calendar-session-actions" }, [editButton, deleteButton])
  ]);
}
