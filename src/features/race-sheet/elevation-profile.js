// Profil d’altitude d’une fiche : lecture du GPX, tracé SVG et progression en course.

import {
  PLOT,
  buildElevationProfile,
  computeElevationStep,
  computeProgress
} from "../../domain/elevation-profile.js";
import { el } from "../../ui/dom.js";
import { formatNumber } from "../../ui/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";

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

const formatKm = km =>
  km
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");

function drawGrid(profile) {
  const grid = svg("g", { class: "elevation-grid" });
  const elevationRange = profile.maxElevation - profile.minElevation;
  const elevationStep = computeElevationStep(elevationRange);
  for (
    let elevation = profile.minElevation;
    elevation <= profile.maxElevation;
    elevation += elevationStep
  ) {
    const y =
      PLOT.top + ((profile.maxElevation - elevation) / elevationRange) * (PLOT.bottom - PLOT.top);
    grid.append(
      svg("line", { x1: PLOT.left, y1: y, x2: PLOT.right, y2: y }),
      svg("text", { x: PLOT.left - 8, y: y + 4, "text-anchor": "end" }, `${elevation} m`)
    );
  }
  for (let km = 0; km <= Math.floor(profile.distanceKm / 10) * 10; km += 10) {
    const x = PLOT.left + (km / profile.distanceKm) * (PLOT.right - PLOT.left);
    grid.append(
      svg("line", { x1: x, y1: PLOT.bottom, x2: x, y2: PLOT.bottom + 5 }),
      svg("text", { x, y: PLOT.bottom + 18, "text-anchor": "middle" }, `${km}`)
    );
  }
  grid.append(
    svg(
      "text",
      { x: PLOT.right, y: PLOT.bottom + 18, "text-anchor": "end" },
      `${profile.distanceKm.toFixed(1).replace(".", ",")} km`
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
  const circle = svg("circle", {
    class: "elevation-stop-dot",
    r: 5,
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
      y: marker.y < 53 ? 15 : -11,
      "text-anchor": marker.id === "start" ? "start" : marker.id === "finish" ? "end" : "middle"
    },
    name
  );
  const stop = svg("g", {
    class: "elevation-stop",
    transform: `translate(${marker.x} ${marker.y})`
  });
  stop.append(circle, label);
  return stop;
}

/**
 * @param {Object} race Fiche avec plan personnel appliqué ; `profile.gpx` est présent.
 * @returns {{ element: HTMLElement, load: (checkpoints: { isChecked: (id: string) => boolean, toggle: (id: string) => void }) => Promise<void>, update: () => void }}
 */
export function createElevationSection(race) {
  const chart = svg("svg", {
    class: "elevation-chart",
    viewBox: "0 0 900 285",
    role: "img",
    "aria-labelledby": "elevationTitle elevationDescription"
  });
  chart.append(
    svg("title", { id: "elevationTitle" }, `Profil d’altitude ${race.name}`),
    svg(
      "desc",
      { id: "elevationDescription" },
      "Profil de la trace GPX avec le départ, les ravitaillements et l’arrivée. Les points atteints sont colorés en orange."
    )
  );
  const progress = el("p", {
    className: "elevation-progress",
    text: "Chargement du profil…",
    attrs: { id: "elevationProgress", "aria-live": "polite" }
  });
  const element = el("section", { className: "section elevation-section" }, [
    el("div", { className: "elevation-heading" }, [
      el("div", {}, [
        el("h2", { text: "Profil de la course" }),
        el("p", { className: "elevation-caption", text: race.profile.caption })
      ]),
      el("span", {
        className: "elevation-ascent",
        text: `${formatNumber(race.ascentMeters)} m D+`
      })
    ]),
    chart,
    progress,
    el("p", {
      className: "elevation-hint",
      text: race.checkpoints?.length
        ? "Coche les ravitos dans « En course » pour actualiser ta progression sur le profil. Tu peux aussi toucher un repère."
        : "Profil d’altitude du parcours."
    })
  ]);

  const checkpointById = new Map(
    (race.checkpoints || []).map(checkpoint => [checkpoint.id, checkpoint])
  );
  const checkpointIds = new Set(checkpointById.keys());
  let update = () => {};

  function draw(profile, { isChecked, toggle }) {
    const first = profile.samples[0];
    const last = profile.samples[profile.samples.length - 1];
    const samplePoints = profile.samples.map(point => point.join(",")).join(" ");
    const completed = svg("polyline", {
      class: "elevation-completed",
      id: "profileCompleted",
      points: ""
    });
    const current = svg("circle", {
      class: "elevation-current",
      id: "profileCurrent",
      cx: "0",
      cy: "0",
      r: "7",
      visibility: "hidden"
    });
    const markersLayer = svg("g", { class: "elevation-markers" });
    for (const marker of profile.markers) {
      markersLayer.append(
        drawMarker(marker, checkpointById.get(marker.id), () => toggle(marker.id))
      );
    }
    chart.append(
      svg("polygon", {
        class: "elevation-area",
        points: [`${first[0]},${PLOT.bottom}`, samplePoints, `${last[0]},${PLOT.bottom}`].join(" ")
      }),
      drawGrid(profile),
      svg("polyline", { class: "elevation-line", points: samplePoints }),
      completed,
      svg("path", {
        class: "elevation-axis",
        d: `M ${PLOT.left} ${PLOT.top} V ${PLOT.bottom} H ${PLOT.right}`
      }),
      markersLayer,
      current
    );

    update = () => {
      const state = computeProgress(profile, checkpointIds, isChecked);
      if (!state) return;
      const { marker, points, remainingKm } = state;
      completed.setAttribute("points", points.map(point => point.join(",")).join(" "));
      current.setAttribute("cx", marker.x);
      current.setAttribute("cy", marker.y);
      current.setAttribute("visibility", marker.km > 0 ? "visible" : "hidden");
      const name =
        marker.id === "start" ? "Départ" : checkpointById.get(marker.id)?.name || "Arrivée";
      progress.textContent = `${name} · KM ${formatKm(marker.km)} · ${remainingKm.toFixed(1).replace(".", ",")} km restants`;
      for (const stop of profile.markers) {
        if (stop.id === "start") continue;
        const dot = chart.querySelector(`[data-profile-stop="${CSS.escape(stop.id)}"]`);
        if (!dot) continue;
        dot.classList.toggle("is-done", isChecked(stop.id));
        dot.setAttribute("aria-pressed", String(isChecked(stop.id)));
      }
    };
    update();
  }

  async function load(checkpoints) {
    try {
      let gpxText = race.profile.gpxData;
      if (typeof gpxText !== "string") {
        const response = await fetch(new URL(race.profile.gpx, document.baseURI));
        if (!response.ok) throw new Error(`GPX indisponible (${response.status}).`);
        gpxText = await response.text();
      }
      const profile = buildElevationProfile(parseGpxTrackpoints(gpxText), race.checkpoints || []);
      draw(profile, checkpoints);
    } catch (error) {
      console.error("Impossible de charger ou de lire la trace GPX.", error);
      progress.textContent = "Profil d’altitude indisponible.";
    }
  }

  return { element, load, update: () => update() };
}
