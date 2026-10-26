// Calendrier de l’accueil : vue mois, vue jour et formulaires de la journée.

import { renderCalendarGrid } from "./month-grid.js";
import { createMonthPicker } from "./month-picker.js";
import { groupMonthEventsByDate, listEventsOnDate } from "../../domain/calendar.js";
import { addDays, toDateKey } from "../../domain/dates.js";
import { getWorkoutState } from "../../domain/workouts.js";
import { el } from "../../ui/dom.js";
import { capitalize, formatLongDate, formatMonthYear } from "../../ui/format.js";
import { createPersonalRaceForm } from "../races/personal-race-form.js";
import { renderPersonalRaceCard, renderRaceCard } from "../races/race-card.js";
import { renderWorkoutCard } from "../workouts/workout-card.js";
import { createWorkoutForm } from "../workouts/workout-form.js";
import { WORKOUT_STATE_LABELS } from "../workouts/workout-labels.js";

function getEventLabel(event, todayKey) {
  if (event.eventType === "race" || event.eventType === "personalRace") {
    return `Course : ${event.name}`;
  }
  const status = WORKOUT_STATE_LABELS[getWorkoutState(event, todayKey)];
  const time = event.time ? ` à ${event.time}` : "";
  return `Entraînement ${status}${time} : ${event.title}`;
}

function getEventMarkerClass(event, todayKey) {
  if (event.eventType === "race") return "";
  if (event.eventType === "personalRace") return "calendar-session-dot";
  return `calendar-session-dot calendar-training-dot is-${getWorkoutState(event, todayKey)}`;
}

/**
 * @param {Promise<unknown>} racesPromise Chargement du catalogue, attendu avant la lecture.
 * @param {Object} repository
 * @param {(workouts: Array<Object>) => void} [onWorkoutsUpdated]
 * @returns {() => Promise<void>} Recharge les événements depuis la base.
 */
