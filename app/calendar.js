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
const previousMonthButton = document.getElementById("previousMonth");
const nextMonthButton = document.getElementById("nextMonth");
const previousDayButton = document.getElementById("previousDay");
const nextDayButton = document.getElementById("nextDay");
const backToMonthButton = document.getElementById("backToMonth");
const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let eventsByDate = {};
let selectedDate = null;
let repository = null;

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

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function showLoadedEvents(races, sessions) {
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
  document.querySelector(".calendar-heading").classList.remove("is-day-view");
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
    const hours = Math.floor(session.durationMinutes / 60);
    const minutes = session.durationMinutes % 60;
    details.push(hours ? `${hours} h${minutes ? ` ${minutes}` : ""}` : `${minutes} min`);
  }
  if (Number.isFinite(session.ascentMeters)) {
    details.push(`${Number(session.ascentMeters).toLocaleString("fr-FR")} m D+`);
  }
  return details.join(" · ");
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
  if (targets) {
    const targetDetails = document.createElement("p");
    targetDetails.className = "calendar-event-description calendar-training-targets";
    targetDetails.textContent = targets;
    card.append(targetDetails);
  }
  if (session.notes) {
    const notes = document.createElement("p");
    notes.className = "calendar-event-description calendar-training-notes";
    notes.textContent = session.notes;
    card.append(notes);
  }
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
  statusText.textContent = "Séance réalisée";
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
  card.append(statusLabel);
  return card;
}

function showDayDetails(date) {
  selectedDate = date;
  currentMonth.setFullYear(date.getFullYear(), date.getMonth(), 1);
  document.querySelector(".calendar-heading").classList.add("is-day-view");
  const events = eventsByDate[dateKey(date)] || [];
  calendarTitle.textContent = eventDateFormatter.format(date);
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
  addTrainingButton.hidden = false;
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
  calendarTitle.textContent = monthFormatter.format(currentMonth);
  calendarTitle.textContent =
    calendarTitle.textContent.charAt(0).toLocaleUpperCase("fr-FR") +
    calendarTitle.textContent.slice(1);
  calendarDays.replaceChildren();

  const firstWeekday = (currentMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
  for (let week = 0; week < weekCount; week += 1) {
    const weekRow = document.createElement("div");
    weekRow.className = "calendar-week";
    weekRow.setAttribute("role", "row");

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = week * 7 + weekday - firstWeekday + 1;
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";
      dayCell.setAttribute("role", "gridcell");

      if (day < 1 || day > daysInMonth) {
        dayCell.classList.add("is-empty");
        dayCell.setAttribute("aria-hidden", "true");
        weekRow.append(dayCell);
        continue;
      }

      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      );
      const key = dateKey(date);
      const isToday = date.getTime() === today.getTime();
      if (isToday) {
        dayCell.classList.add("is-today");
        dayCell.setAttribute("aria-current", "date");
      }
      const events = eventsByDate[key] || [];
      const dateButton = document.createElement("button");
      dateButton.className = "calendar-date-button";
      dateButton.type = "button";
      dateButton.setAttribute(
        "aria-label",
        `${events.map(event => {
          if (event.eventType === "race") return `Course : ${event.name}`;
          const status = event.status === "completed" ? "réalisé" : "prévu";
          const time = event.time ? ` à ${event.time}` : "";
          return `Entraînement ${status}${time} : ${event.title}`;
        }).join(", ")}` +
        `${events.length ? ", " : ""}${eventDateFormatter.format(date)}, afficher la journée`
      );
      const dateNumber = document.createElement("span");
      dateNumber.className = "calendar-date";
      dateNumber.textContent = day;
      dateButton.append(dateNumber);
      if (events.length) {
        dayCell.classList.add("has-event");
        for (const event of events.slice(0, 3)) {
          const eventDot = document.createElement("span");
          eventDot.className = `calendar-event-dot${event.eventType === "training" ? " calendar-session-dot" : ""}`;
          eventDot.setAttribute("aria-hidden", "true");
          dateButton.append(eventDot);
        }
      }
      dateButton.addEventListener("click", () => showDayDetails(date));
      dayCell.append(dateButton);
      weekRow.append(dayCell);
    }

    calendarDays.append(weekRow);
  }
}

export function initializeCalendar(racesPromise, personalRepository) {
  repository = personalRepository;
  previousMonthButton.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  nextMonthButton.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });
  backToMonthButton.addEventListener("click", showMonthView);
  previousDayButton.addEventListener("click", () => moveSelectedDay(-1));
  nextDayButton.addEventListener("click", () => moveSelectedDay(1));
  addTrainingButton.addEventListener("click", () => {
    if (!selectedDate) return;
    trainingFormTitle.textContent = `Entraînement du ${eventDateFormatter.format(selectedDate)}`;
    trainingForm.hidden = false;
    addTrainingButton.hidden = true;
    trainingForm.querySelector('[name="title"]').focus();
  });
  cancelTrainingButton.addEventListener("click", closeTrainingForm);
  trainingForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!selectedDate || !trainingForm.reportValidity()) return;
    const formData = new FormData(trainingForm);
    const session = {
      id: crypto.randomUUID(),
      date: dateKey(selectedDate),
      type: String(formData.get("type")),
      title: String(formData.get("title")).trim(),
      status: formData.get("completed") === "on" ? "completed" : "planned",
      createdAt: new Date().toISOString()
    };
    if (session.status === "completed") session.completedAt = new Date().toISOString();
    const time = String(formData.get("time")).trim();
    if (time) session.time = time;
    for (const field of ["distanceKm", "durationMinutes", "ascentMeters"]) {
      const value = String(formData.get(field)).trim();
      if (value) session[field] = Number(value);
    }
    const notes = String(formData.get("notes")).trim();
    if (notes) session.notes = notes;
    const saveButton = trainingForm.querySelector('[type="submit"]');
    saveButton.disabled = true;
    trainingFormStatus.textContent = "Enregistrement…";
    delete trainingFormStatus.dataset.state;
    try {
      await repository.save("plannedSessions", session);
      closeTrainingForm();
      await refreshEvents();
    } catch (error) {
      console.error("Impossible d’enregistrer l’entraînement.", error);
      trainingFormStatus.textContent = "L’enregistrement a échoué. Vérifie le stockage de cet appareil.";
      trainingFormStatus.dataset.state = "error";
    } finally {
      saveButton.disabled = false;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !calendarGrid.hidden) renderCalendar();
  });

  renderCalendar();
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
