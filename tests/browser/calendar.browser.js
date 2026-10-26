// Calendrier de l’accueil : saisie d’une séance, statistiques, cartes, courses personnelles et navigation.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { openHome, openToday, readDatabase } from "./helpers.js";

let browser;
let page;

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
  await openHome(page);
  await page.evaluate(() => {
    window.confirm = () => true;
  });
});

after(() => browser?.close());

/** Saisit une valeur dans le formulaire de séance, puis quitte le champ. */
function fill(name, value) {
  return page.evaluate(
    (name, value) => {
      const field = document.getElementById("trainingForm").elements.namedItem(name);
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("blur"));
      return field.value;
    },
    name,
    value
  );
}

const computed = () => page.evaluate(() => document.getElementById("trainingComputed").textContent);
const text = selector =>
  page.evaluate(selector => document.querySelector(selector)?.textContent ?? null, selector);
const lastPointDistance = () =>
  page.evaluate(
    () =>
      [...document.querySelectorAll(".activity-chart-point")]
        .at(-1)
        .getAttribute("aria-label")
        .split(", ")[1]
  );

test("une installation neuve crée la base en version 3", async () => {
  const database = await readDatabase(page);
  assert.equal(database.version, 3);
  assert.deepEqual(database.stores.sort(), [
    "activities",
    "equipment",
    "nutritionProducts",
    "personalRaces",
    "raceCatalog",
    "racePlans",
    "settings",
    "workouts"
  ]);
});

test("la saisie rapide de l’heure et de la durée est convertie", async () => {
  await openToday(page);
  await page.evaluate(() => document.getElementById("addTrainingButton").click());
  assert.equal(await fill("time", "930"), "09:30");
  assert.equal(await fill("duration", "1020"), "10:20");
  assert.equal(await computed(), "10 h 20 · Fin 19:50");
});

test("l’allure et une fin le lendemain sont calculées ; une durée impossible est refusée", async () => {
  await fill("time", "07:00");
  await fill("distanceKm", "21,1");
  await fill("duration", "130");
  assert.equal(await computed(), "1 h 30 · Allure 4:16 min/km · Fin 08:30");
  await fill("time", "22h");
  await fill("duration", "3000");
  assert.match(await computed(), /^30 h · Allure 85:18 min\/km · Fin le .+ à 04:00$/);
  await fill("duration", "1075");
  const valid = await page.evaluate(
    () => document.getElementById("trainingForm").elements.namedItem("duration").validity.valid
  );
  assert.equal(valid, false);
});

