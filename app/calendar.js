import { createMonthYearPicker, renderCalendarGrid } from "../components/calendar/calendar.js";

const calendarDays = document.getElementById("calendarDays");
const calendarGrid = document.querySelector(".calendar-grid");
const calendarEventDetails = document.getElementById("calendarEventDetails");
const calendarCreateSection = document.getElementById("calendarCreateSection");
const calendarHint = document.getElementById("calendarHint");
const addRaceButton = document.getElementById("addRaceButton");
const raceEventForm = document.getElementById("raceEventForm");
const raceEventFormTitle = document.getElementById("raceEventFormTitle");
const raceEventFormStatus = document.getElementById("raceEventFormStatus");
const cancelRaceEventButton = document.getElementById("cancelRaceEventButton");
const addTrainingButton = document.getElementById("addTrainingButton");
const trainingForm = document.getElementById("trainingForm");
const trainingFormTitle = document.getElementById("trainingFormTitle");
const trainingFormStatus = document.getElementById("trainingFormStatus");
const cancelTrainingButton = document.getElementById("cancelTrainingButton");
const trainingComputed = document.getElementById("trainingComputed");
const trainingCompletedFields = document.getElementById("trainingCompletedFields");
const previousMonthButton = document.getElementById("previousMonth");
const nextMonthButton = document.getElementById("nextMonth");
const monthPickerToggle = document.getElementById("calendarMonthPickerToggle");
const monthPickerForm = document.getElementById("calendarMonthPicker");
const monthWheel = document.getElementById("calendarMonthWheel");
const yearWheel = document.getElementById("calendarYearWheel");
const calendarTitleText = document.getElementById("calendarTitleText");
const calendarDayTitle = document.getElementById("calendarDayTitle");
const previousDayButton = document.getElementById("previousDay");
const nextDayButton = document.getElementById("nextDay");
const backToMonthButton = document.getElementById("backToMonth");
const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let eventsByDate = {};
let calendarRaces = [];
let calendarPersonalRaces = [];
let calendarSessions = [];
let selectedDate = null;
let repository = null;
let editingSession = null;
let editingPersonalRace = null;
let selectedEffort = "";
let monthYearPicker = null;
let sessionsUpdated = () => {};

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric"
});
const eventDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric"
});
const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short"
});
const maxDurationMinutes = 9999 * 60 + 59;
const sessionStateLabels = Object.freeze({
  planned: "prévu",
  completed: "réalisé",
  toCheck: "à vérifier"
});

const trainingTypes = Object.freeze({
  trail: "Trail",
  running: "Course à pied",
  strength: "Renforcement musculaire",
  cycling: "Vélo"
});

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function dateInRange(date, startDate, endDate = startDate) {
  return date >= startDate && date <= endDate;
}

function formatDateRange(startDate, endDate) {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate || startDate);
  if (!start || !end || startDate === (endDate || startDate)) {
    return start ? eventDateFormatter.format(start) : "";
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = sameYear
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(start)
    : eventDateFormatter.format(start);
  return `${startText} – ${eventDateFormatter.format(end)}`;
}

function parseCalendarDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
}

// Accepte 45 (minutes), 130 ou 1:30 ou 1h30 (1 h 30), 1020 (10 h 20) et 90min.
function parseDurationInput(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  let hours = 0;
  let minutes;
  let match;
  if ((match = /^(\d{1,4})[:h](\d{1,2})?$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2] || 0);
    if (minutes > 59) return NaN;
  } else if ((match = /^(\d{1,4})(?:min|mn|m)$/.exec(text))) {
    minutes = Number(match[1]);
  } else if (/^\d{1,6}$/.test(text)) {
    if (text.length <= 2) {
      minutes = Number(text);
    } else {
      hours = Number(text.slice(0, -2));
      minutes = Number(text.slice(-2));
      if (minutes > 59) return NaN;
    }
  } else {
    return NaN;
  }
  const total = hours * 60 + minutes;
  return total > 0 && total <= maxDurationMinutes ? total : NaN;
}

