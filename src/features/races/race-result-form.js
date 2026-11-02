// Formulaire du résultat d’une course faite : chiffres relevés par la montre, comptés dans les stats.

import { formatDurationClock, parseDuration } from "../../domain/durations.js";
import { parseDecimal } from "../../domain/numbers.js";
import { formatNumber } from "../../ui/format.js";

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
  const removeButton = form.querySelector(".workout-delete-button");
  let race = null;

  function close() {
    form.reset();
    form.hidden = true;
    status.textContent = "";
    delete status.dataset.state;
    removeButton.hidden = true;
    race = null;
  }

  /** @param {Object} nextRace Course faite, avec son éventuel `result`. */
  function open(nextRace) {
    close();
    race = nextRace;
    const result = race.result;
    title.textContent = `${result ? "Résultat" : "Valider"} · ${race.name}`;
    fields.namedItem("type").value = result?.type || "trail";
    fields.namedItem("distanceKm").value = result ? formatNumber(result.distanceKm) : "";
    fields.namedItem("duration").value = result ? formatDurationClock(result.durationMinutes) : "";
    fields.namedItem("ascentMeters").value = result?.ascentMeters ?? "";
    removeButton.hidden = !result;
    form.hidden = false;
    fields.namedItem("distanceKm").focus();
  }

  function readResult() {
    const distanceField = fields.namedItem("distanceKm");
    const distanceKm = parseDecimal(distanceField.value);
    distanceField.setCustomValidity(
      Number.isFinite(distanceKm) && distanceKm >= 0.1 && distanceKm <= 1000
        ? ""
        : "Saisis une distance entre 0,1 et 1 000 km, par exemple 42,2."
    );
    const durationField = fields.namedItem("duration");
    const durationMinutes = parseDuration(durationField.value);
    durationField.setCustomValidity(
      Number.isFinite(durationMinutes)
        ? ""
        : "Saisis une durée comme 45 (minutes), 530 (5:30) ou 1020 (10:20)."
    );
    const ascent = fields.namedItem("ascentMeters").value;
    const result = {
      type: fields.namedItem("type").value,
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes
    };
    if (ascent !== "") result.ascentMeters = Number(ascent);
    return result;
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
  for (const name of ["distanceKm", "duration"]) {
    fields.namedItem(name).addEventListener("input", readResult);
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const result = readResult();
    if (form.hidden || !form.reportValidity()) return;
    submit(result);
  });

  return { open, close };
}
