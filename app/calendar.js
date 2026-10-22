const calendarDays = document.getElementById("calendarDays");
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.querySelector(".calendar-grid");
const calendarEventDetails = document.getElementById("calendarEventDetails");
const calendarCreateSection = document.getElementById("calendarCreateSection");
const calendarHint = document.getElementById("calendarHint");
const previousMonthButton = document.getElementById("previousMonth");
const nextMonthButton = document.getElementById("nextMonth");
const backToMonthButton = document.getElementById("backToMonth");
const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let events = {};

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric"
});
const eventDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

function showMonthView() {
  calendarGrid.hidden = false;
  calendarEventDetails.hidden = true;
  calendarCreateSection.hidden = true;
  calendarHint.hidden = !calendarHint.textContent;
  previousMonthButton.hidden = false;
  nextMonthButton.hidden = false;
  backToMonthButton.hidden = true;
  renderCalendar();
}

function showDayDetails(date, event) {
  calendarTitle.textContent = eventDateFormatter.format(date);
  calendarGrid.hidden = true;
  calendarEventDetails.replaceChildren();
  calendarEventDetails.hidden = false;
  calendarCreateSection.hidden = false;
  calendarHint.hidden = true;
  previousMonthButton.hidden = true;
  nextMonthButton.hidden = true;
  backToMonthButton.hidden = false;

  if (event) {
    const category = document.createElement("span");
    category.className = "calendar-event-category";
    category.textContent = event.organizer ? `COURSE · ${event.organizer}` : "COURSE";

    const title = document.createElement("h3");
    title.textContent = event.title;

    const details = document.createElement("p");
    details.className = "calendar-event-description";
    details.textContent = `${eventDateFormatter.format(date)} · ${event.details}`;

    calendarEventDetails.append(category, title, details);

    const openPlan = document.createElement("a");
    openPlan.className = "calendar-event-link";
    openPlan.href = `./races/race.html?id=${encodeURIComponent(event.id)}`;
    openPlan.textContent = "Ouvrir le plan de course";
    openPlan.setAttribute("aria-label", `Ouvrir la fiche de ${event.title}`);
    calendarEventDetails.append(openPlan);
  } else {
    const category = document.createElement("span");
    category.className = "calendar-event-category";
    category.textContent = "JOURNÉE";

    const title = document.createElement("h3");
    title.textContent = "Aucun événement prévu";

    calendarEventDetails.append(category, title);
  }
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
      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
      const isToday = date.getTime() === today.getTime();
      if (isToday) {
        dayCell.classList.add("is-today");
        dayCell.setAttribute("aria-current", "date");
      }
      const event = events[dateKey];
      const dateButton = document.createElement("button");
      dateButton.className = "calendar-date-button";
      dateButton.type = "button";
      dateButton.setAttribute(
        "aria-label",
        `${event ? `${event.title}, ` : ""}${eventDateFormatter.format(date)}, afficher la journée`
      );
      const dateNumber = document.createElement("span");
      dateNumber.className = "calendar-date";
      dateNumber.textContent = day;
      dateButton.append(dateNumber);
      if (event) {
        dayCell.classList.add("has-event");
        const eventDot = document.createElement("span");
        eventDot.className = "calendar-event-dot";
        eventDot.setAttribute("aria-hidden", "true");
        dateButton.append(eventDot);
      }
      dateButton.addEventListener("click", () => showDayDetails(date, event));
      dayCell.append(dateButton);
      weekRow.append(dayCell);
    }

    calendarDays.append(weekRow);
  }
}

async function loadRaceEvents() {
  const response = await fetch("./races/index.json");
  if (!response.ok) throw new Error(`Catalogue indisponible (${response.status}).`);
  const catalog = await response.json();
  const races = await Promise.all(catalog.map(async entry => {
    const raceResponse = await fetch(entry.data);
    if (!raceResponse.ok) {
      throw new Error(`Données indisponibles pour ${entry.id} (${raceResponse.status}).`);
    }
    const race = await raceResponse.json();
    if (race.id !== entry.id) throw new Error(`Identifiant de course incohérent : ${entry.id}.`);
    return race;
  }));

  return Object.fromEntries(races.map(race => [
    race.date,
    { id: race.id, title: race.name, details: race.calendarDetails, organizer: race.organizer }
  ]));
}

export function initializeCalendar() {
  previousMonthButton.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  nextMonthButton.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });
  backToMonthButton.addEventListener("click", showMonthView);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !calendarGrid.hidden) renderCalendar();
  });

  renderCalendar();
  loadRaceEvents()
    .then(raceEvents => {
      events = raceEvents;
      calendarHint.textContent = "";
      calendarHint.hidden = true;
      renderCalendar();
    })
    .catch(error => {
      console.error("Impossible de charger les courses du calendrier.", error);
      calendarHint.textContent = "Impossible de charger les courses. Réessaie avec une connexion Internet.";
      calendarHint.hidden = false;
    });
}
