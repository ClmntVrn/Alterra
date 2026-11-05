// Profil d’altitude d’une fiche : lecture du GPX, courbe colorée selon la pente, ravitos, sections,
// lecture au doigt et plein écran avec zoom à deux doigts.

import {
  buildElevationProfile,
  computeAxisStep,
  computeProgress,
  computeSections,
  computeSlopeSegments,
  elevationAt,
  gradeAt,
  measureTrack
} from "../../domain/elevation-profile.js";
import { estimatePassage, formatElapsed } from "../../domain/race-timing.js";
import { el } from "../../ui/dom.js";
import { formatNumber } from "../../ui/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
// Marges du tracé en pixels : altitudes à gauche, km en bas, noms des repères au-dessus.
const MARGIN = Object.freeze({ left: 42, right: 14, top: 44, bottom: 24 });
// Plein écran : place supplémentaire sous l’axe pour la bande des sections.
const SECTION_BAND_HEIGHT = 36;
// Lignes des noms de repères, en pixels depuis le haut.
const LABEL_ROWS = Object.freeze([14, 30]);
// Toucher autour d’un repère : rayon de la zone active, plus large que le point dessiné.
const STOP_HIT_RADIUS = 18;
// Largeur réservée au total de km au bout de l’axe, en pixels.
const TOTAL_LABEL_SPACE = 56;
// Zoom : plus petite partie affichée, en km.
const MIN_VIEW_KM = 1;