test("une séance réalisée est comptée une seule fois dans les statistiques", async () => {
  await fill("time", "07:00");
  await fill("duration", "60");
  await fill("distanceKm", "10");
  await fill("ascentMeters", "200");
  await page.evaluate(() => {
    const form = document.getElementById("trainingForm");
    form.elements.namedItem("completed").click();
    form.requestSubmit();
  });
  await page.waitFor(() => document.querySelector(".calendar-training-item"));
  await page.waitFor(() => document.getElementById("activityDistance").textContent === "10 km");
  assert.equal(await lastPointDistance(), "10 km");
  for (let click = 0; click < 3; click += 1) {
    await page.evaluate(() =>
      [...document.querySelectorAll(".activity-chart-point")]
        .at(-1)
        .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
  }
  assert.equal(await lastPointDistance(), "10 km", "pas de double comptage après sélection");
  assert.equal(
    await text(".calendar-training-item .calendar-training-targets"),
    "10 km · 1 h · 200 m D+ · 6:00 min/km"
  );
});

test("une séance s’ouvre, se remet à faire puis se supprime", async () => {
  const detailsButton = ".calendar-training-item .calendar-session-details";
  await page.evaluate(selector => document.querySelector(selector).click(), detailsButton);
  assert.deepEqual(
    await page.evaluate(
      selector => [
        document.getElementById("trainingFormTitle").textContent,
        document.querySelector(selector).getAttribute("aria-expanded"),
        document.getElementById("addTrainingButton").hidden
      ],
      detailsButton
    ),
    ["Modifier · Trail", "true", true]
  );
  await page.evaluate(selector => document.querySelector(selector).click(), detailsButton);
  assert.equal(await page.evaluate(() => document.getElementById("trainingForm").hidden), true);

  await page.evaluate(() =>
    document.querySelector(".calendar-training-item .calendar-session-toggle input").click()
  );
  await page.waitFor(
    () => document.querySelector(".calendar-training-item")?.dataset.state === "planned"
  );
  await page.waitFor(() => document.getElementById("activityDistance").textContent === "0 km");

  await page.evaluate(() =>
    document.querySelector(".calendar-training-item .calendar-delete-button").click()
  );
  await page.waitFor(() => !document.querySelector(".calendar-training-item"));
  assert.equal(await text("#calendarEventDetails h3"), "Aucun événement prévu");
});

test("une course personnelle s’ajoute sur deux jours, se modifie et se supprime", async () => {
  await page.evaluate(() => document.getElementById("addRaceButton").click());
  assert.deepEqual(
    await page.evaluate(() => [
      document.getElementById("raceEventFormTitle").textContent,
      document.activeElement.name
    ]),
    ["Nouvelle course", "name"]
  );
  await page.evaluate(() => {
    const form = document.getElementById("raceEventForm");
    form.elements.namedItem("name").value = "Trail des Crêtes";
    const end = new Date();
    end.setDate(end.getDate() + 1);
    const pad = value => String(value).padStart(2, "0");
    form.elements.namedItem("endDate").value =
      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    form.requestSubmit();
  });
  const raceTitle = "#calendarEventDetails .calendar-race-item h3";
  await page.waitFor(selector => document.querySelector(selector), {}, raceTitle);
  assert.equal(await text(raceTitle), "Trail des Crêtes");

  await page.evaluate(() => document.getElementById("nextDay").click());
  assert.equal(await text(raceTitle), "Trail des Crêtes", "présente le deuxième jour");

  await page.evaluate(() =>
    document
      .querySelector("#calendarEventDetails .calendar-race-item .calendar-session-details")
      .click()
  );
  assert.equal(await text("#raceEventFormTitle"), "Modifier · Trail des Crêtes");
  await page.evaluate(() => {
    const form = document.getElementById("raceEventForm");
    form.elements.namedItem("name").value = "Trail renommé";
    form.requestSubmit();
  });
  await page.waitFor(
    selector => document.querySelector(selector)?.textContent === "Trail renommé",
    {},
    raceTitle
  );
  const [saved] = (await readDatabase(page)).data.personalRaces;
  assert.equal("eventType" in saved, false, "aucun champ d’affichage enregistré");

  await page.evaluate(() =>
    document
      .querySelector("#calendarEventDetails .calendar-race-item .calendar-delete-button")
      .click()
  );
  await page.waitFor(() => !document.querySelector("#calendarEventDetails .calendar-race-item"));
  await page.evaluate(() => document.getElementById("previousDay").click());
});

test("la navigation passe de la vue jour à la vue mois", async () => {
  await page.evaluate(() => document.getElementById("backToMonth").click());
  assert.deepEqual(
    await page.evaluate(() => [
      document.querySelector(".calendar-grid").hidden,
      document.getElementById("calendarEventDetails").hidden,
      document.getElementById("previousDay").hidden,
      document.getElementById("calendarMonthPickerToggle").hidden
    ]),
    [false, true, true, false]
  );
  const currentMonth = await text("#calendarTitleText");
  await page.evaluate(() => document.getElementById("nextMonth").click());
  assert.notEqual(await text("#calendarTitleText"), currentMonth);
  assert.equal(await page.evaluate(() => document.querySelectorAll(".is-today").length), 0);
  await page.evaluate(() => document.getElementById("previousMonth").click());
  assert.equal(await text("#calendarTitleText"), currentMonth);
});

test("le sélecteur de mois natif change de mois et ignore un champ vidé", async () => {
  const setMonth = value =>
    page.evaluate(value => {
      const input = document.getElementById("calendarMonthInput");
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  assert.equal(
    await page.evaluate(() => document.getElementById("calendarMonthInput").type),
    "month"
  );
  await setMonth("2027-03");
  assert.equal(await text("#calendarTitleText"), "Mars 2027");
  assert.equal(
    await page.evaluate(() => document.querySelectorAll(".calendar-day:not(.is-empty)").length),
    31
  );
  await setMonth("");
  assert.equal(await text("#calendarTitleText"), "Mars 2027");
  await page.evaluate(() => document.getElementById("nextMonth").click());
  assert.equal(
    await page.evaluate(() => document.getElementById("calendarMonthInput").value),
    "2027-04"
  );
});

test("aucune erreur JavaScript", () => {
  assert.deepEqual(page.errors, []);
});