export function initializeCalendar(racesPromise, repository, onWorkoutsUpdated = () => {}) {
  const heading = document.querySelector(".calendar-heading");
  const calendarGrid = document.querySelector(".calendar-grid");
  const calendarDays = document.getElementById("calendarDays");
  const dayEvents = document.getElementById("calendarEventDetails");
  const createSection = document.getElementById("calendarCreateSection");
  const hint = document.getElementById("calendarHint");
  const titleText = document.getElementById("calendarTitleText");
  const dayTitle = document.getElementById("calendarDayTitle");
  const monthPickerToggle = document.getElementById("calendarMonthPickerToggle");
  const previousMonthButton = document.getElementById("previousMonth");
  const nextMonthButton = document.getElementById("nextMonth");
  const previousDayButton = document.getElementById("previousDay");
  const nextDayButton = document.getElementById("nextDay");
  const backToMonthButton = document.getElementById("backToMonth");
  const addRaceButton = document.getElementById("addRaceButton");
  const addWorkoutButton = document.getElementById("addTrainingButton");

  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let sources = { races: [], personalRaces: [], workouts: [] };
  let selectedDate = null;

  const monthPicker = createMonthPicker({
    input: document.getElementById("calendarMonthInput"),
    onSelect: month => {
      currentMonth.setFullYear(month.getFullYear(), month.getMonth(), 1);
      renderMonth();
    }
  });
  const raceForm = createPersonalRaceForm({
    form: document.getElementById("raceEventForm"),
    openButton: addRaceButton,
    save: race => repository.save("personalRaces", race),
    onSaved: refreshEvents
  });
  const workoutForm = createWorkoutForm({
    form: document.getElementById("trainingForm"),
    openButton: addWorkoutButton,
    save: workout => repository.save("workouts", workout),
    onSaved: refreshEvents
  });

  function showError(message, error) {
    console.error(message, error);
    hint.textContent = message;
    hint.dataset.state = "error";
    hint.hidden = false;
  }

  async function refreshEvents() {
    const [races, personalRaces, workouts] = await Promise.all([
      repository.list("raceCatalog"),
      repository.list("personalRaces"),
      repository.list("workouts")
    ]);
    onWorkoutsUpdated(workouts);
    sources = { races, personalRaces, workouts };
    hint.textContent = "";
    delete hint.dataset.state;
    hint.hidden = true;
    renderMonth();
    if (selectedDate) showDay(selectedDate);
  }

  function renderMonth() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toDateKey(today);
    titleText.textContent = capitalize(formatMonthYear(currentMonth));
    monthPicker.setMonth(currentMonth);
    renderCalendarGrid({
      container: calendarDays,
      currentMonth,
      eventsByDate: groupMonthEventsByDate(sources, currentMonth),
      today,
      onSelectDate: showDay,
      getEventLabel: event => getEventLabel(event, todayKey),
      getEventMarkerClass: event => getEventMarkerClass(event, todayKey)
    });
  }

  function renderEventCard(event) {
    if (event.eventType === "race") return renderRaceCard(event);
    if (event.eventType === "personalRace") {
      return renderPersonalRaceCard(event, {
        onEdit: () => {
          workoutForm.close();
          raceForm.open(selectedDate, event);
        },
        onDelete: async () => {
          await repository.remove("personalRaces", event.id);
          await refreshEvents();
        },
        onError: showError
      });
    }
    return renderWorkoutCard(event, {
      onDelete: async () => {
        await repository.remove("workouts", event.id);
        await refreshEvents();
      },
      onSetCompleted: async completed => {
        const { eventType, ...workout } = event;
        await repository.save("workouts", {
          ...workout,
          status: completed ? "completed" : "planned",
          completedAt: completed ? new Date().toISOString() : null
        });
        await refreshEvents();
      },
      isEditing: () => workoutForm.isEditing(event.id),
      onOpenDetails: () => {
        raceForm.close();
        workoutForm.open(selectedDate, event);
      },
      onCloseDetails: workoutForm.close,
      onError: showError
    });
  }

  function setView(view) {
    const isDay = view === "day";
    heading.classList.toggle("is-day-view", isDay);
    monthPickerToggle.hidden = isDay;
    dayTitle.hidden = !isDay;
    calendarGrid.hidden = isDay;
    dayEvents.hidden = !isDay;
    createSection.hidden = !isDay;
    previousMonthButton.hidden = isDay;
    nextMonthButton.hidden = isDay;
    previousDayButton.hidden = !isDay;
    nextDayButton.hidden = !isDay;
    backToMonthButton.hidden = !isDay;
    hint.hidden = isDay || !hint.textContent;
  }

  function showMonth() {
    raceForm.close();
    setView("month");
    selectedDate = null;
    workoutForm.close();
    renderMonth();
  }

  function showDay(date) {
    selectedDate = date;
    currentMonth.setFullYear(date.getFullYear(), date.getMonth(), 1);
    setView("day");
    dayTitle.textContent = formatLongDate(date);
    previousDayButton.setAttribute(
      "aria-label",
      `Jour précédent : ${formatLongDate(addDays(date, -1))}`
    );
    nextDayButton.setAttribute("aria-label", `Jour suivant : ${formatLongDate(addDays(date, 1))}`);

    const events = listEventsOnDate(sources, toDateKey(date));
    dayEvents.replaceChildren(
      ...(events.length
        ? events.map(renderEventCard)
        : [
            el("span", { className: "calendar-event-category", text: "JOURNÉE" }),
            el("h3", { text: "Aucun événement prévu" })
          ])
    );
  }

  function moveSelectedDay(offset) {
    if (!selectedDate) return;
    workoutForm.close();
    raceForm.close();
    showDay(addDays(selectedDate, offset));
  }

  function moveMonth(offset) {
    currentMonth.setMonth(currentMonth.getMonth() + offset);
    renderMonth();
  }

  previousMonthButton.addEventListener("click", () => moveMonth(-1));
  nextMonthButton.addEventListener("click", () => moveMonth(1));
  backToMonthButton.addEventListener("click", showMonth);
  previousDayButton.addEventListener("click", () => moveSelectedDay(-1));
  nextDayButton.addEventListener("click", () => moveSelectedDay(1));
  addRaceButton.addEventListener("click", () => {
    if (!selectedDate) return;
    workoutForm.close();
    raceForm.open(selectedDate);
  });
  addWorkoutButton.addEventListener("click", () => {
    if (!selectedDate) return;
    raceForm.close();
    workoutForm.open(selectedDate);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !calendarGrid.hidden) renderMonth();
  });

  monthPickerToggle.hidden = false;
  renderMonth();
  Promise.resolve(racesPromise)
    .then(() => refreshEvents())
    .catch(error => showError("Impossible de charger le calendrier. Réessaie.", error));

  return refreshEvents;
}
