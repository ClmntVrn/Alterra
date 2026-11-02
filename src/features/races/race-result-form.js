// Formulaire du résultat d’une course faite : les mêmes chiffres qu’une séance réalisée (distance,
// durée, D+, ressenti, FC, météo, notes), comptés dans les statistiques.

import {
  bindMeasureInputs,
  checkMeasures,
  fillMeasures,
  readMeasures
} from "../workouts/workout-measures.js";

/**
 * @param {Object} options
 * @param {HTMLFormElement} options.form
 * @param {(race: Object, result: Object | null) => Promise<void>} options.save Enregistre le
 *   résultat de la course, ou le retire avec `null`.
 * @param {() => Promise<void>} options.onSaved Appelé une fois le formulaire fermé.
 * @param {() => void} options.onCancel
 */
export function createRaceResultForm({ form, save, onSaved, onCancel }) {
  const fields = form.elements;
  const title = form.querySelector("h3");
  const status = form.querySelector('[role="status"]');
  const computed = form.querySelector(".training-computed");
  const removeButton = form.querySelector(".workout-delete-button");
  let race = null;
  let selectedEffort = "";

  function updateComputed() {
    const { parts } = checkMeasures(fields);
    computed.textContent = parts.join(" · ");
    computed.hidden = !parts.length;
  }

  function close() {
    form.reset();
    form.hidden = true;
    status.textContent = "";
    delete status.dataset.state;
    removeButton.hidden = true;
    computed.textContent = "";
    computed.hidden = true;
    race = null;
    selectedEffort = "";
  }

  /** @param {Object} nextRace Course faite, avec son éventuel `result`. */
  function open(nextRace) {
    close();
    race = nextRace;
    const result = race.result;
    title.textContent = `${result ? "Résultat" : "Valider"} · ${race.name}`;
    fields.namedItem("type").value = result?.type || "trail";
    selectedEffort = fillMeasures(fields, result || {});
    removeButton.hidden = !result;
    updateComputed();
    form.hidden = false;
    fields.namedItem("distanceKm").focus();
  }

  async function submit(result) {
    const buttons = form.querySelectorAll("button");
    buttons.forEach(button => (button.disabled = true));
    status.textContent = "Enregistrement…";
    try {
      await save(race, result);
      close();
      await onSaved();
    } catch (error) {
      console.error("Impossible d’enregistrer le résultat de la course.", error);
      status.textContent = "L’enregistrement a échoué. Vérifie le stockage de cet appareil.";
      status.dataset.state = "error";
    } finally {
      buttons.forEach(button => (button.disabled = false));
    }
  }

  form.querySelector(".training-form-cancel").addEventListener("click", () => {
    close();
    onCancel();
  });
  removeButton.addEventListener("click", () => {
    if (window.confirm(`Retirer le résultat de « ${race.name} » des statistiques ?`)) submit(null);
  });
  form.addEventListener("input", updateComputed);
  bindMeasureInputs(fields, {
    getEffort: () => selectedEffort,
    setEffort: value => (selectedEffort = value),
    onChange: updateComputed
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    updateComputed();
    if (form.hidden || !form.reportValidity()) return;
    const formData = new FormData(form);
    const result = { type: String(formData.get("type")) };
    submit(readMeasures(result, formData, { completed: true }));
  });

  return { open, close };
}