function formatDurationInput(durationMinutes) {
  const totalMinutes = Math.round(durationMinutes);
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function formatDurationText(durationMinutes) {
  const totalMinutes = Math.round(durationMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} h${minutes ? ` ${minutes}` : ""}` : `${minutes} min`;
}

// Retourne "" si vide, "HH:mm" si valide, null sinon. Accepte 9, 930, 9h30 et 09:30.
function parseTimeInput(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return "";
  const match = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(text) || /^(\d{1,2})(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function computeSessionEnd(date, time, durationMinutes) {
  const start = parseCalendarDate(date);
  if (!start || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { endDate: date, endTime: null };
  }
  const [hours, minutes] = time ? time.split(":").map(Number) : [0, 0];
  const startMinutes = hours * 60 + minutes;
  const end = new Date(start);
  end.setDate(end.getDate() + Math.floor((startMinutes + durationMinutes - 1) / 1440));
  const endMinutes = Math.round(startMinutes + durationMinutes) % 1440;
  return {
    endDate: dateKey(end),
    endTime: time
      ? `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`
      : null
  };
}

function getSessionState(session) {
  if (session.status === "completed") return "completed";
  return (session.endDate || session.date) < dateKey(new Date()) ? "toCheck" : "planned";
}

function formatHeartRate(session) {
  const average = Number.isFinite(session.heartRateAvg) ? session.heartRateAvg : null;
  const maximum = Number.isFinite(session.heartRateMax) ? session.heartRateMax : null;
  if (average && maximum) return `FC moy. ${average} · max ${maximum} bpm`;
  if (average) return `FC moy. ${average} bpm`;
  if (maximum) return `FC max ${maximum} bpm`;
  return "";
}

function showLoadedEvents(races, personalRaces, sessions) {
  sessionsUpdated(sessions);
  calendarRaces = races;
  calendarPersonalRaces = personalRaces;
  calendarSessions = sessions;
  calendarHint.textContent = "";
  delete calendarHint.dataset.state;
  calendarHint.hidden = true;
  renderCalendar();
  if (selectedDate) showDayDetails(selectedDate);
}

function getDayEvents(date) {
  const key = dateKey(date);
  return [
    ...calendarRaces
      .filter(race => dateInRange(key, race.date, race.endDate))
      .map(race => ({ ...race, eventType: "race" })),
    ...calendarPersonalRaces
      .filter(race => typeof race.name === "string" &&
        parseCalendarDate(race.date) && dateInRange(key, race.date, race.endDate))
      .map(race => ({ ...race, eventType: "personalRace" })),
    ...calendarSessions
      .filter(session => dateInRange(key, session.date, session.endDate))
      .map(session => ({ ...session, eventType: "training" }))
  ].sort(compareEventTimes);
}

function buildMonthEvents(currentMonth) {
  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();
  const monthStart = dateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
  const monthEnd = dateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), daysInMonth));
  const events = {};
  const allEvents = [
    ...calendarRaces.map(race => ({ ...race, eventType: "race" })),
    ...calendarPersonalRaces.map(race => ({ ...race, eventType: "personalRace" })),
    ...calendarSessions.map(session => ({ ...session, eventType: "training" }))
  ];
  for (const event of allEvents) {
    const startDate = event.date;
    const endDate = event.endDate || startDate;
    if (endDate < monthStart || startDate > monthEnd) continue;
    const start = parseCalendarDate(startDate < monthStart ? monthStart : startDate);
    const end = parseCalendarDate(endDate > monthEnd ? monthEnd : endDate);
    if (!start || !end) continue;
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const key = dateKey(day);
      (events[key] ||= []).push(event);
    }
  }
  for (const dayEvents of Object.values(events)) dayEvents.sort(compareEventTimes);
  return events;
}

function compareEventTimes(left, right) {
  const leftTime = left.eventType === "race" ? left.startTime : left.time;
  const rightTime = right.eventType === "race" ? right.startTime : right.time;
  const validLeftTime = typeof leftTime === "string" && leftTime ? leftTime : null;
  const validRightTime = typeof rightTime === "string" && rightTime ? rightTime : null;
  if (!validLeftTime) return validRightTime ? 1 : 0;
  if (!validRightTime) return -1;
  return validLeftTime.localeCompare(validRightTime);
}

function showMonthView() {
  monthYearPicker.close();
  closeRaceEventForm();
  document.querySelector(".calendar-heading").classList.remove("is-day-view");
  monthPickerToggle.hidden = false;
  calendarDayTitle.hidden = true;
  calendarGrid.hidden = false;
  calendarEventDetails.hidden = true;
  calendarCreateSection.hidden = true;
  calendarHint.hidden = !calendarHint.textContent;
  previousMonthButton.hidden = false;
  nextMonthButton.hidden = false;
  previousDayButton.hidden = true;
  nextDayButton.hidden = true;
  backToMonthButton.hidden = true;
  selectedDate = null;
  closeTrainingForm();
  renderCalendar();
}

function formatTrainingSummary(session) {
  return [
    session.time,
    trainingTypes[session.type] || "Entraînement"
  ].filter(Boolean);
}

function formatTrainingTargets(session) {
  const details = [];
  if (Number.isFinite(session.distanceKm)) {
    details.push(`${Number(session.distanceKm).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`);
  }
  if (Number.isFinite(session.durationMinutes)) {
    details.push(formatDurationText(session.durationMinutes));
  }
  if (Number.isFinite(session.ascentMeters)) {
    details.push(`${Number(session.ascentMeters).toLocaleString("fr-FR")} m D+`);
  }
  return details.join(" · ");
}

function formatPace(distanceKm, durationMinutes) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 ||
      !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return "";
  }
  const secondsPerKm = Math.round(durationMinutes * 60 / distanceKm);
  const paceMinutes = Math.floor(secondsPerKm / 60);
  const paceSeconds = String(secondsPerKm % 60).padStart(2, "0");
  return `${paceMinutes}:${paceSeconds} min/km`;
}

function renderRaceEvent(race) {
  const card = document.createElement("article");
  card.className = "calendar-item calendar-race-item";
  const category = document.createElement("span");
  category.className = "calendar-event-category";
  category.textContent = [
    race.startTime,
    race.organizer ? `COURSE · ${race.organizer}` : "COURSE"
  ].filter(Boolean).join(" · ");
  const title = document.createElement("h3");
  title.textContent = race.name;
  const details = document.createElement("p");
  details.className = "calendar-event-description";
  details.textContent = `${formatDateRange(race.date, race.endDate)} · ${race.calendarDetails}`;
  const openPlan = document.createElement("a");
  openPlan.className = "calendar-event-link";
  openPlan.href = `./races/race.html?id=${encodeURIComponent(race.id)}`;
  openPlan.textContent = "Ouvrir le plan de course";
  openPlan.setAttribute("aria-label", `Ouvrir la fiche de ${race.name}`);
  card.append(category, title, details, openPlan);
  return card;
}

function renderPersonalRaceEvent(race) {
  const card = document.createElement("article");
  card.className = "calendar-item calendar-race-item";
  const header = document.createElement("div");
  header.className = "calendar-training-header";
  const category = document.createElement("span");
  category.className = "calendar-event-category";
  category.textContent = "COURSE";
  header.append(category);
  const actions = document.createElement("div");
  actions.className = "calendar-session-actions";
  const editButton = document.createElement("button");
  editButton.className = "calendar-session-details";
  editButton.type = "button";
  editButton.textContent = "Modifier";
  editButton.setAttribute("aria-label", `Modifier la course : ${race.name}`);
  editButton.addEventListener("click", () => openRaceEventForm(race));
  const deleteButton = document.createElement("button");
  deleteButton.className = "calendar-delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", `Supprimer la course : ${race.name}`);
  deleteButton.title = "Supprimer la course";
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Supprimer la course « ${race.name} » ? Cette action est définitive.`)) return;
    deleteButton.disabled = true;
    try {
      await repository.remove("raceEvents", race.id);
      await refreshEvents();
    } catch (error) {
      console.error("Impossible de supprimer la course.", error);
      deleteButton.disabled = false;
      calendarHint.textContent = "La suppression a échoué. Réessaie.";
      calendarHint.dataset.state = "error";
      calendarHint.hidden = false;
    }
  });
  actions.append(editButton, deleteButton);
  const title = document.createElement("h3");
  title.textContent = race.name;
  const details = document.createElement("p");
  details.className = "calendar-event-description";
  details.textContent = formatDateRange(race.date, race.endDate);
  card.append(header, title, details, actions);
  return card;
}

