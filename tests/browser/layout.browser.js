// Mise en page mobile : couleur du titre du mois au toucher, champs des formulaires sur petit écran.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { openHome, openToday } from "./helpers.js";

let browser;
let page;

const CHARCOAL = "rgb(32, 38, 43)";
const ACCENT = "rgb(185, 79, 31)";

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
});

after(() => browser?.close());

const titleColor = () =>
  page.evaluate(() => getComputedStyle(document.getElementById("calendarTitleText")).color);

test("au toucher, le titre du mois est orange pendant le choix seulement", async () => {
  await page.setViewport(375, 812, { touch: true });
  await openHome(page);
  assert.equal(await page.evaluate(() => matchMedia("(hover: none)").matches), true);
  assert.equal(await titleColor(), CHARCOAL);
  await page.tap("#calendarTitleText");
  await page.waitFor(() => document.activeElement?.id === "calendarMonthInput");
  assert.equal(await titleColor(), ACCENT);
  // « Terminé » sur iPhone : le mois est appliqué et le sélecteur se referme.
  await page.evaluate(() => {
    const input = document.getElementById("calendarMonthInput");
    input.value = "2027-01";
    input.dispatchEvent(new Event("change"));
    input.blur();
  });
  assert.equal(
    await page.evaluate(() => document.getElementById("calendarTitleText").textContent),
    "Janvier 2027"
  );
  assert.equal(await titleColor(), CHARCOAL);
});

for (const width of [320, 375]) {
  test(`à ${width} px, chaque champ des formulaires reste dans sa colonne`, async () => {
    await page.setViewport(width);
    await openHome(page);
    await openToday(page);
    const fieldsFit = formId =>
      page.evaluate(formId => {
        const labels = [...document.getElementById(formId).querySelectorAll("label")].filter(
          label => label.querySelector("input:not([type=radio]):not([type=checkbox])")
        );
        return labels
          .filter(label => {
            const column = label.getBoundingClientRect();
            const field = label.querySelector("input").getBoundingClientRect();
            return field.left < column.left - 0.5 || field.right > column.right + 0.5;
          })
          .map(label => label.textContent.trim());
      }, formId);
    await page.evaluate(() => document.getElementById("addTrainingButton").click());
    assert.deepEqual(await fieldsFit("trainingForm"), [], "formulaire de séance");
    const dateHeight = await page.evaluate(
      () => document.querySelector("#trainingForm input[type=date]").getBoundingClientRect().height
    );
    assert.ok(dateHeight >= 44, "champ de date assez haut pour le toucher");
    await page.evaluate(() => document.getElementById("addRaceButton").click());
    assert.deepEqual(await fieldsFit("raceEventForm"), [], "formulaire de course");
  });
}

test("aucune erreur JavaScript", () => {
  assert.deepEqual(page.errors, []);
});