function svg(name, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

/** Icône au trait, comme celle du bouton retour de la fiche. */
function icon(path) {
  const node = svg("svg", {
    "aria-hidden": "true",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  node.append(svg("path", { d: path }));
  return node;
}

/** Points de trace d’un GPX : latitude, longitude et altitude. */
export function parseGpxTrackpoints(gpxText) {
  const xml = new DOMParser().parseFromString(gpxText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) {
    throw new Error("Le fichier GPX n’est pas un XML valide.");
  }
  return [...xml.getElementsByTagNameNS("*", "trkpt")].map(trackpoint => {
    const latitude = Number(trackpoint.getAttribute("lat"));
    const longitude = Number(trackpoint.getAttribute("lon"));
    const elevation = Number(trackpoint.getElementsByTagNameNS("*", "ele")[0]?.textContent);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(elevation)) {
      throw new Error("Un point GPX ne contient pas une position ou une altitude valide.");
    }
    return { latitude, longitude, elevation };
  });
}

const points = list => list.map(point => point.join(",")).join(" ");
const underCurve = (list, bottom) =>
  list.length > 1 ? points([[list[0][0], bottom], ...list, [list.at(-1)[0], bottom]]) : "";

function markerName(marker, checkpoint) {
  if (marker.id === "start") return "Départ";
  if (marker.id === "finish") return checkpoint?.name || "Arrivée";
  return checkpoint?.name || marker.id;
}

function drawGrid(profile) {
  const { plot } = profile;
  const grid = svg("g", { class: "elevation-grid" });
  const range = profile.maxElevation - profile.minElevation;
  const step = profile.elevationStep;
  for (
    let elevation = Math.ceil(profile.minElevation / step) * step;
    elevation <= profile.maxElevation;
    elevation += step
  ) {
    const y = profile.yAt(elevation);
    grid.append(
      svg("line", { x1: plot.left, y1: y, x2: plot.right, y2: y }),
      svg("text", { x: plot.left - 6, y: y + 4, "text-anchor": "end" }, `${elevation}`)
    );
  }
  if (!range) return grid;
  const spanKm = profile.toKm - profile.fromKm;
  const kmStep = computeAxisStep(spanKm);
  for (let km = Math.ceil(profile.fromKm / kmStep) * kmStep; km < profile.toKm; km += kmStep) {
    const x = profile.xAt(km);
    // Les graduations laissent la place à la borne de droite.
    if (plot.right - x < TOTAL_LABEL_SPACE) break;
    grid.append(
      svg("line", { x1: x, y1: plot.bottom, x2: x, y2: plot.bottom + 5 }),
      svg("text", { x, y: plot.bottom + 18, "text-anchor": "middle" }, formatNumber(km))
    );
  }
  grid.append(
    svg(
      "text",
      { x: plot.right, y: plot.bottom + 18, "text-anchor": "end" },
      `${formatNumber(profile.toKm)} km`
    )
  );
  return grid;
}

/** Courbe colorée selon la pente : surface claire et trait plein, tronçon par tronçon. */
function drawSlopes(profile, slopes) {
  const layer = svg("g", { class: "elevation-slopes" });
  for (const segment of slopes) {
    if (segment.toKm <= profile.fromKm || segment.fromKm >= profile.toKm) continue;
    const curve = profile.curve(segment.fromKm, segment.toKm);
    if (curve.length < 2) continue;
    layer.append(
      svg("polygon", {
        class: `elevation-slope-area slope-${segment.band}`,
        points: underCurve(curve, profile.plot.bottom)
      }),
      svg("polyline", {
        class: `elevation-slope-line slope-${segment.band}`,
        points: points(curve)
      })
    );
  }
  return layer;
}

/** Fonds alternés des sections entre ravitos ; en plein écran, leurs chiffres sous l’axe. */
function drawSections(profile, sections, withFigures) {
  const layer = svg("g", { class: "elevation-sections-band" });
  sections.forEach((section, index) => {
    const from = Math.max(section.fromKm, profile.fromKm);
    const to = Math.min(section.toKm, profile.toKm);
    if (to <= from) return;
    const x1 = profile.xAt(from);
    const x2 = profile.xAt(to);
    if (index % 2) {
      layer.append(
        svg("rect", {
          class: "elevation-section-shade",
          x: x1,
          y: profile.plot.top,
          width: x2 - x1,
          height: profile.plot.bottom - profile.plot.top
        })
      );
    }
    if (!withFigures) return;
    const x = (x1 + x2) / 2;
    const y = profile.plot.bottom + 34;
    const figures = svg("text", {
      class: "elevation-section-figures",
      x,
      y,
      "text-anchor": "middle"
    });
    figures.append(
      svg("tspan", { x, dy: 0 }, `${formatNumber(section.distanceKm)} km`),
      svg("tspan", { x, dy: 14 }, `+${section.ascentMeters} −${section.descentMeters}`)
    );
    figures.dataset.width = String(x2 - x1);
    layer.append(figures);
  });
  return layer;
}

function drawMarker(marker, checkpoint, profile, onToggle) {
  const name = markerName(marker, checkpoint);
  const interactive = marker.id !== "start" && Boolean(checkpoint);
  const group = svg("g", { class: "elevation-stop" });
  group.append(
    svg("line", {
      class: "elevation-guide",
      x1: marker.x,
      x2: marker.x,
      y1: LABEL_ROWS[1] + 6,
      y2: marker.y - 6
    })
  );
  const stop = svg("g", { transform: `translate(${marker.x} ${marker.y})` });
  const circle = svg("circle", {
    class: "elevation-stop-dot",
    r: 6,
    "data-profile-stop": marker.id,
    tabindex: interactive ? 0 : -1,
    role: interactive ? "button" : "img",
    "aria-label":
      marker.id === "start"
        ? "Départ, kilomètre zéro"
        : interactive
          ? `Marquer ${name} comme atteint`
          : name
  });
  if (interactive) {
    const hit = svg("circle", { class: "elevation-stop-hit", r: STOP_HIT_RADIUS });
    hit.addEventListener("click", onToggle);
    stop.append(hit);
    circle.setAttribute("aria-pressed", "false");
    circle.addEventListener("click", onToggle);
    circle.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    });
  }
  stop.append(circle);
  const atStart = marker.x - profile.plot.left < 40;
  const atEnd = profile.plot.right - marker.x < 40;
  const label = svg(
    "text",
    {
      class: "elevation-stop-label",
      x: marker.x,
      y: LABEL_ROWS[0],
      "text-anchor": atStart ? "start" : atEnd ? "end" : "middle",
      "aria-hidden": "true"
    },
    name
  );
  group.append(stop, label);
  return group;
}

