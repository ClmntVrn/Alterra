// Mise en page mobile : couleur du titre du mois au toucher, champs des formulaires, cartes et
// détail plein écran sur petit écran.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { openHome, openToday, saveRecords, todayKey } from "./helpers.js";

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
/** Élément actif, joint aux messages d’échec pour le diagnostic. */
const activeElement = () =>
  page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
/** Le focus quitte le champ de mois, comme quand le sélecteur natif se referme. */
const leaveMonthInput = () => page.evaluate(() => document.getElementById("nextMonth").focus());

// Le sélecteur natif lui-même (roues de l’iPhone, fenêtre de Chrome) ne se pilote pas d’un test :
// on vérifie que le toucher atteint le champ, puis la couleur selon que le champ est actif ou non.
test("toucher le titre du mois atteint le champ de mois natif", async () => {
  await page.setViewport(375, 812, { touch: true });
  await openHome(page);
  assert.equal(await page.evaluate(() => matchMedia("(hover: none)").matches), true);
  const target = await page.evaluate(() => {
    const title = document.getElementById("calendarTitleText");
    title.scrollIntoView({ block: "center", behavior: "instant" });
    const box = title.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.id;
  });
  assert.equal(target, "calendarMonthInput");
});

test("sur écran tactile, le titre du mois n’est orange que pendant le choix", async () => {
  assert.equal(await titleColor(), CHARCOAL, `au repos, actif : ${await activeElement()}`);
  await page.evaluate(() => document.getElementById("calendarMonthInput").focus());
  assert.equal(await titleColor(), ACCENT, "pendant le choix");
  // « Terminé » sur iPhone : le mois est appliqué et le sélecteur se referme.
  await page.evaluate(() => {
    const input = document.getElementById("calendarMonthInput");
    input.value = "2027-01";
    input.dispatchEvent(new Event("change"));
  });
  // input.blur() ne libère pas toujours ce champ dans Chrome sous Linux : on déplace le focus.
  await leaveMonthInput();
  assert.equal(
    await page.evaluate(() => document.getElementById("calendarTitleText").textContent),
    "Janvier 2027"
  );
  assert.equal(await titleColor(), CHARCOAL, `après le choix, actif : ${await activeElement()}`);
});

test("le survol ne colore le titre du mois qu’avec une souris", async t => {
  // Sur iPhone, le survol reste actif après un toucher : il ne doit pas laisser le titre orange.
  await leaveMonthInput();
  assert.notEqual(await activeElement(), "calendarMonthInput");
  await page.forceHover("#calendarMonthPickerToggle");
  assert.equal(await titleColor(), CHARCOAL, "écran tactile");
  await page.setViewport(375, 812, { touch: false });
  // Les serveurs de la CI n’ont pas de souris : le navigateur n’y signale aucun survol possible.
  if (!(await page.evaluate(() => matchMedia("(hover: hover)").matches))) {
    await page.forceHover("#calendarMonthPickerToggle", false);
    t.diagnostic("Pas de souris sur cette machine : survol à la souris non vérifié.");
    return;
  }
  await page.forceHover("#calendarMonthPickerToggle");
  assert.equal(await titleColor(), ACCENT, "souris");
  await page.forceHover("#calendarMonthPickerToggle", false);
  assert.equal(await titleColor(), CHARCOAL, "souris sortie");
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

test("à 320 px, la case ronde ne chevauche pas le titre et le détail couvre l’écran", async () => {
  await page.setViewport(320, 640, { touch: true });
  await saveRecords(page, "workouts", [
    {
      id: "seance-mise-en-page",
      date: await todayKey(page),
      type: "trail",
      title: "Sortie longue avec un nom assez long pour passer à la ligne",
      status: "planned",
      distanceKm: 32.5,
      ascentMeters: 1850,
      durationMinutes: 285,
      createdAt: "2026-10-27T08:00:00.000Z"
    }
  ]);
  await openHome(page);
  await openToday(page);
  await page.waitFor(() => document.querySelector(".calendar-training-item"));
  const overlap = await page.evaluate(() => {
    const card = document.querySelector(".calendar-training-item");
    const title = card.querySelector(".calendar-item-open").getBoundingClientRect();
    const check = card.querySelector(".workout-check").getBoundingClientRect();
    const stats = card.querySelector(".workout-stats").getBoundingClientRect();
    return {
      titleRight: title.right,
      checkLeft: check.left,
      statsRight: stats.right,
      cardRight: card.getBoundingClientRect().right
    };
  });
  assert.ok(overlap.titleRight <= overlap.checkLeft, JSON.stringify(overlap));
  assert.ok(overlap.statsRight <= overlap.cardRight, JSON.stringify(overlap));

  await page.evaluate(() =>
    document.querySelector(".calendar-training-item .calendar-item-open").click()
  );
  const sheet = await page.evaluate(() => {
    const box = document.getElementById("calendarSheet").getBoundingClientRect();
    return [box.left, box.top, box.width, box.height, document.documentElement.scrollWidth];
  });
  assert.deepEqual(sheet, [0, 0, 320, 640, 320]);
});

test("aucune erreur JavaScript", () => {
  assert.deepEqual(page.errors, []);
});
