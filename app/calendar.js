import { createMonthYearPicker, renderCalendarGrid } from "../components/calendar/calendar.js";

const calendarDays = document.getElementById("calendarDays");
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.querySelector(".calendar-grid");
const calendarEventDetails = document.getElementById("calendarEventDetails");
const calendarCreateSection = document.getElementById("calendarCreateSection");
const calendarHint = document.getElementById("calendarHint");
const addTrainingButton = document.getElementById("addTrainingButton");
const trainingForm = document.getElementById("trainingForm");
const trainingFormTitle = document.getElementById("trainingFormTitle");
const trainingFormStatus = document.getElementById("trainingFormStatus");
const cancelTrainingButton = document.getElementById("cancelTrainingButton");
const trainingPace = document.getElementById("trainingPace");
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
let selectedDate = null;
let repository = null;
let editingSession = null;
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

const trainingTypes = Object.freeze({
  trail: "Trail",
  running: "Course à pied",
  strength: "Renforcement musculaire",
  cycling: "Vélo"
});
const weatherConditions = Object.freeze({
  sunny: "Ensoleillé",
  cloudy: "Nuageux",
  rain: "Pluie",
  snow: "Neige",
  wind: "Vent",
  storm: "Orage"
});

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function showLoadedEvents(races, sessions) {
  sessionsUpdated(sessions);
  eventsByDate = {};
  for (const race of races) {
    const events = eventsByDate[race.date] || [];
    events.push({ ...race, eventType: "race" });
    eventsByDate[race.date] = events;
  }
  for (const session of sessions) {
    const events = eventsByDate[session.date] || [];
    events.push({ ...session, eventType: "training" });
    eventsByDate[session.date] = events;
  }
  Object.values(eventsByDate).forEach(events => {
    events.sort((left, right) => {
      const leftTime = left.eventType === "race" ? left.startTime : left.time;
      const rightTime = right.eventType === "race" ? right.startTime : right.time;
      const validLeftTime = typeof leftTime === "string" && leftTime ? leftTime : null;
      const validRightTime = typeof rightTime === "string" && rightTime ? rightTime : null;
      if (!validLeftTime) return validRightTime ? 1 : 0;
      if (!validRightTime) return -1;
      return validLeftTime.localeCompare(validRightTime);
    });
  });
  calendarHint.textContent = "";
  delete calendarHint.dataset.state;
  calendarHint.hidden = true;
  renderCalendar();
  if (selectedDate) showDayDetails(selectedDate);
}

function showMonthView() {
  monthYearPicker.close();
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
    const totalMinutes = Math.round(session.durationMinutes);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    details.push(hours ? `${hours} h${minutes ? ` ${minutes}` : ""}` : `${minutes} min`);
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

function renderRaceEvent(race, date) {
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
  details.textContent = `${eventDateFormatter.format(date)} · ${race.calendarDetails}`;
  const openPlan = document.createElement("a");
  openPlan.className = "calendar-event-link";
  openPlan.href = `./races/race.html?id=${encodeURIComponent(race.id)}`;
  openPlan.textContent = "Ouvrir le plan de course";
  openPlan.setAttribute("aria-label", `Ouvrir la fiche de ${race.name}`);
  card.append(category, title, details, openPlan);
  return card;
}

function renderTrainingEvent(session) {
  const card = document.createElement("article");
  card.className = "calendar-item calendar-training-item";
  const header = document.createElement("div");
  header.className = "calendar-training-header";
  const category = document.createElement("span");
  category.className = "calendar-event-category";
  category.textContent = session.status === "completed" ? "ENTRAÎNEMENT · RÉALISÉ" : "ENTRAÎNEMENT · PRÉVU";
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
  summary.textContent = formatTrainingSummary(session).join(" · ");
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
  const events = eventsByDate[dateKey(date)] || [];
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
        ? renderRaceEvent(event, date)
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
  showDayDetails(adjacent);
}

function closeTrainingForm() {
  trainingForm.reset();
  trainingForm.hidden = true;
  trainingFormStatus.textContent = "";
  delete trainingFormStatus.dataset.state;
  editingSession = null;
  addTrainingButton.hidden = false;
  trainingPace.textContent = "—";
}

function updateTrainingPace() {
  const distanceKm = Number(trainingForm.elements.namedItem("distanceKm").value);
  const durationMinutes = Number(trainingForm.elements.namedItem("durationMinutes").value);
  trainingPace.textContent = formatPace(distanceKm, durationMinutes) || "—";
}

function openTrainingForm(session = null) {
  closeTrainingForm();
  editingSession = session ? { ...session } : null;
  trainingFormTitle.textContent = session
    ? `Modifier · ${session.title}`
    : `Entraînement du ${eventDateFormatter.format(selectedDate)}`;
  if (session) {
    for (const field of ["title", "type", "time", "distanceKm", "durationMinutes", "ascentMeters", "weather", "notes"]) {
      trainingForm.elements.namedItem(field).value = session[field] ?? "";
    }
    trainingForm.elements.namedItem("completed").checked = session.status === "completed";
  }
  updateTrainingPace();
  trainingForm.hidden = false;
  addTrainingButton.hidden = true;
  trainingForm.querySelector('[name="title"]').focus();
}

async function refreshEvents() {
  const [races, sessions] = await Promise.all([
    repository.list("raceCatalog"),
    repository.list("plannedSessions")
  ]);
  showLoadedEvents(races, sessions);
}

function renderCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedMonth = monthFormatter.format(currentMonth);
  calendarTitleText.textContent =
    formattedMonth.charAt(0).toLocaleUpperCase("fr-FR") +
    formattedMonth.slice(1);
  renderCalendarGrid({
    container: calendarDays,
    currentMonth,
    eventsByDate,
    today,
    onSelectDate: showDayDetails,
    getEventLabel: event => {
      if (event.eventType === "race") return `Course : ${event.name}`;
      const status = event.status === "completed" ? "réalisé" : "prévu";
      const time = event.time ? ` à ${event.time}` : "";
      return `Entraînement ${status}${time} : ${event.title}`;
    },
    getEventMarkerClass: event => event.eventType === "training" ? "calendar-session-dot" : ""
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
  addTrainingButton.addEventListener("click", () => {
    if (!selectedDate) return;
    openTrainingForm();
  });
  cancelTrainingButton.addEventListener("click", closeTrainingForm);
  trainingForm.elements.namedItem("distanceKm").addEventListener("input", updateTrainingPace);
  trainingForm.elements.namedItem("durationMinutes").addEventListener("input", updateTrainingPace);
  trainingForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!selectedDate || !trainingForm.reportValidity()) return;
    const formData = new FormData(trainingForm);
    const session = {
      ...(editingSession || {}),
      id: editingSession?.id || crypto.randomUUID(),
      date: dateKey(selectedDate),
      type: String(formData.get("type")),
      title: String(formData.get("title")).trim(),
      status: formData.get("completed") === "on" ? "completed" : "planned",
      createdAt: editingSession?.createdAt || new Date().toISOString()
    };
    delete session.eventType;
    if (session.status === "completed") {
      session.completedAt = editingSession?.completedAt || new Date().toISOString();
    } else {
      delete session.completedAt;
    }
    const time = String(formData.get("time")).trim();
    if (time) session.time = time;
    else delete session.time;
    for (const field of ["distanceKm", "durationMinutes", "ascentMeters"]) {
      const value = String(formData.get(field)).trim();
      if (value) session[field] = Number(value);
      else delete session[field];
    }
    const weather = String(formData.get("weather"));
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
