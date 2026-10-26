import { createPersonalDataStore } from "../app/personal-data.js";
import { loadRaceCatalog } from "../app/race-catalog.js";

const content = document.getElementById("raceContent");
const raceId = new URLSearchParams(location.search).get("id");
const siteRoot = new URL("../", location.href);
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric"
});
const personalData = createPersonalDataStore();

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function localDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatRaceDates(race) {
  const start = localDate(race.date);
  if (!race.endDate || race.endDate === race.date) return dateFormatter.format(start);
  const end = localDate(race.endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = sameYear
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(start)
    : dateFormatter.format(start);
  return `${startText} – ${dateFormatter.format(end)}`;
}

function formatDuration(duration) {
  return duration.replace(":", "h");
}

function formatKilometers(kilometers) {
  return Number(kilometers).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function addText(parent, tag, className, text) {
  const node = makeElement(tag, className, text);
  parent.append(node);
  return node;
}

function renderHero(race) {
  const hero = makeElement("section", "hero");
  addText(hero, "h1", "", race.name);
  const subtitle = [
    formatRaceDates(race),
    race.startTime ? `Départ ${race.startTime}` : "",
    race.route || ""
  ]
    .filter(Boolean)
    .join(" · ");
  addText(hero, "p", "sub", subtitle);

  const stats = makeElement("div", "stats");
  const values = [
    [`${formatKilometers(race.distanceKm)} km`, "Distance"],
    [`${Number(race.ascentMeters).toLocaleString("fr-FR")} m`, "D+"],
    race.targetTime ? [race.targetTime, "Temps cible"] : null
  ].filter(Boolean);
  stats.style.gridTemplateColumns = `repeat(${values.length}, minmax(0, 1fr))`;
  values.forEach(([value, label]) => {
    const stat = makeElement("div", "stat");
    addText(stat, "strong", "", value);
    addText(stat, "span", "", label);
    stats.append(stat);
  });
  hero.append(stats);
  if (race.distanceNote) addText(hero, "p", "sub", race.distanceNote);

  const pills = makeElement("div", "pills");
  if (race.targetFinish)
    pills.append(makeElement("span", "pill", `Arrivée cible ${race.targetFinish}`));
  if (race.cutoff) pills.append(makeElement("span", "pill", `Barrière max. ${race.cutoff}`));
  if (race.stones) pills.append(makeElement("span", "pill", `${race.stones} Running Stones`));
  if (pills.childElementCount) hero.append(pills);
  return hero;
}

function renderElevationSection(race) {
  const section = makeElement("section", "section elevation-section");
  const heading = makeElement("div", "elevation-heading");
  const headingText = document.createElement("div");
  addText(headingText, "h2", "", "Profil de la course");
  addText(headingText, "p", "elevation-caption", race.profile.caption);
  heading.append(
    headingText,
    makeElement(
      "span",
      "elevation-ascent",
      `${Number(race.ascentMeters).toLocaleString("fr-FR")} m D+`
    )
  );
  section.append(heading);

  const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chart.setAttribute("class", "elevation-chart");
  chart.setAttribute("viewBox", "0 0 900 285");
  chart.setAttribute("role", "img");
  chart.setAttribute("aria-labelledby", "elevationTitle elevationDescription");
  const title = document.createElementNS(chart.namespaceURI, "title");
  title.id = "elevationTitle";
  title.textContent = `Profil d’altitude ${race.name}`;
  const description = document.createElementNS(chart.namespaceURI, "desc");
  description.id = "elevationDescription";
  description.textContent =
    "Profil de la trace GPX avec le départ, les ravitaillements et l’arrivée. Les points atteints sont colorés en orange.";
  chart.append(title, description);
  section.append(chart);

  const progress = makeElement("p", "elevation-progress", "Chargement du profil…");
  progress.id = "elevationProgress";
  progress.setAttribute("aria-live", "polite");
  section.append(progress);
  section.append(
    makeElement(
      "p",
      "elevation-hint",
      race.checkpoints?.length
        ? "Coche les ravitos dans « En course » pour actualiser ta progression sur le profil. Tu peux aussi toucher un repère."
        : "Profil d’altitude du parcours."
    )
  );

  return section;
}

function showProfileError(progress, message) {
  console.error(message);
  progress.textContent = "Profil d’altitude indisponible.";
}

function parseGpxProfile(gpxText, race) {
  const xml = new DOMParser().parseFromString(gpxText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) {
    throw new Error("Le fichier GPX n’est pas un XML valide.");
  }
  const trackpoints = [...xml.getElementsByTagNameNS("*", "trkpt")].map(trackpoint => {
    const elevationNode = trackpoint.getElementsByTagNameNS("*", "ele")[0];
    const latitude = Number(trackpoint.getAttribute("lat"));
    const longitude = Number(trackpoint.getAttribute("lon"));
    const elevation = Number(elevationNode?.textContent);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(elevation)) {
      throw new Error("Un point GPX ne contient pas une position ou une altitude valide.");
    }
    return { latitude, longitude, elevation, distanceKm: 0 };
  });
  if (trackpoints.length < 2) {
    throw new Error("Le GPX ne contient pas assez de points de trace.");
  }

  const radians = degrees => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  let distanceKm = 0;
  for (let index = 1; index < trackpoints.length; index += 1) {
    const previous = trackpoints[index - 1];
    const current = trackpoints[index];
    const latitudeDelta = radians(current.latitude - previous.latitude);
    const longitudeDelta = radians(current.longitude - previous.longitude);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(radians(previous.latitude)) *
        Math.cos(radians(current.latitude)) *
        Math.sin(longitudeDelta / 2) ** 2;
    distanceKm += earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    current.distanceKm = distanceKm;
  }
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("La distance de la trace GPX est invalide.");
  }

  const minElevation =
    Math.floor(Math.min(...trackpoints.map(point => point.elevation)) / 200) * 200;
  let maxElevation = Math.ceil(Math.max(...trackpoints.map(point => point.elevation)) / 200) * 200;
  if (maxElevation <= minElevation) maxElevation = minElevation + 200;
  const left = 52;
  const right = 884;
  const top = 26;
  const bottom = 213;
  const pointAt = targetKm => {
    const target = Math.max(0, Math.min(distanceKm, targetKm));
    let nextIndex = trackpoints.findIndex(point => point.distanceKm >= target);
    if (nextIndex < 1) nextIndex = 1;
    const previous = trackpoints[nextIndex - 1];
    const next = trackpoints[nextIndex];
    const segment = next.distanceKm - previous.distanceKm;
    const ratio = segment > 0 ? (target - previous.distanceKm) / segment : 0;
    const elevation = previous.elevation + ratio * (next.elevation - previous.elevation);
    return {
      km: target,
      elevation,
      x: left + (target / distanceKm) * (right - left),
      y: bottom - ((elevation - minElevation) / (maxElevation - minElevation)) * (bottom - top)
    };
  };

  const stride = Math.max(1, Math.ceil(trackpoints.length / 250));
  const samples = trackpoints
    .filter((point, index) => index % stride === 0 || index === trackpoints.length - 1)
    .map(point => pointAt(point.distanceKm))
    .map(point => [point.x, point.y]);
  const markers = [{ id: "start", ...pointAt(0) }];
  (race.checkpoints || []).forEach(checkpoint => {
    if (!Number.isFinite(checkpoint.km)) return;
    const routeKm = checkpoint.id === "finish" ? distanceKm : Math.min(checkpoint.km, distanceKm);
    markers.push({ id: checkpoint.id, ...pointAt(routeKm) });
  });
  if (!markers.some(marker => marker.id === "finish")) {
    markers.push({ id: "finish", ...pointAt(distanceKm) });
  }

  return { distanceKm, minElevation, maxElevation, samples, markers };
}