/** Noms des repères sur deux lignes ; un nom qui gêne encore est masqué (le point reste). */
function separateLabels(labels) {
  const placed = [];
  const overlaps = box =>
    placed.some(
      other =>
        box.x < other.x + other.width + 6 &&
        other.x < box.x + box.width + 6 &&
        box.y < other.y + other.height &&
        other.y < box.y + box.height
    );
  for (const label of labels) {
    let box = label.getBBox();
    if (overlaps(box)) {
      label.setAttribute("y", LABEL_ROWS[1]);
      box = label.getBBox();
    }
    if (overlaps(box)) {
      label.setAttribute("visibility", "hidden");
      label.previousElementSibling?.previousElementSibling?.setAttribute("visibility", "hidden");
      continue;
    }
    placed.push(box);
  }
}

/** Chiffres d’une section masqués s’ils dépassent sa largeur à l’écran. */
function fitSectionFigures(chart) {
  for (const figures of chart.querySelectorAll(".elevation-section-figures")) {
    if (figures.getBBox().width > Number(figures.dataset.width) - 6) {
      figures.setAttribute("visibility", "hidden");
    }
  }
}

/**
 * Un graphique du profil (fiche ou plein écran).
 * @param {Object} race
 * @param {Object} options
 * @param {boolean} options.full Plein écran : hauteur de l’écran, bande des sections, zoom.
 * @param {Object} options.track Trace partagée : points GPX, mesure, pentes et sections.
 * @param {{ isChecked: (id: string) => boolean, toggle: (id: string) => void }} options.checkpoints
 * @param {() => number} options.getScenarioIndex
 * @param {(zoomed: boolean) => void} [options.onZoom]
 */
