// Repère d’une case du calendrier mois : icône du sport, ou « ×N » s’il y a plusieurs activités.

const SVG_NS = "http://www.w3.org/2000/svg";

// Formes remplies quand l’activité est faite ; les traits restent visibles dans tous les états.
const ICONS = {
  // Basket penchée, talon levé, avec des traits de vitesse : une chaussure qui court.
  shoe: [
    [
      "path",
      {
        d: "M5 17V9.5c1.4.8 2.9.8 4-.1L11.5 6l6 4.6 3.6 1.2a2 2 0 0 1 1.4 1.9V17z",
        transform: "rotate(15 14 12)"
      }
    ],
    ["path", { d: "M5 20h17.5", fill: "none", transform: "rotate(15 14 12)" }],
    ["path", { d: "M1 8h2.5M1 11.5h2", fill: "none" }]
  ],
  bike: [
    ["circle", { cx: "5.5", cy: "16", r: "3.5" }],
    ["circle", { cx: "18.5", cy: "16", r: "3.5" }],
    ["path", { d: "M5.5 16 9 9h6l3.5 7M9 9l3.5 7 2.5-7M7.5 6.5h3", fill: "none" }]
  ],
  dumbbell: [
    ["rect", { x: "4.5", y: "7", width: "4", height: "10", rx: "1" }],
    ["rect", { x: "15.5", y: "7", width: "4", height: "10", rx: "1" }],
    ["path", { d: "M8.5 12h7M2.5 10v4M21.5 10v4", fill: "none" }]
  ],
  flag: [
    ["path", { d: "M5.5 4h12l-2.5 4 2.5 4h-12z" }],
    ["path", { d: "M5.5 21V4", fill: "none" }]
  ],
  dot: [["circle", { cx: "12", cy: "12", r: "5" }]]
};

const WORKOUT_ICONS = { running: "shoe", trail: "shoe", cycling: "bike", strength: "dumbbell" };

/**
 * @param {Object} event Événement du calendrier (course ou séance).
 * @param {(event: Object) => string} getState État d’une séance : planned, completed ou toCheck.
 */
function renderEventIcon(event, getState) {
  const isRace = event.eventType === "race" || event.eventType === "personalRace";
  const name = isRace ? "flag" : WORKOUT_ICONS[event.type] || "dot";
  const state = isRace ? "race" : getState(event);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `calendar-event-icon is-${state}`);
  for (const [tag, attributes] of ICONS[name]) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [attribute, value] of Object.entries(attributes)) {
      shape.setAttribute(attribute, value);
    }
    svg.append(shape);
  }
  return svg;
}

/**
 * @param {Object[]} events Événements du jour, au moins un.
 * @param {(event: Object) => string} getState
 * @returns {Element}
 */
export function renderDayMarker(events, getState) {
  if (events.length === 1) return renderEventIcon(events[0], getState);
  const count = document.createElement("span");
  count.className = "calendar-event-count";
  count.setAttribute("aria-hidden", "true");
  count.textContent = `×${events.length}`;
  return count;
}
