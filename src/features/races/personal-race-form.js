// Formulaire d’ajout et de modification d’une course personnelle.

import { toDateKey } from "../../domain/dates.js";

function updateDateRangeValidity(form) {
  const startField = form.elements.namedItem("date");
  const endField = form.elements.namedItem("endDate");
  const startDate = startField.value;
  const endDate = endField.value;
  const rangeIsValid = !startDate || !endDate || endDate >= startDate;
  endField.min = startDate;
  startField.setCustomValidity(
    rangeIsValid ? "" : "La date de début doit précéder la date de fin."
  );
  endField.setCustomValidity(
    rangeIsValid ? "" : "La date de fin doit être égale ou postérieure à la date de début."
  );
}

/**
 * @param {Object} options
 * @param {HTMLFormElement} options.form
 * @param {(race: Object) => Promise<void>} options.save
 * @param {(id: string) => Promise<void>} options.remove
 * @param {() => Promise<void>} options.onSaved Appelé une fois le formulaire fermé, après un
 *   enregistrement ou une suppression.
 * @param {() => void} options.onCancel
 */
export function createPersonalRaceForm({ form, save, remove, onSaved, onCancel }) {
  const fields = form.elements;
  const title = form.querySelector("h3");
  const status = form.querySelector('[role="status"]');
  const cancelButton = form.querySelector(".training-form-cancel");
  const deleteButton = form.querySelector(".workout-delete-button");
  let editingRace = null;

  function close() {
    form.reset();
    form.hidden = true;
    status.textContent = "";
    delete status.dataset.state;
    editingRace = null;
    deleteButton.hidden = true;
  }

  /**
   * @param {Date} date Jour affiché, utilisé pour une nouvelle course.
   * @param {Object | null} [race] Course à modifier.
   */
  function open(date, race = null) {
    close();
    editingRace = race ? { ...race } : null;
    title.textContent = race ? `Modifier · ${race.name}` : "Nouvelle course";
    fields.namedItem("name").value = race?.name || "";
    fields.namedItem("date").value = race?.date || toDateKey(date);
    fields.namedItem("endDate").value = race?.endDate || race?.date || toDateKey(date);
    deleteButton.hidden = !race;
    form.hidden = false;
    updateDateRangeValidity(form);
    fields.namedItem("name").focus();
  }

  cancelButton.addEventListener("click", () => {
    close();
    onCancel();
  });
  deleteButton.addEventListener("click", async () => {
    const race = editingRace;
    if (!window.confirm(`Supprimer la course « ${race.name} » ? Cette action est définitive.`)) {
      return;
    }
    deleteButton.disabled = true;
    try {
      await remove(race.id);
      close();
      await onSaved();
    } catch (error) {
      console.error("Impossible de supprimer la course.", error);
      status.textContent = "La suppression a échoué. Réessaie.";
      status.dataset.state = "error";
    } finally {
      deleteButton.disabled = false;
    }
  });
  for (const name of ["date", "endDate"]) {
    fields.namedItem(name).addEventListener("input", () => updateDateRangeValidity(form));
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    updateDateRangeValidity(form);
    if (form.hidden || !form.reportValidity()) return;
    const formData = new FormData(form);
    const race = {
      ...(editingRace || {}),
      id: editingRace?.id || crypto.randomUUID(),
      name: String(formData.get("name")).trim(),
      date: String(formData.get("date")),
      createdAt: editingRace?.createdAt || new Date().toISOString()
    };
    delete race.eventType;
    const endDate = String(formData.get("endDate"));
    if (endDate > race.date) race.endDate = endDate;
    else delete race.endDate;
    const isEditing = Boolean(editingRace);
    const saveButton = form.querySelector('[type="submit"]');
    saveButton.disabled = true;
    status.textContent = "Enregistrement…";
    try {
      await save(race);
      close();
      await onSaved();
    } catch (error) {
      console.error(
        isEditing ? "Impossible de modifier la course." : "Impossible d’enregistrer la course.",
        error
      );
      status.textContent = isEditing
        ? "La modification a échoué. Vérifie le stockage de cet appareil."
        : "L’enregistrement a échoué. Vérifie le stockage de cet appareil.";
      status.dataset.state = "error";
    } finally {
      saveButton.disabled = false;
    }
  });

  return { open, close };
}
