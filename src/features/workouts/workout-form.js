// Formulaire de création et de modification d’une séance.

import { parseDateKey, parseTimeOfDay, toDateKey } from "../../domain/dates.js";
import { computeWorkoutEnd } from "../../domain/workouts.js";
import { formatLongDate, formatWeekdayDate } from "../../ui/format.js";
import { DEFAULT_WORKOUT_TITLE, WORKOUT_TYPE_LABELS } from "./workout-labels.js";
import {
  bindMeasureInputs,
  checkMeasures,
  fillMeasures,
  readDuration,
  readMeasures
} from "./workout-measures.js";

/**
 * @param {Object} options
 * @param {HTMLFormElement} options.form
 * @param {(workout: Object) => Promise<void>} options.save
 * @param {() => Promise<void>} options.onSaved Appelé une fois le formulaire fermé.
 * @param {() => void} options.onCancel
 */
export function createWorkoutForm({ form, save, onSaved, onCancel }) {
  const fields = form.elements;
  const title = form.querySelector("h3");
  const status = form.querySelector('[role="status"]');
  const computed = form.querySelector(".training-computed");
  const completedFields = form.querySelector(".training-completed-fields");
  const cancelButton = form.querySelector(".training-form-cancel");
  let editingWorkout = null;
  let selectedEffort = "";

  function syncCompletedFields() {
    completedFields.hidden = !fields.namedItem("completed").checked;
  }

  function updateComputed() {
    const timeField = fields.namedItem("time");
    const time = parseTimeOfDay(timeField.value);
    timeField.setCustomValidity(
      time === null ? "Saisis une heure entre 00:00 et 23:59, par exemple 930 pour 09:30." : ""
    );
    const { durationMinutes, parts } = checkMeasures(fields);
    const date = fields.namedItem("date").value;
    if (durationMinutes && time !== null) {
      const { endDate, endTime } = computeWorkoutEnd(date, time, durationMinutes);
      const endDay = parseDateKey(endDate);
      if (endDate === date && endTime) parts.push(`Fin ${endTime}`);
      else if (endDate !== date && endDay) {
        parts.push(`Fin le ${formatWeekdayDate(endDay)}${endTime ? ` à ${endTime}` : ""}`);
      }
    }
    computed.textContent = parts.join(" · ");
    computed.hidden = !parts.length;
  }

  function close() {
    form.reset();
    form.hidden = true;
    status.textContent = "";
    delete status.dataset.state;
    editingWorkout = null;
    selectedEffort = "";
    computed.textContent = "";
    computed.hidden = true;
    completedFields.hidden = true;
  }

  /**
   * @param {Date} date Jour affiché, utilisé pour une nouvelle séance.
   * @param {Object | null} [workout] Séance à modifier.
   */
  function open(date, workout = null) {
    close();
    editingWorkout = workout ? { ...workout } : null;
    title.textContent = workout
      ? `Modifier · ${workout.title}`
      : `Entraînement du ${formatLongDate(date)}`;
    fields.namedItem("date").value = workout?.date || toDateKey(date);
    if (workout) {
      for (const field of ["title", "type", "time"]) {
        fields.namedItem(field).value = workout[field] ?? "";
      }
      selectedEffort = fillMeasures(fields, workout);
      fields.namedItem("completed").checked = workout.status === "completed";
    }
    syncCompletedFields();
    updateComputed();
    form.hidden = false;
    form.querySelector('[name="type"]:checked').focus();
  }

  function readWorkout() {
    const formData = new FormData(form);
    const type = String(formData.get("type"));
    const time = parseTimeOfDay(formData.get("time"));
    const durationMinutes = readDuration(formData);
    const workout = {
      ...(editingWorkout || {}),
      id: editingWorkout?.id || crypto.randomUUID(),
      date: String(formData.get("date")),
      type,
      title:
        String(formData.get("title")).trim() || WORKOUT_TYPE_LABELS[type] || DEFAULT_WORKOUT_TITLE,
      status: formData.get("completed") === "on" ? "completed" : "planned",
      createdAt: editingWorkout?.createdAt || new Date().toISOString()
    };
    const { endDate } = computeWorkoutEnd(workout.date, time, durationMinutes);
    if (endDate > workout.date) workout.endDate = endDate;
    else delete workout.endDate;
    delete workout.eventType;
    if (workout.status === "completed") {
      workout.completedAt = editingWorkout?.completedAt || new Date().toISOString();
    } else {
      delete workout.completedAt;
    }
    if (time) workout.time = time;
    else delete workout.time;
    // Le ressenti, la FC et la météo ne concernent qu’une séance réalisée.
    return readMeasures(workout, formData, { completed: workout.status === "completed" });
  }

  cancelButton.addEventListener("click", () => {
    close();
    onCancel();
  });
  form.addEventListener("input", updateComputed);
  fields.namedItem("completed").addEventListener("change", syncCompletedFields);
  const timeField = fields.namedItem("time");
  timeField.addEventListener("blur", () => {
    const time = parseTimeOfDay(timeField.value);
    if (time) timeField.value = time;
    updateComputed();
  });
  bindMeasureInputs(fields, {
    getEffort: () => selectedEffort,
    setEffort: value => (selectedEffort = value),
    onChange: updateComputed
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    updateComputed();
    if (form.hidden || !form.reportValidity()) return;
    const workout = readWorkout();
    const isEditing = Boolean(editingWorkout);
    const saveButton = form.querySelector('[type="submit"]');
    saveButton.disabled = true;
    status.textContent = "Enregistrement…";
    delete status.dataset.state;
    try {
      await save(workout);
      close();
      await onSaved();
    } catch (error) {
      console.error(
        isEditing
          ? "Impossible de modifier l’entraînement."
          : "Impossible d’enregistrer l’entraînement.",
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