function renderCheckpoints(race) {
  const section = makeElement("section", "section");
  addText(section, "h2", "", race.checkpointTitle || "En course · ravitos");
  const selector = makeElement("div", "selector");
  selector.setAttribute("role", "group");
  selector.setAttribute("aria-label", "Scénario de temps");
  (race.scenarios || []).forEach((scenario, index) => {
    const isDefault = index === (race.defaultScenario ?? 0);
    const button = makeElement(
      "button",
      isDefault ? "active" : "",
      `${scenario.name}\n${scenario.duration}`
    );
    button.type = "button";
    button.dataset.scenario = scenario.id;
    button.setAttribute("aria-pressed", String(isDefault));
    selector.append(button);
  });
  if (selector.childElementCount) {
    section.append(selector);
    addText(
      section,
      "p",
      "sub scenario-help",
      "Temps écoulé · heure de passage estimée. Coche chaque ravito atteint."
    );
  }
  if (race.checkpointNote) addText(section, "p", "sub scenario-help", race.checkpointNote);

  const list = makeElement("div", "checkpoint-list");
  list.id = "checkpoints";
  race.checkpoints.forEach(checkpoint => {
    const card = makeElement("article", "checkpoint");
    card.dataset.id = checkpoint.id;
    const details = document.createElement("div");
    addText(details, "div", "place", checkpoint.name);
    const checkpointDetails = [
      Number.isFinite(checkpoint.km) ? `KM ${formatKilometers(checkpoint.km)}` : "",
      checkpoint.description || ""
    ]
      .filter(Boolean)
      .join(" · ");
    if (checkpointDetails) addText(details, "div", "km", checkpointDetails);
    const label = makeElement("label", "mark");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    label.append(checkbox, document.createTextNode(checkpoint.label || "Point atteint"));
    details.append(label);

    card.append(details);
    if (checkpoint.elapsed?.length || checkpoint.clocks?.length) {
      const timing = makeElement("div", "timing");
      if (checkpoint.elapsed?.length) {
        const elapsed = addText(timing, "div", "elapsed", formatDuration(checkpoint.elapsed[0]));
        elapsed.dataset.times = checkpoint.elapsed.join("|");
      }
      if (checkpoint.clocks?.length) {
        const clock = addText(timing, "div", "clock", checkpoint.clocks[0]);
        clock.dataset.clocks = checkpoint.clocks.join("|");
      }
      card.append(timing);
    }

    if (checkpoint.plan?.length) {
      const plan = makeElement("div", "checkpoint-plan");
      checkpoint.plan.forEach(item => {
        const paragraph = document.createElement("p");
        const strong = makeElement("strong", "", `${item.label} :`);
        paragraph.append(strong, document.createTextNode(` ${item.text}`));
        plan.append(paragraph);
      });
      card.append(plan);
    }
    list.append(card);
  });
  section.append(list);
  const reset = makeElement("button", "smallbtn", "Réinitialiser les points cochés");
  reset.id = "resetCheckpoints";
  reset.type = "button";
  section.append(reset);
  return section;
}

