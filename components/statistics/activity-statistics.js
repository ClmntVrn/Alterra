const weekCount = 12;
const weekStartsOnMonday = 1;
const metrics = Object.freeze({
  distance: { label: "Distance", unit: "km" },
  duration: { label: "Temps", unit: "min" },
  ascent: { label: "Dénivelé", unit: "m" },
  effort: { label: "Km-effort", unit: "km" }
});
const categories = Object.freeze({
  trail: { label: "Trail", types: ["trail"] },
  running: { label: "Course à pied", types: ["running"] },
  combined: { label: "Trail + course à pied", types: ["trail", "running"] },
  cycling: { label: "Vélo", types: ["cycling"] }
});
const weekRangeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short"
});
const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric"
});
const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1
});

export function initializeActivityStatistics(container, repository) {
  const categoriesElement = container.querySelector("#activityCategories");
  const categoriesViewport = container.querySelector("#activityFilterViewport");
  const metricsElement = container.querySelector("#activityMetrics");
  const weekLabel = container.querySelector("#activitySelectedWeek");
  const distanceValue = container.querySelector("#activityDistance");
  const durationValue = container.querySelector("#activityDuration");
  const ascentValue = container.querySelector("#activityAscent");
  const chart = container.querySelector("#activityChart");
  let sessions = [];
  let selectedCategory = "combined";
  let selectedMetric = "distance";
  let selectedWeekIndex = weekCount - 1;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragTarget = null;
  let isDragging = false;
  let hasCapturedPointer = false;
  let suppressClickTarget = null;

  for (const [key, category] of Object.entries(categories)) {
    const button = categoriesElement.querySelector(`[data-category="${key}"]`);
    button.addEventListener("click", () => {
      selectedCategory = key;
      updateSelectedButtons(categoriesElement, "category", key);
      render();
    });
    button.textContent = category.label;
  }
  const updateCategoriesViewport = () => {
    const maxScroll = categoriesViewport.scrollWidth - categoriesViewport.clientWidth;
    categoriesViewport.classList.toggle("is-scrolled", categoriesViewport.scrollLeft > 4);
    categoriesViewport.classList.toggle("is-at-end", categoriesViewport.scrollLeft >= maxScroll - 4);
  };
  categoriesViewport.addEventListener("scroll", updateCategoriesViewport, { passive: true });
  window.addEventListener("resize", updateCategoriesViewport);
  categoriesViewport.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClickTarget = null;
    dragStartX = event.clientX;
    dragStartScroll = categoriesViewport.scrollLeft;
    dragTarget = event.target instanceof Element
      ? event.target.closest(".activity-filter")
      : null;
    isDragging = true;
    hasCapturedPointer = false;
  });
  categoriesViewport.addEventListener("pointermove", event => {
    if (!isDragging) return;
    const distance = event.clientX - dragStartX;
    if (Math.abs(distance) > 4) {
      event.preventDefault();
      if (!hasCapturedPointer) {
        categoriesViewport.classList.add("is-dragging");
        categoriesViewport.setPointerCapture(event.pointerId);
        hasCapturedPointer = true;
      }
      categoriesViewport.scrollLeft = dragStartScroll - distance;
    }
  });
  const finishCategoryDrag = event => {
    if (!isDragging) return;
    isDragging = false;
    categoriesViewport.classList.remove("is-dragging");
    if (hasCapturedPointer && categoriesViewport.hasPointerCapture(event.pointerId)) {
      categoriesViewport.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(event.clientX - dragStartX) > 4) {
      suppressClickTarget = dragTarget;
    }
    hasCapturedPointer = false;
  };
  categoriesViewport.addEventListener("pointerup", finishCategoryDrag);
  categoriesViewport.addEventListener("pointercancel", finishCategoryDrag);
  categoriesViewport.addEventListener("click", event => {
    if (suppressClickTarget && event.target instanceof Element &&
        event.target.closest(".activity-filter") === suppressClickTarget) {
      suppressClickTarget = null;
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  requestAnimationFrame(updateCategoriesViewport);
  for (const [key, metric] of Object.entries(metrics)) {
    const button = metricsElement.querySelector(`[data-metric="${key}"]`);
    button.addEventListener("click", () => {
      selectedMetric = key;
      updateSelectedButtons(metricsElement, "metric", key);
      renderChart(createWeeks(), filterSessions(sessions));
    });
    button.textContent = metric.label;
    if (key === "effort") {
      button.setAttribute("aria-label", "Km-effort : distance + 1 km par 100 m de dénivelé positif");
      button.title = "1 km-effort = 1 km + 100 m de dénivelé positif";
    }
  }

  render();
  repository.list("plannedSessions")
    .then(updateSessions)
    .catch(error => {
      console.error("Impossible de charger les statistiques d’entraînement.", error);
      chart.replaceChildren();
      chart.setAttribute("role", "status");
      chart.textContent = "Impossible de charger les statistiques. Vérifie le stockage de cet appareil.";
    });

  return updateSessions;

  function updateSessions(records) {
    sessions = records;
    render();
  }

  function render() {
    const weeks = createWeeks();
    const filteredSessions = filterSessions(sessions);
    renderSelectedWeek(weeks, filteredSessions);
    renderChart(weeks, filteredSessions);
  }

  function createWeeks() {
    const currentWeek = startOfWeek(new Date());
    return Array.from({ length: weekCount }, (_, index) => {
      const start = new Date(currentWeek);
      start.setDate(start.getDate() - (weekCount - index - 1) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end, totals: createTotals() };
    });
  }

  function filterSessions(records) {
    const types = categories[selectedCategory].types;
    return records.filter(session =>
      session.status === "completed" &&
      types.includes(session.type) &&
      parseLocalDate(session.date) !== null
    );
  }

  function renderSelectedWeek(weeks, records) {
    const selectedWeek = weeks[selectedWeekIndex];
    const dateLabel = selectedWeek.start.getFullYear() === selectedWeek.end.getFullYear()
      ? `${weekRangeFormatter.format(selectedWeek.start)} – ${weekRangeFormatter.format(selectedWeek.end)} ${selectedWeek.end.getFullYear()}`
      : `${fullDateFormatter.format(selectedWeek.start)} – ${fullDateFormatter.format(selectedWeek.end)}`;
    weekLabel.textContent = dateLabel;

    const sessionsInWeek = records.filter(session => {
      const date = parseLocalDate(session.date);
      return date >= selectedWeek.start && date <= selectedWeek.end;
    });
    const totals = sumSessions(sessionsInWeek);
    distanceValue.textContent = `${numberFormatter.format(totals.distance)} km`;
    durationValue.textContent = formatDuration(totals.duration);
    ascentValue.textContent = `${numberFormatter.format(totals.ascent)} m`;
  }

  function renderChart(weeks, records) {
    for (const session of records) {
      const date = parseLocalDate(session.date);
      const sessionWeek = startOfWeek(date);
      const index = Math.round(
        (Date.UTC(sessionWeek.getFullYear(), sessionWeek.getMonth(), sessionWeek.getDate()) -
          Date.UTC(weeks[0].start.getFullYear(), weeks[0].start.getMonth(), weeks[0].start.getDate())) /
          604800000
      );
      if (index < 0 || index >= weekCount) continue;
      addSession(weeks[index].totals, session);
    }

    selectedWeekIndex = Math.min(selectedWeekIndex, weekCount - 1);
    renderSelectedWeek(weeks, records);
    chart.replaceChildren();

    const values = weeks.map(week => week.totals[selectedMetric]);
    const maxValue = Math.max(...values, 0);
    const chartMax = maxValue || 1;
    const points = values.map((value, index) => ({
      x: 43 + index * 27,
      y: 146 - (value / chartMax) * 112
    }));

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 360 180");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "group");
    svg.setAttribute(
      "aria-label",
      `${metrics[selectedMetric].label} sur les douze dernières semaines`
    );
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${metrics[selectedMetric].label} par semaine`;
    svg.append(title);

    const axisPositions = [34, 90, 146];
    const axisValues = [maxValue, maxValue / 2, 0];
    const axisLabels = [];
    axisPositions.forEach((y, index) => {
      const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      gridLine.setAttribute("x1", "40");
      gridLine.setAttribute("x2", "344");
      gridLine.setAttribute("y1", y);
      gridLine.setAttribute("y2", y);
      gridLine.setAttribute("class", "activity-chart-gridline");
      svg.append(gridLine);
      const axisLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      axisLabel.setAttribute("x", "2");
      axisLabel.setAttribute("y", y + 3);
      axisLabel.setAttribute("class", "activity-chart-axis-label");
      axisLabel.textContent = numberFormatter.format(axisValues[index]);
      axisLabels.push(axisLabel);
    });

    const linePath = createCurvePath(points);
    const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area.setAttribute(
      "d",
      `${linePath} L ${points[points.length - 1].x} 156 L ${points[0].x} 156 Z`
    );
    area.setAttribute("class", "activity-chart-area");
    svg.append(area);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", linePath);
    line.setAttribute("class", "activity-chart-line");
    svg.append(line);
    svg.append(...axisLabels);

    points.forEach((point, index) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute(
        "class",
        `activity-chart-point${index === selectedWeekIndex ? " is-selected" : ""}`
      );
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-pressed", index === selectedWeekIndex ? "true" : "false");
      group.setAttribute(
        "aria-label",
        `${fullDateFormatter.format(weeks[index].start)}, ` +
        `${numberFormatter.format(weeks[index].totals[selectedMetric])} ${metrics[selectedMetric].unit}`
      );
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hitArea.setAttribute("x", point.x - 13);
      hitArea.setAttribute("y", "14");
      hitArea.setAttribute("width", "26");
      hitArea.setAttribute("height", "142");
      hitArea.setAttribute("class", "activity-chart-hit-area");
      group.append(hitArea);
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", index === selectedWeekIndex ? "5" : "3.5");
      group.append(circle);
      const selectWeek = () => {
        selectedWeekIndex = index;
        renderSelectedWeek(weeks, records);
        renderChart(weeks, records);
      };
      group.addEventListener("click", selectWeek);
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectWeek();
        }
      });
      svg.append(group);

      if (index % 2 === 0 || index === weekCount - 1) {
        const weekLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        weekLabel.setAttribute("x", point.x);
        weekLabel.setAttribute("y", "174");
        weekLabel.setAttribute("class", "activity-chart-week-label");
        weekLabel.textContent = weekRangeFormatter.format(weeks[index].start);
        svg.append(weekLabel);
      }
    });

    chart.append(svg);
  }
}

function createTotals() {
  return { distance: 0, duration: 0, ascent: 0, effort: 0 };
}

function addSession(totals, session) {
  const distance = finiteOrZero(session.distanceKm);
  const ascent = finiteOrZero(session.ascentMeters);
  totals.distance += distance;
  totals.duration += finiteOrZero(session.durationMinutes);
  totals.ascent += ascent;
  totals.effort += distance + ascent / 100;
}

function sumSessions(sessions) {
  const totals = createTotals();
  sessions.forEach(session => addSession(totals, session));
  return totals;
}

function finiteOrZero(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() - weekStartsOnMonday + 7) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function parseLocalDate(value) {
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

function formatDuration(minutes) {
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (hours && remainingMinutes) return `${hours} h ${remainingMinutes} min`;
  if (hours) return `${hours} h`;
  return `${remainingMinutes} min`;
}

function createCurvePath(points) {
  return points.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }).join(" ");
}

function updateSelectedButtons(container, attribute, selectedValue) {
  for (const button of container.querySelectorAll(`[data-${attribute}]`)) {
    button.setAttribute(
      "aria-pressed",
      button.dataset[attribute] === selectedValue ? "true" : "false"
    );
  }
}
