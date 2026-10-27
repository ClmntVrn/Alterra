// Ravitos d’une fiche : scénarios de temps, horaires de passage et points atteints.

import { el } from "../../ui/dom.js";
import { formatNumber } from "../../ui/format.js";
import { leadParagraph } from "./info-sections.js";

const formatTimeLabel = duration => duration.replace(":", "h");

function readCheckedIds(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch (error) {
    console.warn("Impossible de lire les ravitos enregistrés sur cet appareil.", error);
    return new Set();
  }
}

function renderScenarioSelector(scenarios, defaultIndex) {
  return el(
    "div",
    { className: "selector", attrs: { role: "group", "aria-label": "Scénario de temps" } },
    scenarios.map((scenario, index) => {
      const isDefault = index === defaultIndex;
      const button = el("button", {
        className: isDefault ? "active" : "",
        text: `${scenario.name}\n${scenario.duration}`,
        attrs: { type: "button", "aria-pressed": String(isDefault) }
      });
      button.dataset.scenario = scenario.id;
      return button;
    })
  );
}

function renderCheckpointCard(checkpoint) {
  const checkbox = el("input", { attrs: { type: "checkbox" } });
  const summary = [
    Number.isFinite(checkpoint.km) ? `KM ${formatNumber(checkpoint.km)}` : "",
    checkpoint.description || ""
  ]
    .filter(Boolean)
    .join(" · ");
  const details = el("div", {}, [el("div", { className: "place", text: checkpoint.name })]);
  if (summary) details.append(el("div", { className: "km", text: summary }));
  details.append(
    el("label", { className: "mark" }, [checkbox, checkpoint.label || "Point atteint"])
  );

  const card = el("article", { className: "checkpoint" }, [details]);
  card.dataset.id = checkpoint.id;
  if (checkpoint.elapsed?.length || checkpoint.clocks?.length) {
    const timing = el("div", { className: "timing" });
    if (checkpoint.elapsed?.length) {
      const elapsed = el("div", {
        className: "elapsed",
        text: formatTimeLabel(checkpoint.elapsed[0])
      });
      elapsed.dataset.times = checkpoint.elapsed.join("|");
      timing.append(elapsed);
    }
    if (checkpoint.clocks?.length) {
      const clock = el("div", { className: "clock", text: checkpoint.clocks[0] });
      clock.dataset.clocks = checkpoint.clocks.join("|");
      timing.append(clock);
    }
    card.append(timing);
  }
  if (checkpoint.plan?.length) {
    card.append(
      el(
        "div",
        { className: "checkpoint-plan" },
        checkpoint.plan.map(item => leadParagraph(item.label, item.text))
      )
    );
  }
  return { card, checkbox };
}

/**
 * @param {Object} race Fiche avec plan personnel appliqué.
 * @param {Object} options
 * @param {() => void} options.onChange Appelé quand un ravito est coché ou décoché, ou quand le
 *   scénario change.
 */
export function createCheckpointsSection(race, { onChange }) {
  const scenarios = race.scenarios || [];
  const defaultIndex = race.defaultScenario ?? 0;
  const storageKey = `alterra-${race.id}-checkpoints`;
  let scenarioIndex = 0;
  const section = el("section", { className: "section" }, [
    el("h2", { text: race.checkpointTitle || "En course · ravitos" })
  ]);

  const selector = renderScenarioSelector(scenarios, defaultIndex);
  if (scenarios.length) {
    section.append(
      selector,
      el("p", {
        className: "sub scenario-help",
        text: "Temps écoulé · heure de passage estimée. Coche chaque ravito atteint."
      })
    );
  }
  if (race.checkpointNote) {
    section.append(el("p", { className: "sub scenario-help", text: race.checkpointNote }));
  }

  const checkboxes = [];
  const list = el("div", { className: "checkpoint-list", attrs: { id: "checkpoints" } });
  for (const checkpoint of race.checkpoints) {
    const { card, checkbox } = renderCheckpointCard(checkpoint);
    checkboxes.push([checkpoint.id, checkbox]);
    list.append(card);
  }
  const reset = el("button", {
    className: "smallbtn",
    text: "Réinitialiser les points cochés",
    attrs: { id: "resetCheckpoints", type: "button" }
  });
  section.append(list, reset);

  function setScenario(index, notify = true) {
    scenarioIndex = index;
    [...selector.children].forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    for (const element of list.querySelectorAll("[data-times]")) {
      const time = element.dataset.times.split("|")[index];
      if (time) element.textContent = formatTimeLabel(time);
    }
    for (const element of list.querySelectorAll("[data-clocks]")) {
      const clock = element.dataset.clocks.split("|")[index];
      if (clock) element.textContent = clock;
    }
    if (notify) onChange();
  }

  function syncCards() {
    for (const [, checkbox] of checkboxes) {
      checkbox.closest(".checkpoint").classList.toggle("done", checkbox.checked);
    }
  }

  function saveAndNotify() {
    const done = [...checkboxes].filter(([, checkbox]) => checkbox.checked).map(([id]) => id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch (error) {
      console.warn("Impossible d’enregistrer les ravitos sur cet appareil.", error);
    }
    syncCards();
    onChange();
  }

  [...selector.children].forEach((button, index) =>
    button.addEventListener("click", () => setScenario(index))
  );
  if (scenarios.length) setScenario(Math.min(defaultIndex, scenarios.length - 1), false);

  const savedIds = readCheckedIds(storageKey);
  for (const [id, checkbox] of checkboxes) {
    checkbox.checked = savedIds.has(id);
    checkbox.addEventListener("change", saveAndNotify);
  }
  syncCards();
  reset.addEventListener("click", () => {
    for (const [, checkbox] of checkboxes) checkbox.checked = false;
    saveAndNotify();
  });

  const find = id => checkboxes.find(([checkpointId]) => checkpointId === id)?.[1];

  return {
    element: section,
    /** @param {string} id */
    isChecked: id => Boolean(find(id)?.checked),
    getScenarioIndex: () => scenarioIndex,
    /** Coche ou décoche un ravito comme le ferait un toucher sur sa case. */
    toggle(id) {
      const checkbox = find(id);
      if (!checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
}
