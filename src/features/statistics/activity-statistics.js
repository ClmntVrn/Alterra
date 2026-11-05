import { formatDuration } from "../../domain/durations.js";
import {
  WEEK_COUNT,
  averageOfPastWeeks,
  computeWeeklyTotals,
  createWeeks,
  filterCompletedWorkouts,
  filterWorkouts
} from "../../domain/statistics.js";
import { formatLongDate, formatNumber, formatShortDayMonth } from "../../ui/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Hauteur du graphique en pixels, haut des barres et ligne de base (dates en dessous). */
const CHART_HEIGHT = 150;
const PLOT_TOP = 10;
const BASELINE = 126;
/** Colonne de droite réservée à la moyenne. */
const AXIS_WIDTH = 44;

const metrics = Object.freeze({
  distance: { label: "Distance", format: value => `${formatNumber(value)} km` },
  duration: { label: "Temps", format: value => formatDuration(value) },
  ascent: { label: "Dénivelé", format: value => `${formatNumber(Math.round(value))} m` },
  effort: { label: "Km-effort", format: value => `${formatNumber(value)} km` }
});
const categories = Object.freeze({
  trail: { label: "Trail", types: ["trail"] },
  running: { label: "Course à pied", types: ["running"] },
  combined: { label: "Trail + course à pied", types: ["trail", "running"] },
  cycling: { label: "Vélo", types: ["cycling"] }
});

/**
 * Carte d’activité de l’accueil : barres des douze dernières semaines (réalisé en barre pleine,
 * prévu en barre vide), semaine choisie au toucher, au glisser ou au clavier.
 */
