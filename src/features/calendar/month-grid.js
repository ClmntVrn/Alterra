import { toDateKey } from "../../domain/dates.js";
import { formatLongDate } from "../../ui/format.js";

export function renderCalendarGrid({
  container,
  currentMonth,
  eventsByDate,
  today,
  onSelectDate,
  getEventLabel,
  getEventMarkerClass
}) {
  container.replaceChildren();
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

      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const key = toDateKey(date);
      const isToday = date.getTime() === today.getTime();
      if (isToday) {
        dayCell.classList.add("is-today");
        dayCell.setAttribute("aria-current", "date");
      }
      const events = eventsByDate[key] || [];
      const eventLabels = events.map(getEventLabel);
      const dateButton = document.createElement("button");
      dateButton.className = "calendar-date-button";
      dateButton.type = "button";
      dateButton.setAttribute(
        "aria-label",
        `${eventLabels.join(", ")}` +
          `${events.length ? ", " : ""}${formatLongDate(date)}, afficher la journée`
      );
      const dateNumber = document.createElement("span");
      dateNumber.className = "calendar-date";
      dateNumber.textContent = day;
      dateButton.append(dateNumber);
      if (events.length) {
        dayCell.classList.add("has-event");
        for (const event of events.slice(0, 3)) {
          const eventDot = document.createElement("span");
          const markerClass = getEventMarkerClass(event);
          eventDot.className = `calendar-event-dot${markerClass ? ` ${markerClass}` : ""}`;
          eventDot.setAttribute("aria-hidden", "true");
          dateButton.append(eventDot);
        }
      }
      dateButton.addEventListener("click", () => onSelectDate(date));
      dayCell.append(dateButton);
      weekRow.append(dayCell);
    }

    container.append(weekRow);
  }
}
