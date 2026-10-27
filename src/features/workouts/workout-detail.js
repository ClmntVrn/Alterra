// Détail complet d’une séance, affiché en plein écran depuis sa carte.

import { toDateKey } from "../../domain/dates.js";
import { getWorkoutState } from "../../domain/workouts.js";
import { el } from "../../ui/dom.js";
import { formatDateRange } from "../../ui/format.js";
import {
  createCompletedCheck,
  formatWorkoutCategory,
  renderWorkoutStats
} from "./workout-parts.js";

export const WORKOUT_DETAIL_TITLE_ID = "workoutDetailTitle";

/**
 * @param {Object} workout
 * @param {Object} handlers
 * @param {() => void} handlers.onEdit
 * @param {() => Promise<void>} handlers.onDelete
 * @param {(completed: boolean) => Promise<void>} handlers.onSetCompleted
 * @param {(message: string, error: unknown) => void} handlers.onError
 */
export function renderWorkoutDetail(workout, { onEdit, onDelete, onSetCompleted, onError }) {
  const state = getWorkoutState(workout, toDateKey(new Date()));
  const editButton = el("button", {
    className: "training-save-button",
    text: "Modifier",
    attrs: { type: "button" }
  });
  editButton.addEventListener("click", onEdit);

  const completed = createCompletedCheck(workout, { onSetCompleted, onError });
  completed.append(el("span", { text: "Réalisée" }));
  const actions = el("div", { className: "workout-detail-actions" }, [completed, editButton]);
  // Une séance réalisée ne se supprime pas : la repasser d’abord en « prévue ».
  if (workout.status === "planned") actions.append(createDeleteButton(workout, onDelete, onError));

  const detail = el("article", { className: "workout-detail" }, [
    el("span", {
      className: "calendar-event-category",
      text: formatWorkoutCategory(workout, state)
    }),
    el("h3", { text: workout.title, attrs: { id: WORKOUT_DETAIL_TITLE_ID } }),
    el("p", {
      className: "workout-detail-when",
      text: [formatDateRange(workout.date, workout.endDate), workout.time]
        .filter(Boolean)
        .join(" · ")
    })
  ]);
  detail.dataset.state = state;
  const stats = renderWorkoutStats(workout, { full: true });
  if (stats) detail.append(stats);
  if (workout.notes) {
    detail.append(el("p", { className: "workout-detail-notes", text: workout.notes }));
  }
  detail.append(actions);
  return detail;
}

function createDeleteButton(workout, onDelete, onError) {
  const button = el("button", {
    className: "workout-delete-button",
    text: "Supprimer",
    attrs: { type: "button" }
  });
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
