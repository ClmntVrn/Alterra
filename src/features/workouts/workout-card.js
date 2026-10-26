// Carte d’une séance dans la vue jour du calendrier.

import { toDateKey } from "../../domain/dates.js";
import { formatDuration } from "../../domain/durations.js";
import { formatPace, getWorkoutState } from "../../domain/workouts.js";
import { el } from "../../ui/dom.js";
import { formatDateRange, formatNumber } from "../../ui/format.js";
import {
  DEFAULT_WORKOUT_TITLE,
  WORKOUT_STATE_LABELS,
  WORKOUT_TYPE_LABELS
} from "./workout-labels.js";

const DETAILS_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';

function formatHeartRate(workout) {
  const average = Number.isFinite(workout.heartRateAvg) ? workout.heartRateAvg : null;
  const maximum = Number.isFinite(workout.heartRateMax) ? workout.heartRateMax : null;
  if (average && maximum) return `FC moy. ${average} · max ${maximum} bpm`;
  if (average) return `FC moy. ${average} bpm`;
  if (maximum) return `FC max ${maximum} bpm`;
  return "";
}

function formatTargets(workout) {
  const details = [];
  if (Number.isFinite(workout.distanceKm)) details.push(`${formatNumber(workout.distanceKm)} km`);
  if (Number.isFinite(workout.durationMinutes))
    details.push(formatDuration(workout.durationMinutes));
  if (Number.isFinite(workout.ascentMeters)) {
    details.push(`${formatNumber(workout.ascentMeters)} m D+`);
  }
  return details.join(" · ");
}

function setDetailsButtonState(button, workout, isOpen) {
  button.title = isOpen ? "Fermer les détails" : "Détails et modification";
  button.setAttribute("aria-expanded", String(isOpen));
  button.setAttribute(
    "aria-label",
    isOpen
      ? `Fermer les détails de la séance : ${workout.title}`
      : `Détails de la séance : ${workout.title}. Ouvrir pour modifier.`
  );
}

/**
 * @param {Object} workout
 * @param {Object} handlers
 * @param {() => Promise<void>} handlers.onDelete
 * @param {(completed: boolean) => Promise<void>} handlers.onSetCompleted
 * @param {() => boolean} handlers.isEditing Le formulaire est-il ouvert sur cette séance ?
 * @param {() => void} handlers.onOpenDetails
 * @param {() => void} handlers.onCloseDetails
 * @param {(message: string, error: unknown) => void} handlers.onError
 */
export function renderWorkoutCard(workout, handlers) {
  const state = getWorkoutState(workout, toDateKey(new Date()));
  const card = el("article", { className: "calendar-item calendar-training-item" });
  card.dataset.state = state;

  const header = el("div", { className: "calendar-training-header" }, [
    el("span", {
      className: "calendar-event-category",
      text: `ENTRAÎNEMENT · ${WORKOUT_STATE_LABELS[state].toLocaleUpperCase("fr-FR")}`
    })
  ]);
  if (workout.status === "planned") header.append(createDeleteButton(workout, handlers));
  card.append(header, el("h3", { text: workout.title }));

  const summary = [
    formatDateRange(workout.date, workout.endDate),
    workout.time,
    WORKOUT_TYPE_LABELS[workout.type] || DEFAULT_WORKOUT_TITLE
  ];
  card.append(
    el("p", {
      className: "calendar-event-description calendar-training-description",
      text: summary.filter(Boolean).join(" · ")
    })
  );

  const pace = formatPace(workout.distanceKm, workout.durationMinutes);
  const details = [formatTargets(workout), workout.status === "completed" ? pace : ""]
    .filter(Boolean)
    .join(" · ");
  if (details) {
    card.append(
      el("p", { className: "calendar-event-description calendar-training-targets", text: details })
    );
  }
  if (workout.status === "completed") {
    const feeling = [
      Number.isFinite(workout.perceivedEffort) ? `Ressenti ${workout.perceivedEffort}/10` : "",
      formatHeartRate(workout)
    ]
      .filter(Boolean)
      .join(" · ");
    if (feeling) {
      card.append(
        el("p", {
          className: "calendar-event-description calendar-training-targets",
          text: feeling
        })
      );
    }
  }
  if (workout.notes) {
    card.append(
      el("p", {
        className: "calendar-event-description calendar-training-notes",
        text: workout.notes
      })
    );
  }

  card.append(
    el("div", { className: "calendar-session-actions" }, [
      createCompletedToggle(workout, handlers),
      createDetailsButton(workout, handlers)
    ])
  );
  return card;
}

function createDeleteButton(workout, { onDelete, onError }) {
  const button = el("button", {
    className: "calendar-delete-button",
    text: "×",
    attrs: { type: "button", "aria-label": `Supprimer la séance : ${workout.title}` }
  });
  button.title = "Supprimer la séance";
  button.addEventListener("click", async () => {
    if (
      !window.confirm(
        `Supprimer l’entraînement « ${workout.title} » ? Cette action est définitive.`
      )
    ) {
      return;
    }
    button.disabled = true;
    try {
      await onDelete();
    } catch (error) {
      button.disabled = false;
      onError("La suppression a échoué. Réessaie.", error);
    }
  });
  return button;
}

function createCompletedToggle(workout, { onSetCompleted, onError }) {
  const checkbox = el("input", { attrs: { type: "checkbox" } });
  checkbox.checked = workout.status === "completed";
  checkbox.setAttribute(
    "aria-label",
    `${checkbox.checked ? "Remettre à faire" : "Marquer comme réalisée"} : ${workout.title}`
  );
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      await onSetCompleted(checkbox.checked);
    } catch (error) {
      checkbox.checked = workout.status === "completed";
      checkbox.disabled = false;
      onError("La mise à jour a échoué. Réessaie.", error);
    }
  });
  return el("label", { className: "calendar-session-toggle" }, [
    checkbox,
    el("span", { text: "Réalisée" })
  ]);
}

function createDetailsButton(workout, { isEditing, onOpenDetails, onCloseDetails }) {
  const button = el("button", {
    className: "calendar-session-details",
    attrs: { type: "button" }
  });
  setDetailsButtonState(button, workout, isEditing());
  button.innerHTML = DETAILS_ICON;
  button.addEventListener("click", () => {
    if (isEditing()) {
      onCloseDetails();
      setDetailsButtonState(button, workout, false);
    } else {
      onOpenDetails();
      setDetailsButtonState(button, workout, true);
    }
  });
  return button;
}