function renderPracticalInfo(info) {
  const section = makeElement("section", "section");
  addText(section, "h2", "", info.title || "Infos pratiques");
  const list = makeElement("div", "rules");
  info.items.forEach(item => {
    const rule = makeElement("div", "rule");
    addText(rule, "b", "", item.title);
    addText(rule, "p", "", item.text);
    list.append(rule);
  });
  section.append(list);
  return section;
}

function renderSources(sources, verifiedAt) {
  const section = makeElement("section", "section");
  addText(section, "h2", "", "Sources");
  const list = makeElement("ul", "race-sources");
  sources.forEach(source => {
    const item = document.createElement("li");
    const link = makeElement("a", "", source.label);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.append(link);
    list.append(item);
  });
  section.append(list);
  if (verifiedAt) {
    addText(section, "p", "sub", `Vérifié le ${dateFormatter.format(localDate(verifiedAt))}.`);
  }
  return section;
}

function setupCheckpoints(race) {
  const buttons = [...document.querySelectorAll("[data-scenario]")];
  const defaultIndex = race.defaultScenario ?? 0;
  function setScenario(index) {
    buttons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-times]").forEach(element => {
      const time = element.dataset.times.split("|")[index];
      if (time) element.textContent = formatDuration(time);
    });
    document.querySelectorAll("[data-clocks]").forEach(element => {
      const clock = element.dataset.clocks.split("|")[index];
      if (clock) element.textContent = clock;
    });
  }
  buttons.forEach((button, index) => button.addEventListener("click", () => setScenario(index)));
  if (buttons.length) setScenario(Math.min(defaultIndex, buttons.length - 1));

  const storageKey = `alterra-${race.id}-checkpoints`;
  const checks = [...document.querySelectorAll(".checkpoint input[type=checkbox]")];
  function update() {
    const done = checks
      .filter(input => input.checked)
      .map(input => input.closest(".checkpoint").dataset.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch (error) {
      console.warn("Impossible d’enregistrer les ravitos sur cet appareil.", error);
    }
    checks.forEach(input => input.closest(".checkpoint").classList.toggle("done", input.checked));
    if (window.updateElevationProgress) window.updateElevationProgress();
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    checks.forEach(input => {
      input.checked =
        Array.isArray(saved) && saved.includes(input.closest(".checkpoint").dataset.id);
      input.closest(".checkpoint").classList.toggle("done", input.checked);
    });
  } catch (error) {
    console.warn("Impossible de lire les ravitos enregistrés sur cet appareil.", error);
  }
  checks.forEach(input => input.addEventListener("change", update));
  document.getElementById("resetCheckpoints").addEventListener("click", () => {
    checks.forEach(input => {
      input.checked = false;
    });
    update();
  });
}