function renderTrainingEvent(session) {
  const card = document.createElement("article");
  card.className = "calendar-item calendar-training-item";
  const state = getSessionState(session);
  card.dataset.state = state;
  const header = document.createElement("div");
  header.className = "calendar-training-header";
  const category = document.createElement("span");
  category.className = "calendar-event-category";
  category.textContent = `ENTRAÎNEMENT · ${sessionStateLabels[state].toLocaleUpperCase("fr-FR")}`;
  header.append(category);
  if (session.status === "planned") {
    const deleteButton = document.createElement("button");
    deleteButton.className = "calendar-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Supprimer la séance : ${session.title}`);
    deleteButton.title = "Supprimer la séance";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer l’entraînement « ${session.title} » ? Cette action est définitive.`)) {
        return;
      }
      deleteButton.disabled = true;
      try {
        await repository.remove("plannedSessions", session.id);
        await refreshEvents();
      } catch (error) {
        console.error("Impossible de supprimer l’entraînement.", error);
        deleteButton.disabled = false;
        calendarHint.textContent = "La suppression a échoué. Réessaie.";
        calendarHint.dataset.state = "error";
        calendarHint.hidden = false;
      }
    });
    header.append(deleteButton);
  }
  card.append(header);
  const title = document.createElement("h3");
  title.textContent = session.title;
  card.append(title);
  const summary = document.createElement("p");
  summary.className = "calendar-event-description calendar-training-description";
  summary.textContent = [
    formatDateRange(session.date, session.endDate),
    ...formatTrainingSummary(session)
  ].filter(Boolean).join(" · ");
  card.append(summary);
  const targets = formatTrainingTargets(session);
  const pace = formatPace(session.distanceKm, session.durationMinutes);
  const details = [targets, session.status === "completed" ? pace : ""].filter(Boolean).join(" · ");
  if (details) {
    const targetDetails = document.createElement("p");
    targetDetails.className = "calendar-event-description calendar-training-targets";
    targetDetails.textContent = details;
    card.append(targetDetails);
  }
  if (session.status === "completed") {
    const feeling = [
      Number.isFinite(session.perceivedEffort) ? `Ressenti ${session.perceivedEffort}/10` : "",
      formatHeartRate(session)
    ].filter(Boolean).join(" · ");
    if (feeling) {
      const feelingDetails = document.createElement("p");
      feelingDetails.className = "calendar-event-description calendar-training-targets";
      feelingDetails.textContent = feeling;
      card.append(feelingDetails);
    }
  }
  if (session.notes) {
    const notes = document.createElement("p");
    notes.className = "calendar-event-description calendar-training-notes";
    notes.textContent = session.notes;
    card.append(notes);
  }
  const actions = document.createElement("div");
  actions.className = "calendar-session-actions";
  const statusLabel = document.createElement("label");
  statusLabel.className = "calendar-session-toggle";
  const statusCheckbox = document.createElement("input");
  statusCheckbox.type = "checkbox";
  statusCheckbox.checked = session.status === "completed";
  statusCheckbox.setAttribute(
    "aria-label",
    `${statusCheckbox.checked ? "Remettre à faire" : "Marquer comme réalisée"} : ${session.title}`
  );
  const statusText = document.createElement("span");
  statusText.textContent = "Réalisée";
  statusLabel.append(statusCheckbox, statusText);
  statusCheckbox.addEventListener("change", async () => {
    statusCheckbox.disabled = true;
    try {
      const completed = statusCheckbox.checked;
      const { eventType, ...record } = session;
      await repository.save("plannedSessions", {
        ...record,
        status: completed ? "completed" : "planned",
        ...(completed ? { completedAt: new Date().toISOString() } : { completedAt: null })
      });
      await refreshEvents();
    } catch (error) {
      console.error("Impossible de mettre à jour l’entraînement.", error);
      statusCheckbox.checked = session.status === "completed";
      statusCheckbox.disabled = false;
      calendarHint.textContent = "La mise à jour a échoué. Réessaie.";
      calendarHint.dataset.state = "error";
      calendarHint.hidden = false;
    }
  });
  const detailsButton = document.createElement("button");
  detailsButton.className = "calendar-session-details";
  detailsButton.type = "button";
  const detailsAreOpen = editingSession?.id === session.id;
  detailsButton.title = detailsAreOpen ? "Fermer les détails" : "Détails et modification";
  detailsButton.setAttribute("aria-expanded", String(detailsAreOpen));
  detailsButton.setAttribute("aria-label", detailsAreOpen
    ? `Fermer les détails de la séance : ${session.title}`
    : `Détails de la séance : ${session.title}. Ouvrir pour modifier.`);
  detailsButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
  detailsButton.addEventListener("click", () => {
    if (editingSession?.id === session.id) {
      closeTrainingForm();
      detailsButton.title = "Détails et modification";
      detailsButton.setAttribute("aria-expanded", "false");
      detailsButton.setAttribute(
        "aria-label",
        `Détails de la séance : ${session.title}. Ouvrir pour modifier.`
      );
      return;
    }
    openTrainingForm(session);
    detailsButton.title = "Fermer les détails";
    detailsButton.setAttribute("aria-expanded", "true");
    detailsButton.setAttribute(
      "aria-label",
      `Fermer les détails de la séance : ${session.title}`
    );
  });
  actions.append(statusLabel, detailsButton);
  card.append(actions);
  return card;
}

function showDayDetails(date) {
  selectedDate = date;
  currentMonth.setFullYear(date.getFullYear(), date.getMonth(), 1);
  document.querySelector(".calendar-heading").classList.add("is-day-view");
  const events = getDayEvents(date);
  calendarDayTitle.textContent = eventDateFormatter.format(date);
  calendarDayTitle.hidden = false;
  monthPickerToggle.hidden = true;
  monthYearPicker.close();
  calendarGrid.hidden = true;
  calendarEventDetails.replaceChildren();
  calendarEventDetails.hidden = false;
  calendarCreateSection.hidden = false;
  calendarHint.hidden = true;
  previousMonthButton.hidden = true;
  nextMonthButton.hidden = true;
  previousDayButton.hidden = false;
  nextDayButton.hidden = false;
  backToMonthButton.hidden = false;
  previousDayButton.setAttribute("aria-label", `Jour précédent : ${eventDateFormatter.format(previousDate(date))}`);
  nextDayButton.setAttribute("aria-label", `Jour suivant : ${eventDateFormatter.format(nextDate(date))}`);

  if (events.length) {
    for (const event of events) {
      calendarEventDetails.append(event.eventType === "race"
        ? renderRaceEvent(event)
        : event.eventType === "personalRace"
          ? renderPersonalRaceEvent(event)
          : renderTrainingEvent(event));
    }
  } else {
    const category = document.createElement("span");
    category.className = "calendar-event-category";
    category.textContent = "JOURNÉE";

    const title = document.createElement("h3");
    title.textContent = "Aucun événement prévu";

    calendarEventDetails.append(category, title);
  }
}

function previousDate(date) {
  const adjacent = new Date(date);
  adjacent.setDate(adjacent.getDate() - 1);
  return adjacent;
}

function nextDate(date) {
  const adjacent = new Date(date);
  adjacent.setDate(adjacent.getDate() + 1);
  return adjacent;
}

function moveSelectedDay(offset) {
  if (!selectedDate) return;
  const adjacent = new Date(selectedDate);
  adjacent.setDate(adjacent.getDate() + offset);
  closeTrainingForm();
  closeRaceEventForm();
  showDayDetails(adjacent);
}

function closeTrainingForm() {
  trainingForm.reset();
  trainingForm.hidden = true;
  trainingFormStatus.textContent = "";
  delete trainingFormStatus.dataset.state;
  editingSession = null;
  selectedEffort = "";
  addTrainingButton.hidden = false;
  trainingComputed.textContent = "";
  trainingComputed.hidden = true;
  trainingCompletedFields.hidden = true;
}

function syncCompletedFields() {
  trainingCompletedFields.hidden = !trainingForm.elements.namedItem("completed").checked;
}

function closeRaceEventForm() {
  raceEventForm.reset();
  raceEventForm.hidden = true;
  raceEventFormStatus.textContent = "";
  delete raceEventFormStatus.dataset.state;
  editingPersonalRace = null;
  addRaceButton.hidden = false;
}

function updateDateRangeValidity(form) {
  const startField = form.elements.namedItem("date");
  const endField = form.elements.namedItem("endDate");
  const startDate = startField.value;
  const endDate = endField.value;
  const rangeIsValid = !startDate || !endDate || endDate >= startDate;
  endField.min = startDate;
  startField.setCustomValidity(rangeIsValid ? "" : "La date de début doit précéder la date de fin.");
  endField.setCustomValidity(rangeIsValid ? "" : "La date de fin doit être égale ou postérieure à la date de début.");
}

function updateTrainingComputed() {
  const timeField = trainingForm.elements.namedItem("time");
  const time = parseTimeInput(timeField.value);
  timeField.setCustomValidity(
    time === null ? "Saisis une heure entre 00:00 et 23:59, par exemple 930 pour 09:30." : ""
  );
  const durationField = trainingForm.elements.namedItem("duration");
  const durationMinutes = parseDurationInput(durationField.value);
  durationField.setCustomValidity(Number.isNaN(durationMinutes)
    ? "Saisis une durée comme 45 (minutes), 130 (1:30) ou 1020 (10:20)."
    : "");

  const heartRateAvgField = trainingForm.elements.namedItem("heartRateAvg");
  const heartRateMaxField = trainingForm.elements.namedItem("heartRateMax");
  heartRateMaxField.setCustomValidity(
    heartRateAvgField.value && heartRateMaxField.value &&
      Number(heartRateMaxField.value) < Number(heartRateAvgField.value)
      ? "La FC max doit être supérieure ou égale à la FC moyenne."
      : ""
  );

  const distanceField = trainingForm.elements.namedItem("distanceKm");
  const distanceValue = distanceField.value.trim();
  const distanceKm = parseLocalizedDecimal(distanceValue);
  const isInRange = !distanceValue ||
    (Number.isFinite(distanceKm) && distanceKm >= 0.1 && distanceKm <= 1000 &&
      /^\d+(?:[,.]\d{1,2})?$/.test(distanceValue));
  distanceField.setCustomValidity(
    isInRange ? "" : "Saisis une distance entre 0,1 et 1 000 km, avec au maximum deux décimales."
  );
  const computed = [];
  if (durationMinutes) computed.push(formatDurationText(durationMinutes));
  const pace = formatPace(distanceKm, durationMinutes);
  if (pace) computed.push(`Allure ${pace}`);
  const date = trainingForm.elements.namedItem("date").value;
  if (durationMinutes && time !== null) {
    const { endDate, endTime } = computeSessionEnd(date, time, durationMinutes);
    const endDay = parseCalendarDate(endDate);
    if (endDate === date && endTime) computed.push(`Fin ${endTime}`);
    else if (endDate !== date && endDay) {
      computed.push(`Fin le ${shortDateFormatter.format(endDay)}${endTime ? ` à ${endTime}` : ""}`);
    }
  }
  trainingComputed.textContent = computed.join(" · ");
  trainingComputed.hidden = !computed.length;
}

function parseLocalizedDecimal(value) {
  const normalizedValue = String(value).trim().replace(",", ".");
  return normalizedValue ? Number(normalizedValue) : NaN;
}

function openTrainingForm(session = null) {
  closeRaceEventForm();
  closeTrainingForm();
  editingSession = session ? { ...session } : null;
  trainingFormTitle.textContent = session
    ? `Modifier · ${session.title}`
    : `Entraînement du ${eventDateFormatter.format(selectedDate)}`;
  trainingForm.elements.namedItem("date").value = session?.date || dateKey(selectedDate);
  if (session) {
    for (const field of ["title", "type", "time", "ascentMeters", "heartRateAvg", "heartRateMax", "weather", "notes"]) {
      trainingForm.elements.namedItem(field).value = session[field] ?? "";
    }
    if (Number.isFinite(session.distanceKm)) {
      trainingForm.elements.namedItem("distanceKm").value = String(session.distanceKm).replace(".", ",");
    }
    if (Number.isFinite(session.durationMinutes) && session.durationMinutes > 0) {
      trainingForm.elements.namedItem("duration").value = formatDurationInput(session.durationMinutes);
    }
    if (Number.isFinite(session.perceivedEffort)) {
      trainingForm.elements.namedItem("perceivedEffort").value = String(session.perceivedEffort);
      selectedEffort = String(session.perceivedEffort);
    }
    trainingForm.elements.namedItem("completed").checked = session.status === "completed";
  }
  syncCompletedFields();
  updateTrainingComputed();
  trainingForm.hidden = false;
  addTrainingButton.hidden = true;
  trainingForm.querySelector('[name="type"]:checked').focus();
}

function openRaceEventForm(race = null) {
  closeTrainingForm();
  closeRaceEventForm();
  editingPersonalRace = race ? { ...race } : null;
  raceEventFormTitle.textContent = race ? `Modifier · ${race.name}` : "Nouvelle course";
  raceEventForm.elements.namedItem("name").value = race?.name || "";
  raceEventForm.elements.namedItem("date").value = race?.date || dateKey(selectedDate);
  raceEventForm.elements.namedItem("endDate").value =
    race?.endDate || race?.date || dateKey(selectedDate);
  raceEventForm.hidden = false;
  addRaceButton.hidden = true;
  updateDateRangeValidity(raceEventForm);
  raceEventForm.elements.namedItem("name").focus();
}

async function refreshEvents() {
  const [races, personalRaces, sessions] = await Promise.all([
    repository.list("raceCatalog"),
    repository.list("raceEvents"),
    repository.list("plannedSessions")
  ]);
  showLoadedEvents(races, personalRaces, sessions);
}

function renderCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedMonth = monthFormatter.format(currentMonth);
  calendarTitleText.textContent =
    formattedMonth.charAt(0).toLocaleUpperCase("fr-FR") +
    formattedMonth.slice(1);
  eventsByDate = buildMonthEvents(currentMonth);
  renderCalendarGrid({
    container: calendarDays,
    currentMonth,
    eventsByDate,
    today,
    onSelectDate: showDayDetails,
    getEventLabel: event => {
      if (event.eventType === "race") return `Course : ${event.name}`;
      if (event.eventType === "personalRace") return `Course : ${event.name}`;
      const status = sessionStateLabels[getSessionState(event)];
      const time = event.time ? ` à ${event.time}` : "";
      return `Entraînement ${status}${time} : ${event.title}`;
    },
    getEventMarkerClass: event => {
      if (event.eventType === "race") return "";
      if (event.eventType === "personalRace") return "calendar-session-dot";
      return `calendar-session-dot calendar-training-dot is-${getSessionState(event)}`;
    }
  });
}

export function initializeCalendar(racesPromise, personalRepository, onSessionsUpdated = () => {}) {
  repository = personalRepository;
  sessionsUpdated = onSessionsUpdated;
  monthYearPicker = createMonthYearPicker({
    toggle: monthPickerToggle,
    form: monthPickerForm,
    monthWheel,
    yearWheel,
    currentMonth,
    onApply: renderCalendar
  });
  previousMonthButton.addEventListener("click", () => {
    monthYearPicker.close();
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  nextMonthButton.addEventListener("click", () => {
    monthYearPicker.close();
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });
  backToMonthButton.addEventListener("click", showMonthView);
  previousDayButton.addEventListener("click", () => moveSelectedDay(-1));
  nextDayButton.addEventListener("click", () => moveSelectedDay(1));
  addRaceButton.addEventListener("click", () => {
    if (!selectedDate) return;
    openRaceEventForm();
  });
  addTrainingButton.addEventListener("click", () => {
    if (!selectedDate) return;
    openTrainingForm();
  });
  cancelRaceEventButton.addEventListener("click", closeRaceEventForm);
  raceEventForm.elements.namedItem("date").addEventListener("input", () => updateDateRangeValidity(raceEventForm));
  raceEventForm.elements.namedItem("endDate").addEventListener("input", () => updateDateRangeValidity(raceEventForm));
  raceEventForm.addEventListener("submit", async event => {
    event.preventDefault();
    updateDateRangeValidity(raceEventForm);
    if (!raceEventForm.reportValidity()) return;
    const formData = new FormData(raceEventForm);
    const race = {
      ...(editingPersonalRace || {}),
      id: editingPersonalRace?.id || crypto.randomUUID(),
      name: String(formData.get("name")).trim(),
      date: String(formData.get("date")),
      createdAt: editingPersonalRace?.createdAt || new Date().toISOString()
    };
    const endDate = String(formData.get("endDate"));
    if (endDate > race.date) race.endDate = endDate;
    else delete race.endDate;
    const isEditing = Boolean(editingPersonalRace);
    const saveButton = raceEventForm.querySelector('[type="submit"]');
    saveButton.disabled = true;
    raceEventFormStatus.textContent = "Enregistrement…";
    try {
      await repository.save("raceEvents", race);
      closeRaceEventForm();
      await refreshEvents();
    } catch (error) {
      console.error(isEditing ? "Impossible de modifier la course." : "Impossible d’enregistrer la course.", error);
      raceEventFormStatus.textContent = isEditing
        ? "La modification a échoué. Vérifie le stockage de cet appareil."
        : "L’enregistrement a échoué. Vérifie le stockage de cet appareil.";
      raceEventFormStatus.dataset.state = "error";
    } finally {
      saveButton.disabled = false;
    }
  });
  cancelTrainingButton.addEventListener("click", closeTrainingForm);
  trainingForm.addEventListener("input", updateTrainingComputed);
  trainingForm.elements.namedItem("completed").addEventListener("change", syncCompletedFields);
  for (const fieldName of ["time", "duration"]) {
    const field = trainingForm.elements.namedItem(fieldName);
    field.addEventListener("blur", () => {
      if (fieldName === "time") {
        const time = parseTimeInput(field.value);
        if (time) field.value = time;
      } else {
        const durationMinutes = parseDurationInput(field.value);
        if (durationMinutes) field.value = formatDurationInput(durationMinutes);
      }
      updateTrainingComputed();
    });
  }
  for (const radio of trainingForm.elements.namedItem("perceivedEffort")) {
    radio.addEventListener("click", () => {
      if (radio.value === selectedEffort) {
        radio.checked = false;
        selectedEffort = "";
      } else {
        selectedEffort = radio.value;
      }
    });
  }
  trainingForm.addEventListener("submit", async event => {
    event.preventDefault();
    updateTrainingComputed();
    if (!selectedDate || !trainingForm.reportValidity()) return;
    const formData = new FormData(trainingForm);
    const type = String(formData.get("type"));
    const time = parseTimeInput(formData.get("time"));
    const durationMinutes = parseDurationInput(formData.get("duration"));
    const session = {
      ...(editingSession || {}),
      id: editingSession?.id || crypto.randomUUID(),
      date: String(formData.get("date")),
      type,
      title: String(formData.get("title")).trim() || trainingTypes[type] || "Entraînement",
      status: formData.get("completed") === "on" ? "completed" : "planned",
      createdAt: editingSession?.createdAt || new Date().toISOString()
    };
    const { endDate } = computeSessionEnd(session.date, time, durationMinutes);
    if (endDate > session.date) session.endDate = endDate;
    else delete session.endDate;
    delete session.eventType;
    if (session.status === "completed") {
      session.completedAt = editingSession?.completedAt || new Date().toISOString();
    } else {
      delete session.completedAt;
    }
    if (time) session.time = time;
    else delete session.time;
    if (durationMinutes) session.durationMinutes = durationMinutes;
    else delete session.durationMinutes;
    const distanceValue = String(formData.get("distanceKm")).trim();
    if (distanceValue) session.distanceKm = parseLocalizedDecimal(distanceValue);
    else delete session.distanceKm;
    const ascentValue = String(formData.get("ascentMeters")).trim();
    if (ascentValue) session.ascentMeters = Number(ascentValue);
    else delete session.ascentMeters;
    // Le ressenti, la FC et la météo ne concernent qu’une séance réalisée.
    for (const field of ["perceivedEffort", "heartRateAvg", "heartRateMax"]) {
      const value = session.status === "completed" ? String(formData.get(field) ?? "").trim() : "";
      if (value) session[field] = Number(value);
      else delete session[field];
    }
    const weather = session.status === "completed" ? String(formData.get("weather")) : "";
    if (weather) session.weather = weather;
    else delete session.weather;
    const notes = String(formData.get("notes")).trim();
    if (notes) session.notes = notes;
    else delete session.notes;
    const isEditing = Boolean(editingSession);
    const saveButton = trainingForm.querySelector('[type="submit"]');
    saveButton.disabled = true;
    trainingFormStatus.textContent = "Enregistrement…";
    delete trainingFormStatus.dataset.state;
    try {
      await repository.save("plannedSessions", session);
      closeTrainingForm();
      await refreshEvents();
    } catch (error) {
      console.error(isEditing ? "Impossible de modifier l’entraînement." : "Impossible d’enregistrer l’entraînement.", error);
      trainingFormStatus.textContent = isEditing
        ? "La modification a échoué. Vérifie le stockage de cet appareil."
        : "L’enregistrement a échoué. Vérifie le stockage de cet appareil.";
      trainingFormStatus.dataset.state = "error";
    } finally {
      saveButton.disabled = false;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !calendarGrid.hidden) renderCalendar();
  });

  monthPickerToggle.hidden = false;
  renderCalendar();
  monthYearPicker.sync(currentMonth, true);
  Promise.resolve(racesPromise)
    .then(() => refreshEvents())
    .catch(error => {
      console.error("Impossible de charger le calendrier.", error);
      calendarHint.textContent = "Impossible de charger le calendrier. Réessaie.";
      calendarHint.hidden = false;
    });

  return async () => {
    await refreshEvents();
  };
}
