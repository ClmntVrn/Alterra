// Carte résumée d’une séance dans la vue jour du calendrier ; le détail s’ouvre au toucher.

import { toDateKey } from "../../domain/dates.js";
import { getWorkoutState } from "../../domain/workouts.js";
import { el } from "../../ui/dom.js";
import {
  createCompletedCheck,
  formatWorkoutCategory,
  renderWorkoutStats
} from "./workout-parts.js";

/**
 * @param {Object} workout
 * @param {Object} handlers
 * @param {() => void} handlers.onOpen Ouvre le détail de la séance.
 * @param {(completed: boolean) => Promise<void>} handlers.onSetCompleted
 * @param {(message: string, error: unknown) => void} handlers.onError
 */
export function renderWorkoutCard(workout, { onOpen, onSetCompleted, onError }) {
  const state = getWorkoutState(workout, toDateKey(new Date()));
  const openButton = el("button", {
    className: "calendar-item-open",
    text: workout.title,
    attrs: { type: "button", "aria-haspopup": "dialog" }
  });
  openButton.addEventListener("click", onOpen);

  const card = el("article", { className: "calendar-item calendar-training-item" }, [
    el("span", {
      className: "calendar-event-category",
      text: formatWorkoutCategory(workout, state)
    }),
    el("h3", {}, [openButton]),
    createCompletedCheck(workout, { onSetCompleted, onError })
  ]);
  card.dataset.state = state;
  const stats = renderWorkoutStats(workout);
  if (stats) card.append(stats);
  return card;
}