function renderNutrition(nutrition) {
  const section = makeElement("section", "section fuel-section");
  addText(section, "h2", "", nutrition.title);
  const overview = makeElement("div", "fuel-overview");
  addText(overview, "strong", "", nutrition.headline);
  (nutrition.details || []).forEach(detail => {
    const paragraph = document.createElement("p");
    if (typeof detail === "string") {
      paragraph.textContent = detail;
    } else {
      paragraph.append(
        makeElement("strong", "", `${detail.lead} :`),
        document.createTextNode(` ${detail.text}`)
      );
    }
    overview.append(paragraph);
  });
  section.append(overview);
  return section;
}

function renderReminders(reminders) {
  const section = makeElement("section", "section");
  addText(section, "h2", "", reminders.title);
  const list = makeElement("div", "rules");
  reminders.items.forEach(item => {
    const rule = makeElement("div", "rule");
    addText(rule, "b", "", item.title);
    addText(rule, "p", "", item.text);
    list.append(rule);
  });
  section.append(list);
  return section;
}

function renderGear(race, gear) {
  const section = makeElement("section", "gear-checklist");
  const details = document.createElement("details");
  details.id = "gearDetails";
  const summary = makeElement("summary", "gear-summary");
  const heading = makeElement("div", "gear-heading");
  addText(heading, "span", "gear-eyebrow", "AVANT LE DÉPART");
  addText(heading, "h2", "", gear.title);
  addText(heading, "p", "", gear.subtitle || race.name);
  const progress = makeElement("div", "gear-progress");
  const count = addText(progress, "span", "", "0/0");
  count.id = "gearCount";
  progress.append(makeElement("span", "gear-chevron", "⌄"));
  summary.append(heading, progress);
  details.append(summary);

  const body = makeElement("div", "gear-content");
  const track = makeElement("div", "gear-progress-track");
  const bar = makeElement("div");
  bar.id = "gearProgressBar";
  track.append(bar);
  body.append(track);
  addText(body, "p", "gear-hint", gear.hint || "Coche les éléments prévus.");

  gear.groups.forEach((group, groupIndex) => {
    const title = makeElement(
      "div",
      `gear-group-title${groupIndex > 0 ? " recommended-title" : ""}`,
      group.title
    );
    body.append(title);
    group.items.forEach(item => {
      const label = makeElement("label", "gear-item");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.gear = item.id;
      checkbox.dataset.required = String(group.required);
      label.append(checkbox, makeElement("span", "", item.text));
      body.append(label);
    });
  });
  const reset = makeElement("button", "gear-reset", "Réinitialiser la checklist");
  reset.type = "button";
  reset.id = "resetGear";
  body.append(reset);
  if (gear.note) addText(body, "p", "gear-note", gear.note);
  details.append(body);
  section.append(details);
  return section;
}

