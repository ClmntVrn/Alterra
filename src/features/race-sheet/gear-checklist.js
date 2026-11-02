// Checklist du matériel, repliable, avec la progression des éléments obligatoires.

import { el } from "../../ui/dom.js";

function readGearState(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch (error) {
    console.warn("Impossible de lire la checklist enregistrée sur cet appareil.", error);
    return {};
  }
}

/**
 * @param {Object} race
 * @param {Object} gear Groupes d’éléments ; le premier groupe `required` compte dans la progression.
 */
export function createGearChecklist(race, gear) {
  const storageKey = gear.storageKey || `alterra-${race.id}-gear`;
  const count = el("span", { text: "0/0", attrs: { id: "gearCount" } });
  const bar = el("div", { attrs: { id: "gearProgressBar" } });
  const boxes = [];

  const body = el("div", { className: "gear-content" }, [
    el("div", { className: "gear-progress-track" }, [bar]),
    el("p", { className: "gear-hint", text: gear.hint || "Coche les éléments prévus." })
  ]);
  // Case maîtresse : décoche tout dès qu’un élément est coché, sinon coche tout.
  const all = el("input", { attrs: { type: "checkbox", id: "gearAll" } });
  const allLabel = el("span", { text: "Tout cocher" });
  body.append(el("label", { className: "gear-item gear-all" }, [all, allLabel]));
  gear.groups.forEach((group, groupIndex) => {
    body.append(
      el("div", {
        className: `gear-group-title${groupIndex > 0 ? " recommended-title" : ""}`,
        text: group.title
      })
    );
    for (const item of group.items) {
      const checkbox = el("input", { attrs: { type: "checkbox" } });
      checkbox.dataset.gear = item.id;
      checkbox.dataset.required = String(group.required);
      boxes.push(checkbox);
      body.append(
        el("label", { className: "gear-item" }, [checkbox, el("span", { text: item.text })])
      );
    }
  });
  if (gear.note) body.append(el("p", { className: "gear-note", text: gear.note }));

  const summary = el("summary", { className: "gear-summary" }, [
    el("div", { className: "gear-heading" }, [
      el("span", { className: "gear-eyebrow", text: "AVANT LE DÉPART" }),
      el("h2", { text: gear.title }),
      el("p", { text: gear.subtitle || race.name })
    ]),
    el("div", { className: "gear-progress" }, [
      count,
      el("span", { className: "gear-chevron", text: "⌄" })
    ])
  ]);
  const section = el("section", { className: "gear-checklist" }, [
    el("details", { attrs: { id: "gearDetails" } }, [summary, body])
  ]);

  function saveState() {
    const state = {};
    for (const box of boxes) state[box.dataset.gear] = box.checked;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Impossible d’enregistrer la checklist sur cet appareil.", error);
    }
    const required = boxes.filter(box => box.dataset.required === "true");
    const checked = required.filter(box => box.checked).length;
    count.textContent = `${checked}/${required.length}`;
    bar.style.width = `${required.length ? (checked / required.length) * 100 : 0}%`;
    const checkedCount = boxes.filter(box => box.checked).length;
    all.checked = checkedCount > 0 && checkedCount === boxes.length;
    all.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    allLabel.textContent = checkedCount ? "Tout décocher" : "Tout cocher";
  }

  const saved = readGearState(storageKey) || {};
  for (const box of boxes) {
    if (typeof saved[box.dataset.gear] === "boolean") box.checked = saved[box.dataset.gear];
    box.addEventListener("change", saveState);
  }
  all.addEventListener("change", () => {
    const check = !boxes.some(box => box.checked);
    for (const box of boxes) box.checked = check;
    saveState();
  });
  saveState();

  return section;
}