function createChart(race, { full, track, checkpoints, getScenarioIndex, onZoom }) {
  const chart = svg("svg", {
    class: "elevation-chart",
    role: "img",
    "aria-label": `Profil d’altitude ${race.name}, coloré selon la pente, avec les ravitaillements.`
  });
  const readout = el("div", { className: "elevation-readout", attrs: { "aria-live": "polite" } });
  readout.hidden = true;
  const wrapper = el("div", { className: `elevation-chart-wrap${full ? " is-full" : ""}` }, [
    chart,
    readout
  ]);
  const checkpointById = new Map((race.checkpoints || []).map(item => [item.id, item]));
  const checkpointIds = new Set(checkpointById.keys());
  let view = null;
  let profile = null;
  let cursorKm = null;
  let progressNodes = null;

  function measure() {
    // Dimensions de mise en page : justes aussi quand le plein écran est tourné.
    const width = Math.max(240, Math.round(wrapper.clientWidth));
    const height = full
      ? Math.max(220, Math.round(wrapper.clientHeight))
      : Math.round(Math.min(320, Math.max(220, width * 0.62)));
    const bottom = MARGIN.bottom + (full ? SECTION_BAND_HEIGHT : 0);
    return {
      width,
      height,
      plot: {
        left: MARGIN.left,
        right: width - MARGIN.right,
        top: MARGIN.top,
        bottom: height - bottom
      }
    };
  }

  function render() {
    const { width, height, plot } = measure();
    profile = buildElevationProfile(track.trackpoints, race.checkpoints || [], plot, view);
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    chart.setAttribute("height", height);
    chart.dataset.view = view ? `${profile.fromKm.toFixed(2)}-${profile.toKm.toFixed(2)}` : "";
    chart.replaceChildren();

    const completedArea = svg("polygon", { class: "elevation-completed-area", points: "" });
    const completed = svg("polyline", { class: "elevation-completed", points: "" });
    const position = svg("line", {
      class: "elevation-position",
      y1: LABEL_ROWS[1] + 6,
      y2: plot.bottom,
      visibility: "hidden"
    });
    const current = svg("circle", { class: "elevation-current", r: 8, visibility: "hidden" });
    const cursor = svg("g", { class: "elevation-cursor", visibility: "hidden" }, "");
    cursor.append(svg("line", { y1: plot.top - 4, y2: plot.bottom }), svg("circle", { r: 5 }));
    const markers = svg("g", { class: "elevation-markers" });
    for (const marker of profile.markers) {
      if (!marker.inView) continue;
      markers.append(
        drawMarker(marker, checkpointById.get(marker.id), profile, () =>
          checkpoints.toggle(marker.id)
        )
      );
    }
    chart.append(
      drawSections(profile, track.sections, full),
      drawGrid(profile),
      drawSlopes(profile, track.slopes),
      svg("polyline", { class: "elevation-line", points: points(profile.samples) }),
      completedArea,
      completed,
      position,
      svg("path", {
        class: "elevation-axis",
        d: `M ${plot.left} ${plot.top} V ${plot.bottom} H ${plot.right}`
      }),
      markers,
      cursor,
      current
    );
    separateLabels([...markers.querySelectorAll(".elevation-stop-label")]);
    if (full) fitSectionFigures(chart);
    progressNodes = { completedArea, completed, position, current, cursor };
    update();
    if (cursorKm !== null) showReadout(cursorKm);
    return profile;
  }

  function update() {
    if (!profile || !progressNodes) return;
    const { completedArea, completed, position, current } = progressNodes;
    const state = computeProgress(profile, checkpointIds, checkpoints.isChecked);
    if (!state) return;
    const { marker } = state;
    chart.dataset.reached = marker.id;
    completed.setAttribute("points", points(state.points));
    completedArea.setAttribute("points", underCurve(state.points, profile.plot.bottom));
    const visibility = marker.km > 0 && marker.inView ? "visible" : "hidden";
    for (const node of [current, position]) node.setAttribute("visibility", visibility);
    current.setAttribute("cx", marker.x);
    current.setAttribute("cy", marker.y);
    position.setAttribute("x1", marker.x);
    position.setAttribute("x2", marker.x);
    for (const stop of profile.markers) {
      if (stop.id === "start") continue;
      const dot = chart.querySelector(`[data-profile-stop="${CSS.escape(stop.id)}"]`);
      if (!dot) continue;
      dot.classList.toggle("is-done", checkpoints.isChecked(stop.id));
      dot.setAttribute("aria-pressed", String(checkpoints.isChecked(stop.id)));
    }
    if (cursorKm !== null) showReadout(cursorKm);
  }

  // Plein écran tenu droit : le graphe est tourné d’un quart de tour, l’axe des km suit l’écran
  // de haut en bas.
  const isRotated = () => full && matchMedia("(orientation: portrait)").matches;
  /** Abscisse dans le graphe d’un point touché, en pixels. */
  const localX = event => {
    const rect = chart.getBoundingClientRect();
    return isRotated() ? event.clientY - rect.top : event.clientX - rect.left;
  };
  const kmAtX = x => {
    const { plot } = profile;
    const ratio = Math.max(0, Math.min(1, (x - plot.left) / (plot.right - plot.left)));
    return profile.fromKm + ratio * (profile.toKm - profile.fromKm);
  };

  /** Km, altitude, pente et passage estimé au point touché. */
  function showReadout(km) {
    if (!profile) return;
    cursorKm = km;
    const elevation = elevationAt(profile.points, km);
    const grade = Math.round(gradeAt(profile.points, km));
    const x = profile.xAt(km);
    const y = profile.yAt(elevation);
    const { cursor } = progressNodes;
    cursor.setAttribute("visibility", "visible");
    cursor.firstChild.setAttribute("x1", x);
    cursor.firstChild.setAttribute("x2", x);
    cursor.lastChild.setAttribute("cx", x);
    cursor.lastChild.setAttribute("cy", y);

    const passage = estimatePassage(race.checkpoints, getScenarioIndex(), km);
    const lines = [
      `Km ${formatNumber(km)} · ${Math.round(elevation)} m · ${grade > 0 ? "+" : ""}${grade} %`
    ];
    if (passage) {
      lines.push(
        `Passage ${passage.clock ? `${passage.clock} · ` : ""}${formatElapsed(passage.elapsedMinutes)}`
      );
    }
    readout.replaceChildren(...lines.map(text => el("span", { text })));
    readout.hidden = false;
    const width = readout.offsetWidth;
    const max = wrapper.clientWidth - width;
    readout.style.left = `${Math.max(0, Math.min(max, x - width / 2))}px`;
  }

  function hideReadout() {
    cursorKm = null;
    readout.hidden = true;
    progressNodes?.cursor.setAttribute("visibility", "hidden");
  }

  function setView(fromKm, toKm) {
    const total = profile.distanceKm;
    const span = Math.max(MIN_VIEW_KM, toKm - fromKm);
    if (span >= total) {
      view = null;
    } else {
      const from = Math.max(0, Math.min(total - span, fromKm));
      view = { fromKm: from, toKm: from + span };
    }
    onZoom?.(Boolean(view));
    if (cursorKm !== null && view && (cursorKm < view.fromKm || cursorKm > view.toKm))
      hideReadout();
    render();
  }

  /** Zoom autour d’une distance qui reste sous le même point de l’écran. */
  function zoomAround(km, x, span) {
    const { plot } = profile;
    const ratio = Math.max(0, Math.min(1, (x - plot.left) / (plot.right - plot.left)));
    setView(km - ratio * span, km - ratio * span + span);
  }

  // Lecture au doigt (ou à la souris) ; en plein écran, deux doigts zooment et déplacent.
  const pointers = new Map();
  let pinch = null;
  let frame = 0;
  const schedule = task => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(task);
  };

  chart.addEventListener("pointerdown", event => {
    if (!profile) return;
    pointers.set(event.pointerId, localX(event));
    if (full && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        distance: Math.max(20, Math.abs(a - b)),
        span: profile.toKm - profile.fromKm,
        km: kmAtX((a + b) / 2)
      };
      hideReadout();
      return;
    }
    if (pointers.size === 1) showReadout(kmAtX(localX(event)));
  });
  chart.addEventListener("pointermove", event => {
    if (!profile) return;
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") showReadout(kmAtX(localX(event)));
      return;
    }
    pointers.set(event.pointerId, localX(event));
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const span = (pinch.span * pinch.distance) / Math.max(20, Math.abs(a - b));
      schedule(() => zoomAround(pinch.km, (a + b) / 2, span));
      return;
    }
    if (!pinch) showReadout(kmAtX(localX(event)));
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (event.type === "pointercancel") hideReadout();
  };
  chart.addEventListener("pointerup", release);
  chart.addEventListener("pointercancel", release);
  chart.addEventListener("pointerleave", event => {
    if (event.pointerType !== "mouse") return;
    pointers.delete(event.pointerId);
    hideReadout();
  });
  document.addEventListener("pointerdown", event => {
    if (!wrapper.contains(event.target)) hideReadout();
  });
  if (full) {
    chart.addEventListener(
      "wheel",
      event => {
        if (!profile) return;
        event.preventDefault();
        const span = (profile.toKm - profile.fromKm) * Math.exp(event.deltaY * 0.002);
        const x = localX(event);
        zoomAround(kmAtX(x), x, span);
      },
      { passive: false }
    );
  }

  return {
    element: wrapper,
    render,
    update,
    resetZoom: () => (profile ? setView(0, profile.distanceKm) : null)
  };
}