function setupGear(raceId, gear) {
  const boxes = [...document.querySelectorAll("[data-gear]")];
  const count = document.getElementById("gearCount");
  const bar = document.getElementById("gearProgressBar");
  const storageKey = gear.storageKey || `alterra-${raceId}-gear`;

  function saveState() {
    const state = {};
    boxes.forEach(box => {
      state[box.dataset.gear] = box.checked;
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Impossible d’enregistrer la checklist sur cet appareil.", error);
    }
    const required = boxes.filter(box => box.dataset.required === "true");
    const checked = required.filter(box => box.checked).length;
    count.textContent = `${checked}/${required.length}`;
    bar.style.width = `${required.length ? (checked / required.length) * 100 : 0}%`;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    boxes.forEach(box => {
      if (typeof saved[box.dataset.gear] === "boolean") box.checked = saved[box.dataset.gear];
    });
  } catch (error) {
    console.warn("Impossible de lire la checklist enregistrée sur cet appareil.", error);
  }
  boxes.forEach(box => box.addEventListener("change", saveState));
  document.getElementById("resetGear").addEventListener("click", () => {
    boxes.forEach(box => {
      box.checked = false;
    });
    saveState();
  });
  saveState();
}

function drawElevation(race, profile, chart, progress) {
  if (
    !Array.isArray(profile.samples) ||
    !Array.isArray(profile.markers) ||
    !profile.markers.length
  ) {
    showProfileError(progress, "Les données du profil sont invalides.");
    return;
  }
  const ns = chart.namespaceURI;
  const svg = (name, attributes, text) => {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  };
  const plotBottom = 213;
  const first = profile.samples[0];
  const last = profile.samples[profile.samples.length - 1];
  const area = svg("polygon", {
    class: "elevation-area",
    points: [
      `${first[0]},${plotBottom}`,
      ...profile.samples.map(point => point.join(",")),
      `${last[0]},${plotBottom}`
    ].join(" ")
  });
  const grid = svg("g", { class: "elevation-grid" });
  const line = svg("polyline", {
    class: "elevation-line",
    points: profile.samples.map(point => point.join(",")).join(" ")
  });
  const completed = svg("polyline", {
    class: "elevation-completed",
    id: "profileCompleted",
    points: ""
  });
  const axis = svg("path", { class: "elevation-axis", d: "M 52 26 V 213 H 884" });
  const markersLayer = svg("g", { class: "elevation-markers" });
  const current = svg("circle", {
    class: "elevation-current",
    id: "profileCurrent",
    cx: "0",
    cy: "0",
    r: "7",
    visibility: "hidden"
  });

  const elevationRange = profile.maxElevation - profile.minElevation;
  const rawStep = elevationRange / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const elevationStep =
    (normalizedStep <= 1
      ? 1
      : normalizedStep <= 2
        ? 2
        : normalizedStep <= 2.5
          ? 2.5
          : normalizedStep <= 5
            ? 5
            : 10) * magnitude;
  for (
    let elevation = profile.minElevation;
    elevation <= profile.maxElevation;
    elevation += elevationStep
  ) {
    const y = 26 + ((profile.maxElevation - elevation) / elevationRange) * 187;
    grid.append(
      svg("line", { x1: 52, y1: y, x2: 884, y2: y }),
      svg("text", { x: 44, y: y + 4, "text-anchor": "end" }, `${elevation} m`)
    );
  }
  for (let km = 0; km <= Math.floor(profile.distanceKm / 10) * 10; km += 10) {
    const x = 52 + (km / profile.distanceKm) * 832;
    grid.append(
      svg("line", { x1: x, y1: 213, x2: x, y2: 218 }),
      svg("text", { x, y: 231, "text-anchor": "middle" }, `${km}`)
    );
  }
  grid.append(
    svg(
      "text",
      { x: 884, y: 231, "text-anchor": "end" },
      `${profile.distanceKm.toFixed(1).replace(".", ",")} km`
    )
  );

  const checkpointById = new Map(
    (race.checkpoints || []).map(checkpoint => [checkpoint.id, checkpoint])
  );
  profile.markers.forEach(marker => {
    const checkpoint = checkpointById.get(marker.id);
    const name =
      marker.id === "start"
        ? "Départ"
        : marker.id === "finish"
          ? "Arrivée"
          : checkpoint?.name || marker.id;
    const interactive = marker.id !== "start" && checkpointById.has(marker.id);
    const stop = svg("g", {
      class: "elevation-stop",
      transform: `translate(${marker.x} ${marker.y})`
    });
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
    if (interactive) circle.setAttribute("aria-pressed", "false");
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
    stop.append(circle, label);
    if (interactive) {
      const toggle = () => {
        const checkbox = document.querySelector(
          `.checkpoint[data-id="${CSS.escape(marker.id)}"] input[type="checkbox"]`
        );
        if (!checkbox) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      };
      circle.addEventListener("click", toggle);
      circle.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
    }
    markersLayer.append(stop);
  });
  chart.append(area, grid, line, completed, axis, markersLayer, current);

  window.updateElevationProgress = () => {
    const progressMarkers = profile.markers.filter(
      marker => marker.id === "start" || checkpointById.has(marker.id)
    );
    const checkpointMarkers = progressMarkers.filter(marker => marker.id !== "start");
    let completedCount = 0;
    for (const marker of checkpointMarkers) {
      const checkbox = document.querySelector(
        `.checkpoint[data-id="${CSS.escape(marker.id)}"] input[type="checkbox"]`
      );
      if (!checkbox?.checked) break;
      completedCount += 1;
    }
    const activeMarker = progressMarkers[completedCount];
    if (!activeMarker) return;
    let points = profile.samples.filter(point => point[0] <= activeMarker.x);
    const next = profile.samples.find(point => point[0] > activeMarker.x);
    const previous = points[points.length - 1];
    if (next && previous && previous[0] !== activeMarker.x) {
      const ratio = (activeMarker.x - previous[0]) / (next[0] - previous[0]);
      points = [...points, [activeMarker.x, previous[1] + ratio * (next[1] - previous[1])]];
    }
    completed.setAttribute("points", points.map(point => point.join(",")).join(" "));
    current.setAttribute("cx", activeMarker.x);
    current.setAttribute("cy", activeMarker.y);
    current.setAttribute("visibility", activeMarker.km > 0 ? "visible" : "hidden");
    const name =
      activeMarker.id === "start"
        ? "Départ"
        : checkpointById.get(activeMarker.id)?.name || "Arrivée";
    const remaining = Math.max(0, profile.distanceKm - activeMarker.km);
    const currentKm = activeMarker.km
      .toFixed(2)
      .replace(/\.?0+$/, "")
      .replace(".", ",");
    progress.textContent = `${name} · KM ${currentKm} · ${remaining.toFixed(1).replace(".", ",")} km restants`;
    profile.markers.forEach(marker => {
      if (marker.id === "start") return;
      const checkbox = document.querySelector(
        `.checkpoint[data-id="${CSS.escape(marker.id)}"] input[type="checkbox"]`
      );
      const dot = chart.querySelector(`[data-profile-stop="${CSS.escape(marker.id)}"]`);
      if (!dot) return;
      dot.classList.toggle("is-done", Boolean(checkbox?.checked));
      dot.setAttribute("aria-pressed", String(Boolean(checkbox?.checked)));
    });
  };
  window.updateElevationProgress();
}

function renderRace(race, personalPlan = null, storageError = null) {
  if (
    !race.id ||
    !race.name ||
    !race.date ||
    !Number.isFinite(race.distanceKm) ||
    !Number.isFinite(race.ascentMeters)
  ) {
    throw new Error("Les données principales de la course sont incomplètes.");
  }
  const displayRace = applyPersonalPlan(race, personalPlan);
  document.title = `${displayRace.name} · Alterra`;
  content.replaceChildren(renderHero(displayRace));
  if (displayRace.profile?.gpx) content.append(renderElevationSection(displayRace));
  if (displayRace.checkpoints?.length) content.append(renderCheckpoints(displayRace));
  if (displayRace.nutrition) content.append(renderNutrition(displayRace.nutrition));
  if (displayRace.reminders?.items?.length) content.append(renderReminders(displayRace.reminders));
  if (displayRace.practicalInfo?.items?.length)
    content.append(renderPracticalInfo(displayRace.practicalInfo));
  if (displayRace.gear?.groups?.length) content.append(renderGear(displayRace, displayRace.gear));
  if (displayRace.sources?.length)
    content.append(renderSources(displayRace.sources, displayRace.verifiedAt));
  if (displayRace.footer) addText(content, "p", "footer", displayRace.footer);
  const personalPlanStatus = renderPersonalPlanControls(personalPlan, storageError);
  if (personalPlanStatus) content.append(personalPlanStatus);
  if (displayRace.checkpoints?.length) setupCheckpoints(displayRace);
  if (displayRace.gear?.groups?.length) setupGear(displayRace.id, displayRace.gear);
  if (displayRace.profile?.gpx) loadElevation(displayRace);
}

function applyPersonalPlan(race, plan) {
  if (!plan) return race;
  const scenarios = Array.isArray(plan.scenarios) ? plan.scenarios : [];
  const defaultScenario =
    Number.isInteger(plan.defaultScenario) &&
    plan.defaultScenario >= 0 &&
    plan.defaultScenario < scenarios.length
      ? plan.defaultScenario
      : 0;
  const privateCheckpoints = new Map(
    (Array.isArray(plan.checkpoints) ? plan.checkpoints : [])
      .filter(checkpoint => checkpoint && typeof checkpoint.id === "string")
      .map(checkpoint => [checkpoint.id, checkpoint])
  );
  const finishCheckpoint = privateCheckpoints.get("finish");
  return {
    ...race,
    targetTime:
      typeof plan.targetTime === "string" ? plan.targetTime : scenarios[defaultScenario]?.duration,
    targetFinish:
      typeof plan.targetFinish === "string"
        ? plan.targetFinish
        : finishCheckpoint?.clocks?.[defaultScenario],
    scenarios,
    defaultScenario,
    checkpoints: (race.checkpoints || []).map(checkpoint => ({
      ...checkpoint,
      ...(privateCheckpoints.get(checkpoint.id) || {})
    })),
    nutrition: plan.nutrition && typeof plan.nutrition === "object" ? plan.nutrition : null,
    reminders: plan.reminders && typeof plan.reminders === "object" ? plan.reminders : null
  };
}

function renderPersonalPlanControls(plan, storageError = null) {
  if (!plan && !storageError) return null;
  const section = makeElement("aside", "personal-plan-tools");
  section.setAttribute("aria-label", "État du plan personnel");
  const status = makeElement("p", "sub personal-plan-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  if (plan) {
    status.textContent = "Plan personnel enregistré sur cet appareil.";
    section.append(status);
    return section;
  }

  if (storageError) {
    status.textContent =
      "Le plan personnel ne peut pas être chargé depuis le stockage local de cet appareil.";
    section.append(status);
    return section;
  }
}

async function loadElevation(race) {
  const chart = content.querySelector(".elevation-chart");
  const progress = document.getElementById("elevationProgress");
  try {
    let gpxText = race.profile.gpxData;
    if (typeof gpxText !== "string") {
      const response = await fetch(new URL(race.profile.gpx, siteRoot));
      if (!response.ok) throw new Error(`GPX indisponible (${response.status}).`);
      gpxText = await response.text();
    }
    const profile = parseGpxProfile(gpxText, race);
    drawElevation(race, profile, chart, progress);
  } catch (error) {
    showProfileError(progress, "Impossible de charger ou de lire la trace GPX.");
    console.error(error);
  }
}

function showError(message, error) {
  console.error(message, error);
  content.replaceChildren();
  const section = makeElement("section", "section race-error");
  addText(section, "h1", "", "Fiche course indisponible");
  addText(section, "p", "", message);
  content.append(section);
}

async function loadRace() {
  if (!raceId) {
    showError("Aucune course n’a été sélectionnée.", new Error("Paramètre id manquant."));
    return;
  }
  try {
    const catalog = await loadRaceCatalog(personalData);
    const race = catalog.find(entry => entry.id === raceId);
    if (!race) {
      showError(
        "Cette course n’est pas dans la base de cet appareil. Importe une sauvegarde complète pour la restaurer.",
        new Error(`Course inconnue : ${raceId}.`)
      );
      return;
    }
    let personalPlan = null;
    let storageError = null;
    try {
      personalPlan = await personalData.repository.get("racePlans", race.id);
    } catch (error) {
      storageError = error;
      console.error("Impossible de lire le plan personnel sur cet appareil.", error);
    }
    renderRace(race, personalPlan, storageError);
  } catch (error) {
    showError("Vérifie ta connexion, puis réessaie depuis le calendrier.", error);
  }
}

loadRace();
