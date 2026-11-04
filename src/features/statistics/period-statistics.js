// Onglet Stats : totaux d’une semaine, d’un mois ou d’une année comparés à la période précédente,
// graphique en barres pour choisir la période, répartition par sport et records.

import { formatDuration } from "../../domain/durations.js";
import {
  PERIOD_COUNTS,
  comparePeriods,
  computeChange,
  findRecords,
  listPeriods,
  splitBySport,
  summarize
} from "../../domain/period-statistics.js";
import { filterCompletedWorkouts, getWorkoutsInWeek } from "../../domain/statistics.js";
import { parseDateKey } from "../../domain/dates.js";
import { el } from "../../ui/dom.js";
import {
  capitalize,
  formatLongDate,
  formatMonthYear,
  formatNumber,
  formatShortDayMonth,
  formatShortMonth
} from "../../ui/format.js";
import { WORKOUT_TYPE_LABELS } from "../workouts/workout-labels.js";

const ALL_TYPES = Object.keys(WORKOUT_TYPE_LABELS);
const CATEGORIES = Object.freeze({
  combined: ["trail", "running"],
  all: ALL_TYPES,
  trail: ["trail"],
  running: ["running"],
  cycling: ["cycling"]
});
const SPORT_LABELS = Object.freeze({ ...WORKOUT_TYPE_LABELS, strength: "Renfo" });

const formatKm = value => `${formatNumber(value)} km`;
const formatMeters = value => `${formatNumber(Math.round(value))} m`;
const METRICS = Object.freeze({
  distance: { label: "Distance", format: formatKm },
  duration: { label: "Temps", format: value => formatDuration(value) },
  ascent: { label: "D+", format: formatMeters },
  effort: { label: "Km-effort", format: formatKm },
  count: { label: "Sorties", format: value => String(value) }
});

/** « 2 – 8 nov. 2026 », « Novembre 2026 » ou « 2026 ». */
function formatPeriod(period) {
  if (period.kind === "month") return capitalize(formatMonthYear(period.start));
  if (period.kind === "year") return String(period.start.getFullYear());
  const sameYear = period.start.getFullYear() === period.end.getFullYear();
  return sameYear
    ? `${formatShortDayMonth(period.start)} – ${formatShortDayMonth(period.end)} ${period.end.getFullYear()}`
    : `${formatLongDate(period.start)} – ${formatLongDate(period.end)}`;
}

/** Libellé court sous une barre. */
function formatBarLabel(period) {
  if (period.kind === "month") return formatShortMonth(period.start).replace(".", "");
  if (period.kind === "year") return String(period.start.getFullYear());
  return formatShortDayMonth(period.start).replace(".", "");
}

/** « la semaine du 26 oct. », « octobre 2026 », « 2025 ». */
function formatPreviousPeriod(period) {
  if (period.kind === "week") return `la semaine du ${formatShortDayMonth(period.start)}`;
  if (period.kind === "month") return formatMonthYear(period.start);
  return String(period.start.getFullYear());
}

/** « ▲ 12 % », « ▼ 5 % », « = », ou « — » sans base de comparaison. */
function formatChange(change) {
  if (change === null) return { text: "—", label: "pas de comparaison", trend: "none" };
  const percent = Math.round(change * 100);
  if (percent === 0) return { text: "= 0 %", label: "stable", trend: "flat" };
  const text = `${formatNumber(Math.abs(percent))} %`;
  return percent > 0
    ? { text: `▲ ${text}`, label: `en hausse de ${text}`, trend: "up" }
    : { text: `▼ ${text}`, label: `en baisse de ${text}`, trend: "down" };
}

/** Donne à une barre sa hauteur ou sa largeur, en fraction de la place disponible. */
function withSize(element, property, fraction) {
  element.style[property] = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return element;
}

/**
 * @param {HTMLElement} container Vue Stats, avec ses éléments `#stats…`.
 * @returns {(records: Object[]) => void} Met à jour les séances et courses validées affichées.
 */
