import { formatDuration } from "../../domain/durations.js";
import {
  FUTURE_WEEKS,
  averageOfPastWeeks,
  computeWeeklyTotals,
  countHistoryWeeks,
  createWeekRange,
  filterCompletedWorkouts,
  filterWorkouts
} from "../../domain/statistics.js";
import { formatLongDate, formatNumber, formatShortDayMonth } from "../../ui/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Hauteur du graphique en pixels, haut des barres et ligne de base (dates en dessous). */
const CHART_HEIGHT = 150;
const PLOT_TOP = 10;
const BASELINE = 126;
/** Semaines visibles sans défiler : les 12 dernières ; les semaines à venir sont à droite. */
const VISIBLE_WEEKS = 12;
/** Semaines terminées prises pour la moyenne. */
const AVERAGE_WEEKS = 11;

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
 * Carte d’activité de l’accueil : courbe du réalisé par semaine et prévu en tirets, sur une bande
 * qui défile au doigt ; semaine choisie au toucher ou au clavier.
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
  /** Semaine choisie, comptée depuis la semaine en cours (−1 : la précédente). */
  let selectedOffset = 0;
  /** Totaux par semaine : réalisé, et prévu (réalisé compris). */
  let doneWeeks = [];
  let plannedWeeks = [];
  let currentIndex = 0;
  /** @type {SVGGElement[]} */
  let points = [];
  let chartWidth = 0;
  let slotWidth = 0;
  let weeksFromEnd = FUTURE_WEEKS;
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

  // Bande qui défile au doigt : la position est gardée depuis la droite, pour rester sur les
  // mêmes semaines quand le graphique est redessiné.
  const viewport = document.createElement("div");
  viewport.className = "activity-chart-viewport";
  const averageLabel = document.createElement("p");
  averageLabel.className = "activity-chart-average-label";
  averageLabel.setAttribute("aria-hidden", "true");
  chart.replaceChildren(viewport, averageLabel);
  enableMouseDrag(viewport);
  if (typeof ResizeObserver === "function") {
    // Dessiné à la taille réelle : redessiné quand la carte change de largeur (rotation, onglet
    // affiché après coup).
    new ResizeObserver(() => {
      if (viewport.clientWidth && viewport.clientWidth !== chartWidth) renderChart();
    }).observe(viewport);
  }

  render();

  return updateSessions;

  function updateSessions(records) {
    sessions = records;
    render();
  }

  function render() {
    const today = new Date();
    const past = countHistoryWeeks(sessions, today);
    const weeks = createWeekRange(today, past, FUTURE_WEEKS);
    const types = categories[selectedCategory].types;
    currentIndex = past;
    doneWeeks = computeWeeklyTotals(weeks, filterCompletedWorkouts(sessions, types));
    plannedWeeks = computeWeeklyTotals(weeks, filterWorkouts(sessions, types));
    renderChart();
    renderSelectedWeek();
  }

  function selectedIndex() {
    return Math.max(0, Math.min(doneWeeks.length - 1, currentIndex + selectedOffset));
  }

  function plannedValue(index) {
    return plannedWeeks[index].totals[selectedMetric];
  }

  /** Une partie du prévu de la semaine n’est pas encore réalisée. */
  function hasPlannedRemainder(index) {
    return plannedValue(index) - doneWeeks[index].totals[selectedMetric] > 0.05;
  }

  function renderSelectedWeek() {
    const index = selectedIndex();
    const week = doneWeeks[index];
    weekLabel.textContent =
      week.start.getFullYear() === week.end.getFullYear()
        ? `${formatShortDayMonth(week.start)} – ${formatShortDayMonth(week.end)} ${week.end.getFullYear()}`
        : `${formatLongDate(week.start)} – ${formatLongDate(week.end)}`;
    for (const [key, element] of Object.entries(values)) {
      element.textContent = metrics[key].format(week.totals[key]);
    }
    const showPlanned = hasPlannedRemainder(index);
    plannedLabel.hidden = !showPlanned;
    plannedLabel.textContent = showPlanned
      ? `Prévu : ${metrics[selectedMetric].format(plannedValue(index))}`
      : "";
    points.forEach((bar, barIndex) => {
      const selected = barIndex === index;
      bar.classList.toggle("is-selected", selected);
      bar.setAttribute("aria-pressed", String(selected));
      bar.setAttribute("tabindex", selected ? "0" : "-1");
    });
  }

  function selectWeek(index, { focus = false } = {}) {
    const next = Math.max(0, Math.min(doneWeeks.length - 1, index));
    if (next !== selectedIndex()) {
      selectedOffset = next - currentIndex;
      renderSelectedWeek();
    }
    if (focus) {
      points[next].focus({ preventScroll: true });
      // La semaine choisie au clavier reste visible dans la bande.
      const left = slotWidth * next;
      if (left < viewport.scrollLeft) viewport.scrollLeft = left;
      else if (left + slotWidth > viewport.scrollLeft + viewport.clientWidth) {
        viewport.scrollLeft = left + slotWidth - viewport.clientWidth;
      }
    }
  }

  function renderChart() {
    const metric = metrics[selectedMetric];
    // Position lue en semaines depuis la droite, sur le dessin précédent et à sa largeur ; s’il a
    // été fait bande cachée, la position voulue est gardée.
    if (chartWidth && slotWidth) {
      const fromEnd = viewport.scrollWidth - chartWidth - viewport.scrollLeft;
      weeksFromEnd = Math.max(0, Math.round(fromEnd / slotWidth));
    }
    chartWidth = viewport.clientWidth;
    const count = doneWeeks.length;
    slotWidth = Math.max(chartWidth, 240) / VISIBLE_WEEKS;
    const slot = slotWidth;
    const width = slot * count;
    const done = doneWeeks.map(week => week.totals[selectedMetric]);
    const planned = plannedWeeks.map(week => week.totals[selectedMetric]);
    const max = Math.max(...done, ...planned, 0) || 1;
    const xAt = index => slot * index + slot / 2;
    const yAt = value => BASELINE - (value / max) * (BASELINE - PLOT_TOP);

    const svg = svgElement("svg", {
      viewBox: `0 0 ${width} ${CHART_HEIGHT}`,
      width,
      height: CHART_HEIGHT,
      role: "group",
      "aria-label": `${metric.label} par semaine`
    });
    svg.append(
      svgElement("line", {
        x1: 0,
        x2: width,
        y1: BASELINE,
        y2: BASELINE,
        class: "activity-chart-axis"
      })
    );

    // Moyenne des semaines terminées les plus récentes (11 au plus).
    const recentWeeks = doneWeeks.slice(
      Math.max(0, currentIndex - AVERAGE_WEEKS),
      currentIndex + 1
    );
    const average = averageOfPastWeeks(recentWeeks, selectedMetric);
    averageLabel.hidden = average <= 0;
    if (average > 0) {
      const y = yAt(average);
      svg.append(
        svgElement("line", { x1: 0, x2: width, y1: y, y2: y, class: "activity-chart-average" })
      );
      averageLabel.style.top = `${y - 13}px`;
      averageLabel.replaceChildren("moy.", document.createElement("br"), metric.format(average));
    }

    // Réalisé : traits droits jusqu’à la semaine en cours, avec une aire légère dessous.
    const doneLine = done
      .slice(0, currentIndex + 1)
      .map((value, index) => `${index ? "L" : "M"} ${xAt(index)} ${yAt(value)}`)
      .join(" ");
    svg.append(
      svgElement("path", {
        d: `${doneLine} L ${xAt(currentIndex)} ${BASELINE} L ${xAt(0)} ${BASELINE} Z`,
        class: "activity-chart-area"
      }),
      svgElement("path", { d: doneLine, class: "activity-chart-line" })
    );
    // Prévu : tirets de la semaine en cours aux semaines à venir.
    const plannedLine = planned
      .slice(currentIndex)
      .map((value, step) => `${step ? "L" : "M"} ${xAt(currentIndex + step)} ${yAt(value)}`)
      .join(" ");
    svg.append(svgElement("path", { d: plannedLine, class: "activity-chart-planned-line" }));

    points = done.map((value, index) => {
      const x = xAt(index);
      const remainder = hasPlannedRemainder(index);
      const isCurrent = index === currentIndex;
      const isFuture = index > currentIndex;
      const group = svgElement("g", {
        class: `activity-chart-point${isCurrent ? " is-current" : ""}`,
        role: "button",
        "aria-label":
          `${formatLongDate(doneWeeks[index].start)}, ${metric.format(value)}` +
          (remainder ? `, prévu ${metric.format(planned[index])}` : "") +
          (isCurrent ? ", semaine en cours" : "")
      });
      group.append(
        svgElement("rect", {
          x: slot * index,
          y: 0,
          width: slot,
          height: BASELINE,
          class: "activity-chart-hit-area"
        }),
        svgElement("line", {
          x1: x,
          x2: x,
          y1: PLOT_TOP - 4,
          y2: BASELINE,
          class: "activity-chart-guide"
        })
      );
      if (remainder) {
        group.append(
          svgElement("circle", {
            cx: x,
            cy: yAt(planned[index]),
            r: 3.5,
            class: "activity-chart-planned-point"
          })
        );
      }
      // Pas de point réalisé dans les semaines à venir.
      if (!isFuture) {
        group.append(
          svgElement("circle", {
            cx: x,
            cy: yAt(value),
            r: 3.5,
            class: "activity-chart-done-point"
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

      // Une date toutes les trois semaines, calée sur la semaine en cours.
      if ((index - currentIndex) % 3 === 0) {
        svg.append(
          svgElement(
            "text",
            { x, y: CHART_HEIGHT - 6, class: "activity-chart-week-label" },
            formatShortDayMonth(doneWeeks[index].start)
          )
        );
      }
      return group;
    });

    viewport.replaceChildren(svg);
    viewport.scrollLeft = viewport.scrollWidth - viewport.clientWidth - weeksFromEnd * slotWidth;
  }
}

/**
 * À la souris, la bande se fait glisser comme au doigt ; un glisser ne choisit pas de semaine.
 * @param {HTMLElement} viewport
 */
function enableMouseDrag(viewport) {
  let startX = 0;
  let startScroll = 0;
  let pressed = false;
  let dragged = false;
  viewport.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pressed = true;
    dragged = false;
    startX = event.clientX;
    startScroll = viewport.scrollLeft;
  });
  viewport.addEventListener("pointermove", event => {
    if (!pressed) return;
    const distance = event.clientX - startX;
    if (!dragged && Math.abs(distance) > 4) {
      dragged = true;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(event.pointerId);
    }
    if (dragged) viewport.scrollLeft = startScroll - distance;
  });
  const release = event => {
    pressed = false;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);
  viewport.addEventListener(
    "click",
    event => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
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
