// Profil d’altitude d’une fiche : lecture du GPX, tracé SVG à la taille de l’écran et progression.

import {
  buildElevationProfile,
  computeAxisStep,
  computeProgress
} from "../../domain/elevation-profile.js";
import { el } from "../../ui/dom.js";
import { formatNumber } from "../../ui/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
// Marges du tracé en pixels : graduations d’altitude à gauche, de km en bas, noms au-dessus.
const MARGIN = Object.freeze({ left: 46, right: 12, top: 30, bottom: 26 });
// Toucher autour d’un repère : rayon de la zone active, plus large que le point dessiné.
const STOP_HIT_RADIUS = 18;

function svg(name, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
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

/** Taille du graphique : toute la largeur disponible, une hauteur lisible sur téléphone. */
function measureChart(chart) {
  const width = Math.max(240, Math.round(chart.getBoundingClientRect().width));
  const height = Math.round(Math.min(300, Math.max(210, width * 0.62)));
  return {
    width,
    height,
    plot: {
      left: MARGIN.left,
      right: width - MARGIN.right,
      top: MARGIN.top,
      bottom: height - MARGIN.bottom
    }
  };
}

function drawGrid(profile) {
  const { plot } = profile;
  const grid = svg("g", { class: "elevation-grid" });
  const elevationRange = profile.maxElevation - profile.minElevation;
  const elevationStep = computeAxisStep(elevationRange);
  for (
    let elevation = profile.minElevation;
    elevation <= profile.maxElevation;
    elevation += elevationStep
  ) {
    const y =
      plot.top + ((profile.maxElevation - elevation) / elevationRange) * (plot.bottom - plot.top);
    grid.append(
      svg("line", { x1: plot.left, y1: y, x2: plot.right, y2: y }),
      svg("text", { x: plot.left - 6, y: y + 4, "text-anchor": "end" }, `${elevation}`)
    );
  }
  const kmStep = computeAxisStep(profile.distanceKm);
  // La dernière graduation laisse la place au total, aligné à droite.
  for (let km = 0; km <= profile.distanceKm - kmStep / 2; km += kmStep) {
    const x = plot.left + (km / profile.distanceKm) * (plot.right - plot.left);
    grid.append(
      svg("line", { x1: x, y1: plot.bottom, x2: x, y2: plot.bottom + 5 }),
      svg("text", { x, y: plot.bottom + 18, "text-anchor": "middle" }, formatNumber(km))
    );
  }
  grid.append(
    svg(
      "text",
      { x: plot.right, y: plot.bottom + 18, "text-anchor": "end" },
      `${formatNumber(profile.distanceKm)} km`
    )
  );
  return grid;
}

function drawMarker(marker, checkpoint, onToggle) {
  const name =
    marker.id === "start"
      ? "Départ"
      : marker.id === "finish"
        ? "Arrivée"
        : checkpoint?.name || marker.id;
  const interactive = marker.id !== "start" && Boolean(checkpoint);
  const stop = svg("g", {
    class: "elevation-stop",
    transform: `translate(${marker.x} ${marker.y})`
  });
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
  const label = svg(
    "text",
    {
      class: "elevation-stop-label",
      x: 0,
      y: -12,
      "text-anchor": marker.id === "start" ? "start" : marker.id === "finish" ? "end" : "middle",
      "aria-hidden": "true"
    },
    name
  );
  stop.append(circle, label);
  return stop;
}

/**
 * Évite que les noms des repères se chevauchent : un nom gênant passe sous son point,
 * puis disparaît s’il gêne encore (le point reste).
 */
function separateLabels(labels, plot) {
  const placed = [];
  const overlaps = box =>
    placed.some(
      other =>
        box.x < other.x + other.width + 4 &&
        other.x < box.x + box.width + 4 &&
        box.y < other.y + other.height &&
        other.y < box.y + box.height
    );
  for (const label of labels) {
    const box = label.getBBox();
    const matrix = label.getCTM();
    const toChart = b => ({ ...b, x: b.x + (matrix?.e ?? 0), y: b.y + (matrix?.f ?? 0) });
    let chartBox = toChart(box);
    if (chartBox.y < plot.top - MARGIN.top || overlaps(chartBox)) {
      label.setAttribute("y", 22);
      chartBox = toChart(label.getBBox());
    }
    if (overlaps(chartBox)) {
      label.setAttribute("visibility", "hidden");
      continue;
    }
    placed.push(chartBox);
  }
}

/**
 * @param {Object} race Fiche avec plan personnel appliqué ; `profile.gpx` est présent.
 * @returns {{ element: HTMLElement, load: (checkpoints: { isChecked: (id: string) => boolean, toggle: (id: string) => void }) => Promise<Object | null>, update: () => void }}
 *   load renvoie le profil calculé, ou null si la trace est illisible.
 */
export function createElevationSection(race) {
  const chart = svg("svg", {
    class: "elevation-chart",
    role: "img",
    "aria-labelledby": "elevationTitle elevationDescription"
  });
  const title = svg("title", { id: "elevationTitle" }, `Profil d’altitude ${race.name}`);
  const description = svg(
    "desc",
    { id: "elevationDescription" },
    "Profil de la trace GPX avec le départ, les ravitaillements et l’arrivée. La partie parcourue est en orange."
  );
  chart.append(title, description);
  const status = el("p", {
    className: "elevation-status",
    text: "Chargement du profil…",
    attrs: { role: "status" }
  });
  const element = el("section", { className: "section elevation-section" }, [
    el("h2", { text: "Profil de la course" }),
    chart,
    status
  ]);

  const checkpointById = new Map(
    (race.checkpoints || []).map(checkpoint => [checkpoint.id, checkpoint])
  );
  const checkpointIds = new Set(checkpointById.keys());
  let update = () => {};

  function draw(trackpoints, { isChecked, toggle }) {
    const { width, height, plot } = measureChart(chart);
    const profile = buildElevationProfile(trackpoints, race.checkpoints || [], plot);
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    chart.replaceChildren(title, description);

    const samplePoints = profile.samples.map(point => point.join(",")).join(" ");
    const underCurve = points =>
      [
        `${points[0][0]},${plot.bottom}`,
        ...points.map(point => point.join(",")),
        `${points.at(-1)[0]},${plot.bottom}`
      ].join(" ");
    const completedArea = svg("polygon", { class: "elevation-completed-area", points: "" });
    const completed = svg("polyline", { class: "elevation-completed", points: "" });
    const position = svg("line", {
      class: "elevation-position",
      x1: 0,
      x2: 0,
      y1: plot.top - 6,
      y2: plot.bottom,
      visibility: "hidden"
    });
    const current = svg("circle", {
      class: "elevation-current",
      cx: "0",
      cy: "0",
      r: "8",
      visibility: "hidden"
    });
    const markersLayer = svg("g", { class: "elevation-markers" });
    for (const marker of profile.markers) {
      markersLayer.append(
        drawMarker(marker, checkpointById.get(marker.id), () => toggle(marker.id))
      );
    }
    chart.append(
      svg("polygon", { class: "elevation-area", points: underCurve(profile.samples) }),
      completedArea,
      drawGrid(profile),
      svg("polyline", { class: "elevation-line", points: samplePoints }),
      completed,
      position,
      svg("path", {
        class: "elevation-axis",
        d: `M ${plot.left} ${plot.top} V ${plot.bottom} H ${plot.right}`
      }),
      markersLayer,
      current
    );
    separateLabels([...markersLayer.querySelectorAll(".elevation-stop-label")], plot);

    update = () => {
      const state = computeProgress(profile, checkpointIds, isChecked);
      if (!state) return;
      const { marker, points } = state;
      chart.dataset.reached = marker.id;
      completed.setAttribute("points", points.map(point => point.join(",")).join(" "));
      completedArea.setAttribute("points", points.length > 1 ? underCurve(points) : "");
      const visibility = marker.km > 0 ? "visible" : "hidden";
      for (const node of [current, position]) node.setAttribute("visibility", visibility);
      current.setAttribute("cx", marker.x);
      current.setAttribute("cy", marker.y);
      position.setAttribute("x1", marker.x);
      position.setAttribute("x2", marker.x);
      for (const stop of profile.markers) {
        if (stop.id === "start") continue;
        const dot = chart.querySelector(`[data-profile-stop="${CSS.escape(stop.id)}"]`);
        if (!dot) continue;
        dot.classList.toggle("is-done", isChecked(stop.id));
        dot.setAttribute("aria-pressed", String(isChecked(stop.id)));
      }
    };
    update();
    return profile;
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
      const profile = draw(trackpoints, checkpoints);
      status.hidden = true;
      // Rotation de l’écran ou fenêtre redimensionnée : le tracé suit la nouvelle largeur.
      let drawnWidth = chart.getBoundingClientRect().width;
      new ResizeObserver(() => {
        const width = chart.getBoundingClientRect().width;
        if (Math.abs(width - drawnWidth) < 1) return;
        drawnWidth = width;
        draw(trackpoints, checkpoints);
      }).observe(element);
      return profile;
    } catch (error) {
      console.error("Impossible de charger ou de lire la trace GPX.", error);
      status.textContent = "Profil d’altitude indisponible.";
      return null;
    }
  }

  return { element, load, update: () => update() };
}