export function initializeActivityStatistics(container) {
  const categoriesElement = container.querySelector("#activityCategories");
  const categoriesViewport = container.querySelector("#activityFilterViewport");
  const metricsElement = container.querySelector("#activityMetrics");
  const weekLabel = container.querySelector("#activitySelectedWeek");
  const values = {
    distance: container.querySelector("#activityDistance"),
    duration: container.querySelector("#activityDuration"),
    ascent: container.querySelector("#activityAscent"),
    effort: container.querySelector("#activityEffort")
  };
  const plannedLabel = container.querySelector("#activityPlanned");
  const chart = container.querySelector("#activityChart");
  let sessions = [];
  let selectedCategory = "combined";
  let selectedMetric = "distance";
  let selectedWeekIndex = WEEK_COUNT - 1;
  /** Totaux par semaine : réalisé, et prévu (réalisé compris). */
  let doneWeeks = [];
  let plannedWeeks = [];
  /** @type {SVGGElement[]} */
  let bars = [];
  let chartWidth = 0;
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

  // Les chiffres de la semaine servent aussi à choisir l’indicateur du graphique.
  for (const key of Object.keys(metrics)) {
    metricsElement.querySelector(`[data-metric="${key}"]`).addEventListener("click", () => {
      selectedMetric = key;
      updateSelectedButtons(metricsElement, "metric", key);
      renderChart();
      renderSelectedWeek();
    });
  }
  if (typeof ResizeObserver === "function") {
    // Dessiné à la taille réelle : redessiné quand la carte change de largeur (rotation, onglet
    // affiché après coup).
    new ResizeObserver(() => {
      if (chart.clientWidth && chart.clientWidth !== chartWidth) renderChart();
    }).observe(chart);
  }

  render();

  return updateSessions;

  function updateSessions(records) {
    sessions = records;
    render();
  }

  function render() {
    const weeks = createWeeks(new Date());
    const types = categories[selectedCategory].types;
    doneWeeks = computeWeeklyTotals(weeks, filterCompletedWorkouts(sessions, types));
    plannedWeeks = computeWeeklyTotals(weeks, filterWorkouts(sessions, types));
    renderChart();
    renderSelectedWeek();
  }

  function plannedValue(index) {
    return plannedWeeks[index].totals[selectedMetric];
  }

  /** Une partie du prévu de la semaine n’est pas encore réalisée. */
  function hasPlannedRemainder(index) {
    return plannedValue(index) - doneWeeks[index].totals[selectedMetric] > 0.05;
  }

  function renderSelectedWeek() {
    const week = doneWeeks[selectedWeekIndex];
    weekLabel.textContent =
      week.start.getFullYear() === week.end.getFullYear()
        ? `${formatShortDayMonth(week.start)} – ${formatShortDayMonth(week.end)} ${week.end.getFullYear()}`
        : `${formatLongDate(week.start)} – ${formatLongDate(week.end)}`;
    for (const [key, element] of Object.entries(values)) {
      element.textContent = metrics[key].format(week.totals[key]);
    }
    const showPlanned = hasPlannedRemainder(selectedWeekIndex);
    plannedLabel.hidden = !showPlanned;
    plannedLabel.textContent = showPlanned
      ? `Prévu : ${metrics[selectedMetric].format(plannedValue(selectedWeekIndex))}`
      : "";
    bars.forEach((bar, index) => {
      const selected = index === selectedWeekIndex;
      bar.classList.toggle("is-selected", selected);
      bar.setAttribute("aria-pressed", String(selected));
      bar.setAttribute("tabindex", selected ? "0" : "-1");
    });
  }

  function selectWeek(index, { focus = false } = {}) {
    const next = Math.max(0, Math.min(WEEK_COUNT - 1, index));
    if (next !== selectedWeekIndex) {
      selectedWeekIndex = next;
      renderSelectedWeek();
    }
    if (focus) bars[next].focus();
  }

  function renderChart() {
    const metric = metrics[selectedMetric];
    chartWidth = chart.clientWidth;
    const width = Math.max(chartWidth, 240);
    const slot = (width - AXIS_WIDTH) / WEEK_COUNT;
    const barWidth = Math.min(20, slot * 0.62);
    const radius = Math.min(5, barWidth / 2);
    const done = doneWeeks.map(week => week.totals[selectedMetric]);
    const planned = plannedWeeks.map(week => week.totals[selectedMetric]);
    const max = Math.max(...done, ...planned, 0) || 1;
    const height = value => (value / max) * (BASELINE - PLOT_TOP);
    const currentIndex = WEEK_COUNT - 1;

    const svg = svgElement("svg", {
      viewBox: `0 0 ${width} ${CHART_HEIGHT}`,
      width,
      height: CHART_HEIGHT,
      role: "group",
      "aria-label": `${metric.label} des douze dernières semaines`
    });
    const hatch = svgElement("pattern", {
      id: "activityHatch",
      width: 5,
      height: 5,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)"
    });
    hatch.append(svgElement("line", { x1: 0, y1: 0, x2: 0, y2: 5, class: "activity-chart-hatch" }));
    const defs = svgElement("defs");
    defs.append(hatch);
    svg.append(defs);

    const average = averageOfPastWeeks(doneWeeks, selectedMetric);
    if (average > 0) {
      const y = BASELINE - height(average);
      svg.append(
        svgElement("line", {
          x1: 0,
          x2: width - AXIS_WIDTH + 4,
          y1: y,
          y2: y,
          class: "activity-chart-average"
        })
      );
      const label = svgElement("text", { y: y - 3, class: "activity-chart-axis-label" });
      label.append(
        svgElement("tspan", { x: width }, "moy."),
        svgElement("tspan", { x: width, dy: 11 }, metric.format(average))
      );
      svg.append(label);
    }

    bars = done.map((value, index) => {
      const center = slot * index + slot / 2;
      const left = center - barWidth / 2;
      const remainder = hasPlannedRemainder(index);
      const group = svgElement("g", {
        class: `activity-chart-point${index === currentIndex ? " is-current" : ""}`,
        role: "button",
        "aria-label":
          `${formatLongDate(doneWeeks[index].start)}, ${metric.format(value)}` +
          (remainder ? `, prévu ${metric.format(planned[index])}` : "") +
          (index === currentIndex ? ", semaine en cours" : "")
      });
      group.append(
        svgElement("rect", {
          x: slot * index,
          y: 0,
          width: slot,
          height: BASELINE,
          class: "activity-chart-hit-area"
        })
      );
      if (remainder) {
        const plannedHeight = Math.max(height(planned[index]), 4);
        group.append(
          svgElement("rect", {
            x: left + 0.75,
            y: BASELINE - plannedHeight + 0.75,
            width: barWidth - 1.5,
            height: plannedHeight - 1.5,
            rx: radius,
            class: "activity-chart-planned"
          })
        );
      }
      const barHeight = value > 0 ? Math.max(height(value), 4) : 2;
      const bar = {
        x: left,
        y: BASELINE - barHeight,
        width: barWidth,
        height: barHeight,
        rx: value > 0 ? radius : 1
      };
      group.append(
        svgElement("rect", {
          ...bar,
          class: value > 0 ? "activity-chart-bar" : "activity-chart-bar is-empty"
        })
      );
      // Semaine en cours hachurée : elle n’est pas finie.
      if (index === currentIndex && value > 0) {
        group.append(
          svgElement("rect", {
            ...bar,
            fill: "url(#activityHatch)",
            class: "activity-chart-hatched"
          })
        );
      }
      group.addEventListener("click", () => selectWeek(index));
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectWeek(index);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          selectWeek(index + (event.key === "ArrowLeft" ? -1 : 1), { focus: true });
        }
      });
      svg.append(group);

      if (index % 3 === 2) {
        svg.append(
          svgElement(
            "text",
            { x: center, y: CHART_HEIGHT - 6, class: "activity-chart-week-label" },
            formatShortDayMonth(doneWeeks[index].start)
          )
        );
      }
      return group;
    });

    // Glisser le doigt le long du graphique fait défiler les semaines.
    let scrubbing = false;
    const weekAt = event => {
      const box = svg.getBoundingClientRect();
      return Math.floor((((event.clientX - box.left) / box.width) * width) / slot);
    };
    svg.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      scrubbing = true;
      svg.setPointerCapture?.(event.pointerId);
      selectWeek(weekAt(event));
    });
    svg.addEventListener("pointermove", event => {
      if (scrubbing) selectWeek(weekAt(event));
    });
    const stopScrubbing = () => {
      scrubbing = false;
    };
    svg.addEventListener("pointerup", stopScrubbing);
    svg.addEventListener("pointercancel", stopScrubbing);

    chart.replaceChildren(svg);
  }
}

/** Élément SVG avec ses attributs et, au besoin, son texte. */
function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
}

function updateSelectedButtons(container, attribute, selectedValue) {
  for (const button of container.querySelectorAll(`[data-${attribute}]`)) {
    button.setAttribute(
      "aria-pressed",
      button.dataset[attribute] === selectedValue ? "true" : "false"
    );
  }
}
