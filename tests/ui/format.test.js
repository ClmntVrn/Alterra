import { test } from "node:test";
import assert from "node:assert/strict";
import { capitalize, formatDateRange, formatDaysAgo, formatNumber } from "../../src/ui/format.js";

test("formatDateRange n’affiche l’année qu’une fois dans la même année", () => {
  assert.equal(formatDateRange("2026-10-26"), "26 octobre 2026");
  assert.equal(formatDateRange("2026-10-26", "2026-10-26"), "26 octobre 2026");
  assert.equal(formatDateRange("2026-10-26", "2026-10-28"), "26 octobre – 28 octobre 2026");
  assert.equal(formatDateRange("2026-12-30", "2027-01-02"), "30 décembre 2026 – 2 janvier 2027");
  assert.equal(formatDateRange("pas une date"), "");
});

test("formatNumber utilise le format français avec une décimale au plus", () => {
  // Intl utilise une espace insécable étroite comme séparateur des milliers.
  assert.equal(formatNumber(1234.56).replace(/\s/g, " "), "1 234,6");
  assert.equal(formatNumber(10), "10");
});

test("formatDaysAgo et capitalize", () => {
  assert.equal(formatDaysAgo(0), "aujourd’hui");
  assert.equal(formatDaysAgo(1), "hier");
  assert.equal(formatDaysAgo(3), "il y a 3 jours");
  assert.equal(capitalize("octobre 2026"), "Octobre 2026");
});
