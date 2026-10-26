import { formatDuration } from "../../src/domain/durations.js";
import {
  WEEK_COUNT,
  computeWeeklyTotals,
  createWeeks,
  filterCompletedWorkouts,
  getWorkoutsInWeek,
  sumWorkouts
} from "../../src/domain/statistics.js";
import { formatLongDate, formatNumber, formatShortDayMonth } from "../../src/ui/format.js";

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
  let selectedWeekIndex = WEEK_COUNT - 1;
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
    categoriesViewport.classList.toggle(
      "is-at-end",
      categoriesViewport.scrollLeft >= maxScroll - 4
    );
  };
  categoriesViewport.addEventListener("scroll", updateCategoriesViewport, { passive: true });
  window.addEventListener("resize", updateCategoriesViewport);
  categoriesViewport.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClickTarget = null;
    dragStartX = event.clientX;
    dragStartScroll = categoriesViewport.scrollLeft;
    dragTarget = event.target instanceof Element ? event.target.closest(".activity-filter") : null;
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
  categoriesViewport.addEventListener(
    "click",
    event => {
      if (
        suppressClickTarget &&
        event.target instanceof Element &&
        event.target.closest(".activity-filter") === suppressClickTarget
      ) {
        suppressClickTarget = null;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
  requestAnimationFrame(updateCategoriesViewport);
  for (const [key, metric] of Object.entries(metrics)) {
    const button = metricsElement.querySelector(`[data-metric="${key}"]`);
    button.addEventListener("click", () => {
      selectedMetric = key;
      updateSelectedButtons(metricsElement, "metric", key);
      renderChart(createWeeks(new Date()), filterSessions(sessions));
    });
    button.textContent = metric.label;
    if (key === "effort") {
      button.setAttribute(
        "aria-label",
        "Km-effort : distance + 1 km par 100 m de dénivelé positif"
      );
      button.title = "1 km-effort = 1 km + 100 m de dénivelé positif";
    }
  }

  render();
  repository
    .list("plannedSessions")
    .then(updateSessions)
    .catch(error => {
      console.error("Impossible de charger les statistiques d’entraînement.", error);
      chart.replaceChildren();
      chart.setAttribute("role", "status");
      chart.textContent =
        "Impossible de charger les statistiques. Vérifie le stockage de cet appareil.";
    });

  return updateSessions;

  function updateSessions(records) {
    sessions = records;
    render();
  }

  function render() {
    const weeks = createWeeks(new Date());
    const filteredSessions = filterSessions(sessions);
    renderSelectedWeek(weeks, filteredSessions);
    renderChart(weeks, filteredSessions);
  }

  function filterSessions(records) {
    return filterCompletedWorkouts(records, categories[selectedCategory].types);
  }

  function renderSelectedWeek(weeks, records) {
    const selectedWeek = weeks[selectedWeekIndex];
    const dateLabel =
      selectedWeek.start.getFullYear() === selectedWeek.end.getFullYear()
        ? `${formatShortDayMonth(selectedWeek.start)} – ${formatShortDayMonth(selectedWeek.end)} ${selectedWeek.end.getFullYear()}`
        : `${formatLongDate(selectedWeek.start)} – ${formatLongDate(selectedWeek.end)}`;
    weekLabel.textContent = dateLabel;

    const totals = sumWorkouts(getWorkoutsInWeek(records, selectedWeek));
    distanceValue.textContent = `${formatNumber(totals.distance)} km`;
    durationValue.textContent = formatDuration(totals.duration, { minuteUnit: true });
    ascentValue.textContent = `${formatNumber(totals.ascent)} m`;
  }

  function renderChart(emptyWeeks, records) {
    const weeks = computeWeeklyTotals(emptyWeeks, records);
    selectedWeekIndex = Math.min(selectedWeekIndex, WEEK_COUNT - 1);
    renderSelectedWeek(weeks, records);
    chart.replaceChildren();

    const values = weeks.map(week => week.totals[selectedMetric]);
    const maxValue = Math.max(...values, 0);
    const chartMax = maxValue || 1;
    const points = values.map((value, index) => ({
      x: 20 + index * 26.8,
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
      gridLine.setAttribute("x1", "16");
      gridLine.setAttribute("x2", "320");
      gridLine.setAttribute("y1", y);
      gridLine.setAttribute("y2", y);
      gridLine.setAttribute("class", "activity-chart-gridline");
      svg.append(gridLine);
      const axisLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      axisLabel.setAttribute("x", "358");
      axisLabel.setAttribute("y", y + 3);
      axisLabel.setAttribute("class", "activity-chart-axis-label");
      axisLabel.textContent = formatNumber(axisValues[index]);
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
        `${formatLongDate(weeks[index].start)}, ` +
          `${formatNumber(weeks[index].totals[selectedMetric])} ${metrics[selectedMetric].unit}`
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

      if (index % 2 === 0 || index === WEEK_COUNT - 1) {
        const weekLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        weekLabel.setAttribute("x", point.x);
        weekLabel.setAttribute("y", "174");
        weekLabel.setAttribute("class", "activity-chart-week-label");
        weekLabel.textContent = formatShortDayMonth(weeks[index].start);
        svg.append(weekLabel);
      }
    });

    chart.append(svg);
  }
}

function createCurvePath(points) {
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const controlX = (previous.x + point.x) / 2;
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
}

function updateSelectedButtons(container, attribute, selectedValue) {
  for (const button of container.querySelectorAll(`[data-${attribute}]`)) {
    button.setAttribute(
      "aria-pressed",
      button.dataset[attribute] === selectedValue ? "true" : "false"
    );
  }
}
