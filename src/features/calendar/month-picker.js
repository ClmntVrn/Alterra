// Choix du mois avec le sélecteur natif du système (roues sur iPhone).

import { parseMonthKey, toMonthKey } from "../../domain/dates.js";

/**
 * @param {Object} options
 * @param {HTMLInputElement} options.input Champ `type="month"` posé sur le titre du mois.
 * @param {(month: Date) => void} options.onSelect Reçoit le premier jour du mois choisi.
 */
export function createMonthPicker({ input, onSelect }) {
  let currentKey = input.value;

  // Sans sélecteur de mois natif (Safari et Firefox sur ordinateur), les flèches suffisent.
  if (input.type !== "month") {
    input.hidden = true;
    return { setMonth() {} };
  }

  function openPicker() {
    try {
      input.showPicker?.();
    } catch {
      // Le navigateur ouvre alors son sélecteur au toucher, sans aide.
    }
  }

  input.addEventListener("click", openPicker);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      openPicker();
    }
  });
  input.addEventListener("change", () => {
    const month = parseMonthKey(input.value);
    // « Effacer » vide le champ : on garde le mois affiché.
    if (!month) {
      input.value = currentKey;
      return;
    }
    currentKey = input.value;
    onSelect(month);
  });

  return {
    /** @param {Date} month */
    setMonth(month) {
      currentKey = toMonthKey(month);
      input.value = currentKey;
    }
  };
}