/** Légende des couleurs de pente. */
function renderLegend() {
  const swatch = (band, text) =>
    el("span", { className: "elevation-legend-item" }, [
      el("span", { className: `elevation-swatch slope-${band}`, attrs: { "aria-hidden": "true" } }),
      text
    ]);
  return el("p", { className: "elevation-legend" }, [
    swatch("easy", "< 5 %"),
    swatch("medium", "5–10 %"),
    swatch("hard", "≥ 10 %")
  ]);
}

/**
 * @param {Object} race Fiche avec plan personnel appliqué ; `profile.gpx` est présent.
 * @param {{ getScenarioIndex?: () => number }} [options]
 * @returns {{ element: HTMLElement, load: (checkpoints: { isChecked: (id: string) => boolean, toggle: (id: string) => void }) => Promise<Object | null>, update: () => void }}
 *   load renvoie le profil calculé, ou null si la trace est illisible.
 */
export function createElevationSection(race, { getScenarioIndex = () => 0 } = {}) {
  const status = el("p", {
    className: "elevation-status",
    text: "Chargement du profil…",
    attrs: { role: "status" }
  });
  const expand = el("button", {
    className: "home-button elevation-expand",
    attrs: { type: "button", "aria-label": "Profil en plein écran", title: "Plein écran" }
  });
  expand.append(icon("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"));
  expand.hidden = true;
  const body = el("div", { className: "elevation-body" }, [status]);
  const element = el("section", { className: "section elevation-section" }, [
    el("div", { className: "elevation-head" }, [el("h2", { text: "Profil de la course" }), expand]),
    body
  ]);

  let inline = null;
  let full = null;

  function openFull(track, checkpoints) {
    if (!full) {
      const reset = el("button", {
        className: "elevation-reset",
        text: "Course entière",
        attrs: { type: "button" }
      });
      reset.hidden = true;
      const back = el("button", {
        className: "home-button elevation-close",
        attrs: { type: "button", "aria-label": "Fermer le plein écran", title: "Retour" }
      });
      back.append(icon("M19 12H5M11 6l-6 6 6 6"));
      const chart = createChart(race, {
        full: true,
        track,
        checkpoints,
        getScenarioIndex,
        onZoom: zoomed => {
          reset.hidden = !zoomed;
        }
      });
      const dialog = el(
        "dialog",
        {
          className: "elevation-full",
          attrs: { "aria-label": `Profil de ${race.name}`, tabindex: "-1" }
        },
        [
          el("div", { className: "elevation-full-bar" }, [
            back,
            el("h2", { text: race.name }),
            reset
          ]),
          chart.element,
          renderLegend()
        ]
      );
      back.addEventListener("click", () => dialog.close());
      reset.addEventListener("click", () => chart.resetZoom());
      document.body.append(dialog);
      new ResizeObserver(() => {
        if (dialog.open) chart.render();
      }).observe(chart.element);
      full = { dialog, chart };
    }
    full.dialog.showModal();
    // Focus sur la fenêtre elle-même : pas d’anneau sur le bouton retour à l’ouverture.
    full.dialog.focus();
    full.chart.render();
  }

  async function load(checkpoints) {
    try {
      let gpxText = race.profile.gpxData;
      if (typeof gpxText !== "string") {
        const response = await fetch(new URL(race.profile.gpx, document.baseURI));
        if (!response.ok) throw new Error(`GPX indisponible (${response.status}).`);
        gpxText = await response.text();
      }
      const trackpoints = parseGpxTrackpoints(gpxText);
      const measured = measureTrack(trackpoints);
      const reference = buildElevationProfile(trackpoints, race.checkpoints || []);
      const track = {
        trackpoints,
        points: measured.points,
        slopes: computeSlopeSegments(measured.points),
        sections: computeSections(measured.points, reference.markers)
      };
      inline = createChart(race, { full: false, track, checkpoints, getScenarioIndex });
      body.replaceChildren(inline.element, renderLegend());
      const profile = { ...inline.render(), sections: track.sections };
      expand.hidden = false;
      expand.addEventListener("click", () => openFull(track, checkpoints));
      // Rotation de l’écran ou fenêtre redimensionnée : le tracé suit la nouvelle largeur.
      let drawnWidth = inline.element.getBoundingClientRect().width;
      new ResizeObserver(() => {
        const width = inline.element.getBoundingClientRect().width;
        if (Math.abs(width - drawnWidth) < 1) return;
        drawnWidth = width;
        inline.render();
      }).observe(inline.element);
      return profile;
    } catch (error) {
      console.error("Impossible de charger ou de lire la trace GPX.", error);
      status.textContent = "Profil d’altitude indisponible.";
      return null;
    }
  }

  return {
    element,
    load,
    update: () => {
      inline?.update();
      full?.chart.update();
    }
  };
}