export function initializePeriodStatistics(container) {
  const kindsElement = container.querySelector("#statsPeriodKinds");
  const categoriesElement = container.querySelector("#statsCategories");
  const metricsElement = container.querySelector("#statsMetrics");
  const title = container.querySelector("#statsPeriodTitle");
  const compareLabel = container.querySelector("#statsCompareLabel");
  const kpis = container.querySelector("#statsKpis");
  const chart = container.querySelector("#statsChart");
  const sports = container.querySelector("#statsSports");
  const sportsPeriod = container.querySelector("#statsSportsPeriod");
  const records = container.querySelector("#statsRecords");
  let allRecords = [];
  let kind = "month";
  let category = "combined";
  let metric = "distance";
  let selectedIndex = PERIOD_COUNTS[kind] - 1;

  bindChoice(kindsElement, "kind", value => {
    kind = value;
    selectedIndex = PERIOD_COUNTS[kind] - 1;
  });
  bindChoice(categoriesElement, "category", value => (category = value));
  bindChoice(metricsElement, "metric", value => (metric = value));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
  render();

  return nextRecords => {
    allRecords = nextRecords;
    render();
  };

  function bindChoice(group, name, apply) {
    group.addEventListener("click", event => {
      const button = event.target.closest(`[data-${name}]`);
      if (!button) return;
      apply(button.dataset[name]);
      for (const item of group.querySelectorAll(`[data-${name}]`)) {
        item.setAttribute("aria-pressed", String(item === button));
      }
      render();
    });
  }

  function render() {
    const today = new Date();
    const periods = listPeriods(today, kind);
    const period = periods[selectedIndex];
    const completed = filterCompletedWorkouts(allRecords, ALL_TYPES);
    const workouts = completed.filter(workout => CATEGORIES[category].includes(workout.type));
    const comparison = comparePeriods(workouts, period, today);

    title.textContent = formatPeriod(period);
    compareLabel.textContent = `Par rapport à ${formatPreviousPeriod(comparison.previousPeriod)}${
      comparison.isToDate ? " à la même date" : ""
    }`;
    renderKpis(comparison);
    renderChart(periods, workouts);
    sportsPeriod.textContent = formatPeriod(period);
    renderSports(getWorkoutsInWeek(completed, period));
    renderRecords(findRecords(workouts));
  }

  function renderKpis({ current, previous }) {
    kpis.replaceChildren(
      ...Object.entries(METRICS).map(([key, { label, format }]) => {
        const change = formatChange(computeChange(current[key], previous[key]));
        return el("div", { className: "stats-kpi" }, [
          el("dt", { text: label }),
          el("dd", { text: format(current[key]) }),
          el("dd", {
            className: "stats-change",
            text: change.text,
            attrs: { "data-trend": change.trend, "aria-label": change.label }
          })
        ]);
      })
    );
  }

  function renderChart(periods, workouts) {
    const values = periods.map(period => summarize(getWorkoutsInWeek(workouts, period))[metric]);
    const max = Math.max(...values, 0) || 1;
    const { label, format } = METRICS[metric];
    chart.setAttribute("aria-label", `${label} par période`);
    chart.replaceChildren(
      ...periods.map((period, index) => {
        const isSelected = index === selectedIndex;
        const showLabel =
          period.kind !== "week" || isSelected || (periods.length - 1 - index) % 3 === 0;
        const button = el(
          "button",
          {
            className: "stats-bar",
            attrs: {
              type: "button",
              "aria-pressed": String(isSelected),
              "aria-label": `${formatPeriod(period)} : ${format(values[index])}`
            }
          },
          [
            el("span", { className: "stats-bar-track" }, [
              withSize(el("span", { className: "stats-bar-fill" }), "height", values[index] / max)
            ]),
            el("span", {
              className: "stats-bar-label",
              text: showLabel ? formatBarLabel(period) : ""
            })
          ]
        );
        button.addEventListener("click", () => {
          selectedIndex = index;
          render();
          chart.querySelectorAll(".stats-bar")[index].focus();
        });
        return button;
      })
    );
  }

  function renderSports(periodWorkouts) {
    const split = splitBySport(periodWorkouts);
    if (!split.length) {
      sports.replaceChildren(
        el("li", { className: "stats-empty", text: "Aucune sortie réalisée sur cette période." })
      );
      return;
    }
    const totalDuration = split.reduce((sum, item) => sum + item.totals.duration, 0);
    sports.replaceChildren(
      ...split.map(({ type, totals }) => {
        const share = totalDuration ? Math.round((totals.duration / totalDuration) * 100) : 0;
        const details = [`${totals.count} sortie${totals.count > 1 ? "s" : ""}`];
        if (totals.distance) details.push(formatKm(totals.distance));
        if (totals.ascent) details.push(`${formatMeters(totals.ascent)} D+`);
        return el("li", { className: "stats-sport" }, [
          el("div", { className: "stats-sport-heading" }, [
            el("strong", { text: SPORT_LABELS[type] || type }),
            el("span", {
              text: `${formatDuration(totals.duration, { minuteUnit: true })} · ${share} %`
            })
          ]),
          el("span", { className: "stats-sport-track", attrs: { "aria-hidden": "true" } }, [
            withSize(el("span", { className: "stats-sport-fill" }), "width", share / 100)
          ]),
          el("p", { className: "stats-sport-details", text: details.join(" · ") })
        ]);
      })
    );
  }

  function renderRecords(found) {
    const workoutDetail = workout =>
      `${workout.title || SPORT_LABELS[workout.type] || ""} · ${formatLongDate(parseDateKey(workout.date))}`;
    const rows = [
      ["Plus longue sortie", found.distance, w => formatKm(w.distanceKm), workoutDetail],
      ["Plus gros D+", found.ascent, w => formatMeters(w.ascentMeters), workoutDetail],
      [
        "Plus longue durée",
        found.duration,
        w => formatDuration(w.durationMinutes, { minuteUnit: true }),
        workoutDetail
      ],
      [
        "Meilleure semaine",
        found.week,
        best => formatKm(best.totals.distance),
        best => formatPeriod(best.period)
      ],
      [
        "Meilleur mois",
        found.month,
        best => formatKm(best.totals.distance),
        best => formatPeriod(best.period)
      ]
    ].filter(([, value]) => value);
    if (!rows.length) {
      records.replaceChildren(
        el("p", { className: "stats-empty", text: "Les records apparaîtront avec tes sorties." })
      );
      return;
    }
    records.replaceChildren(
      el(
        "dl",
        { className: "stats-records" },
        rows.map(([label, value, formatValue, formatDetail]) =>
          el("div", { className: "stats-record" }, [
            el("dt", { text: label }),
            el("dd", { className: "stats-record-value", text: formatValue(value) }),
            el("dd", { className: "stats-record-detail", text: formatDetail(value) })
          ])
        )
      )
    );
  }
}
