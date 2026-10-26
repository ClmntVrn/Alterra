import { toDateKey } from "../../domain/dates.js";
import { formatLongDate, formatMonthName } from "../../ui/format.js";

const firstCalendarYear = 1900;
const lastCalendarYear = 9999;
const wheelYearBatchSize = 50;
const wheelYearRangeSize = 50;

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

export function createMonthYearPicker({
  toggle,
  form,
  monthWheel,
  yearWheel,
  currentMonth,
  onApply
}) {
  let draftMonth = currentMonth.getMonth();
  let draftYear = currentMonth.getFullYear();
  let monthScrollTimeout = null;
  let yearScrollTimeout = null;

  for (let month = 0; month < 12; month += 1) {
    monthWheel.append(
      createWheelOption(monthWheel, month, formatMonthName(new Date(2026, month, 1)))
    );
  }
  appendYearOptions(
    yearWheel,
    Math.max(firstCalendarYear, draftYear - wheelYearRangeSize),
    Math.min(lastCalendarYear, draftYear + wheelYearRangeSize)
  );

  toggle.addEventListener("click", () => {
    if (form.hidden) {
      form.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      draftMonth = currentMonth.getMonth();
      draftYear = currentMonth.getFullYear();
      syncSelection(true);
      monthWheel.focus();
    } else {
      close();
    }
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    settleWheel(monthWheel, "month");
    settleWheel(yearWheel, "year");
    currentMonth.setFullYear(draftYear, draftMonth, 1);
    close();
    onApply();
  });
  form.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      close();
      toggle.focus();
    }
  });
  monthWheel.addEventListener("scroll", () => handleWheelScroll(monthWheel, "month"));
  yearWheel.addEventListener("scroll", () => handleWheelScroll(yearWheel, "year"));
  monthWheel.addEventListener("keydown", event => handleWheelKeydown(event, monthWheel));
  yearWheel.addEventListener("keydown", event => handleWheelKeydown(event, yearWheel));

  function close() {
    clearTimeout(monthScrollTimeout);
    clearTimeout(yearScrollTimeout);
    form.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function syncSelection(scrollToSelected = false) {
    setSelectedOption(monthWheel, draftMonth);
    setSelectedOption(yearWheel, draftYear);
    if (scrollToSelected) {
      scrollWheelToValue(monthWheel, draftMonth);
      scrollWheelToValue(yearWheel, draftYear);
    }
  }

  function selectValue(wheel, value) {
    if (wheel === monthWheel) draftMonth = value;
    else draftYear = value;
    syncSelection();
    if (wheel === yearWheel) extendYearWheelIfNeeded();
  }

  function settleWheel(wheel, type) {
    if (type === "year") extendYearWheelIfNeeded();
    const centeredOption = findCenteredWheelOption(wheel);
    if (centeredOption) selectValue(wheel, Number(centeredOption.dataset.value));
  }

  function handleWheelScroll(wheel, type) {
    const timeout = type === "month" ? monthScrollTimeout : yearScrollTimeout;
    clearTimeout(timeout);
    const nextTimeout = setTimeout(() => settleWheel(wheel, type), 120);
    if (type === "month") monthScrollTimeout = nextTimeout;
    else yearScrollTimeout = nextTimeout;
  }

  function handleWheelKeydown(event, wheel) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      wheel.scrollBy({ top: event.key === "ArrowUp" ? -42 : 42, behavior: "smooth" });
    }
  }

  function extendYearWheelIfNeeded() {
    const centeredOption = findCenteredWheelOption(yearWheel);
    if (!centeredOption) return;
    const firstYear = Number(yearWheel.firstElementChild.dataset.value);
    const lastYear = Number(yearWheel.lastElementChild.dataset.value);
    const selectedYear = Number(centeredOption.dataset.value);
    if (selectedYear - firstYear < 10 && firstYear > firstCalendarYear) {
      const newFirstYear = Math.max(firstCalendarYear, firstYear - wheelYearBatchSize);
      const addedYears = firstYear - newFirstYear;
      appendYearOptions(yearWheel, newFirstYear, firstYear - 1, true);
      yearWheel.scrollTop += addedYears * 42;
    } else if (lastYear - selectedYear < 10 && lastYear < lastCalendarYear) {
      appendYearOptions(
        yearWheel,
        lastYear + 1,
        Math.min(lastCalendarYear, lastYear + wheelYearBatchSize)
      );
    }
  }

  return {
    close,
    sync(date = currentMonth, scrollToSelected = false) {
      draftMonth = date.getMonth();
      draftYear = date.getFullYear();
      syncSelection(scrollToSelected);
    }
  };
}

function createWheelOption(wheel, value, label) {
  const option = document.createElement("button");
  option.className = "calendar-wheel-option";
  option.type = "button";
  option.dataset.value = value;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", "false");
  option.textContent = label;
  option.addEventListener("click", () => {
    const listbox = option.closest('[role="listbox"]');
    if (!listbox) return;
    const center = listbox.getBoundingClientRect().top + listbox.clientHeight / 2;
    listbox.scrollTop += option.getBoundingClientRect().top + option.offsetHeight / 2 - center;
  });
  return option;
}

function appendYearOptions(wheel, startYear, endYear, prepend = false) {
  const options = document.createDocumentFragment();
  for (let year = startYear; year <= endYear; year += 1) {
    options.append(createWheelOption(wheel, year, String(year)));
  }
  if (prepend) wheel.prepend(options);
  else wheel.append(options);
}

function setSelectedOption(wheel, value) {
  for (const option of wheel.children) {
    option.setAttribute("aria-selected", Number(option.dataset.value) === value ? "true" : "false");
  }
}

function scrollWheelToValue(wheel, value) {
  const option = Array.from(wheel.children).find(item => Number(item.dataset.value) === value);
  if (!option) return;
  const wheelTop = wheel.getBoundingClientRect().top;
  wheel.scrollTop +=
    option.getBoundingClientRect().top - wheelTop - (wheel.clientHeight - option.offsetHeight) / 2;
}

function findCenteredWheelOption(wheel) {
  const center = wheel.getBoundingClientRect().top + wheel.clientHeight / 2;
  let nearestOption = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const option of wheel.children) {
    const bounds = option.getBoundingClientRect();
    const distance = Math.abs(bounds.top + bounds.height / 2 - center);
    if (distance < nearestDistance) {
      nearestOption = option;
      nearestDistance = distance;
    }
  }
  return nearestOption;
}
