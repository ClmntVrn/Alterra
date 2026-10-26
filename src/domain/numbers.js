/**
 * Nombre décimal saisi avec une virgule ou un point.
 * @returns {number} NaN si vide ou invalide.
 */
export function parseDecimal(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .replace(",", ".");
  return normalizedValue ? Number(normalizedValue) : NaN;
}

/** @returns {number} La valeur si elle est un nombre fini positif, sinon 0. */
export function positiveOrZero(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
