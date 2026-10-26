// Formulaire de création et de modification d’une séance.

import { parseDateKey, parseTimeOfDay, toDateKey } from "../../domain/dates.js";
import { formatDuration, formatDurationClock, parseDuration } from "../../domain/durations.js";
import { parseDecimal } from "../../domain/numbers.js";
import { computeWorkoutEnd, formatPace } from "../../domain/workouts.js";
import { formatLongDate, formatWeekdayDate } from "../../ui/format.js";
import { DEFAULT_WORKOUT_TITLE, WORKOUT_TYPE_LABELS } from "./workout-labels.js";

const TEXT_FIELDS = [
  "title",
  "type",
  "time",
  "ascentMeters",
  "heartRateAvg",
  "heartRateMax",
  "weather",
  "notes"
];

/**
 * @param {Object} options
 * @param {HTMLFormElement} options.form
 * @param {HTMLButtonElement} options.openButton Masqué tant que le formulaire est ouvert.
 * @param {(workout: Object) => Promise<void>} options.save
 * @param {() => Promise<void>} options.onSaved Appelé une fois le formulaire fermé.
 */
export function createWorkoutForm({ form, openButton, save, onSaved }) {
  const fields = form.elements;
  const title = form.querySelector("h3");
  const status = form.querySelector('[role="status"]');
  const computed = form.querySelector(".training-computed");
  const completedFields = form.querySelector(".training-completed-fields");
  const cancelButton = form.querySelector('.training-form-actions [type="button"]');
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
    const durationField = fields.namedItem("duration");
    const durationMinutes = parseDuration(durationField.value);
    durationField.setCustomValidity(
      Number.isNaN(durationMinutes)
        ? "Saisis une durée comme 45 (minutes), 130 (1:30) ou 1020 (10:20)."
        : ""
    );

    const heartRateAvgField = fields.namedItem("heartRateAvg");
    const heartRateMaxField = fields.namedItem("heartRateMax");
    heartRateMaxField.setCustomValidity(
      heartRateAvgField.value &&
        heartRateMaxField.value &&
        Number(heartRateMaxField.value) < Number(heartRateAvgField.value)
        ? "La FC max doit être supérieure ou égale à la FC moyenne."
        : ""
    );

    const distanceField = fields.namedItem("distanceKm");
    const distanceValue = distanceField.value.trim();
    const distanceKm = parseDecimal(distanceValue);
    const isInRange =
      !distanceValue ||
      (Number.isFinite(distanceKm) &&
        distanceKm >= 0.1 &&
        distanceKm <= 1000 &&
        /^\d+(?:[,.]\d{1,2})?$/.test(distanceValue));
    distanceField.setCustomValidity(
      isInRange ? "" : "Saisis une distance entre 0,1 et 1 000 km, avec au maximum deux décimales."
    );

    const parts = [];
    if (durationMinutes) parts.push(formatDuration(durationMinutes));
    const pace = formatPace(distanceKm, durationMinutes);
    if (pace) parts.push(`Allure ${pace}`);
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
    openButton.hidden = false;
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
      for (const field of TEXT_FIELDS) fields.namedItem(field).value = workout[field] ?? "";
      if (Number.isFinite(workout.distanceKm)) {
        fields.namedItem("distanceKm").value = String(workout.distanceKm).replace(".", ",");
      }
      if (Number.isFinite(workout.durationMinutes) && workout.durationMinutes > 0) {
        fields.namedItem("duration").value = formatDurationClock(workout.durationMinutes);
      }
      if (Number.isFinite(workout.perceivedEffort)) {
        fields.namedItem("perceivedEffort").value = String(workout.perceivedEffort);
        selectedEffort = String(workout.perceivedEffort);
      }
      fields.namedItem("completed").checked = workout.status === "completed";
    }
    syncCompletedFields();
    updateComputed();
    form.hidden = false;
    openButton.hidden = true;
    form.querySelector('[name="type"]:checked').focus();
  }

  function readWorkout() {
    const formData = new FormData(form);
    const type = String(formData.get("type"));
    const time = parseTimeOfDay(formData.get("time"));
    const durationMinutes = parseDuration(formData.get("duration"));
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
    if (durationMinutes) workout.durationMinutes = durationMinutes;
    else delete workout.durationMinutes;
    const distanceValue = String(formData.get("distanceKm")).trim();
    if (distanceValue) workout.distanceKm = parseDecimal(distanceValue);
    else delete workout.distanceKm;
    const ascentValue = String(formData.get("ascentMeters")).trim();
    if (ascentValue) workout.ascentMeters = Number(ascentValue);
    else delete workout.ascentMeters;
    // Le ressenti, la FC et la météo ne concernent qu’une séance réalisée.
    for (const field of ["perceivedEffort", "heartRateAvg", "heartRateMax"]) {
      const value = workout.status === "completed" ? String(formData.get(field) ?? "").trim() : "";
      if (value) workout[field] = Number(value);
      else delete workout[field];
    }
    const weather = workout.status === "completed" ? String(formData.get("weather")) : "";
    if (weather) workout.weather = weather;
    else delete workout.weather;
    const notes = String(formData.get("notes")).trim();
    if (notes) workout.notes = notes;
    else delete workout.notes;
    return workout;
  }

  cancelButton.addEventListener("click", close);
  form.addEventListener("input", updateComputed);
  fields.namedItem("completed").addEventListener("change", syncCompletedFields);
  for (const fieldName of ["time", "duration"]) {
    const field = fields.namedItem(fieldName);
    field.addEventListener("blur", () => {
      if (fieldName === "time") {
        const time = parseTimeOfDay(field.value);
        if (time) field.value = time;
      } else {
        const durationMinutes = parseDuration(field.value);
        if (durationMinutes) field.value = formatDurationClock(durationMinutes);
      }
      updateComputed();
    });
  }
  // Toucher à nouveau la note choisie la retire.
  for (const radio of fields.namedItem("perceivedEffort")) {
    radio.addEventListener("click", () => {
      if (radio.value === selectedEffort) {
        radio.checked = false;
        selectedEffort = "";
      } else {
        selectedEffort = radio.value;
      }
    });
  }
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

  return {
    open,
    close,
    /** @param {string} id */
    isEditing: id => editingWorkout?.id === id
  };
}
