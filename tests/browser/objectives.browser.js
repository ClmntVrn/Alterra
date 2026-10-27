// Onglet Objectifs : courses à venir avec compte à rebours, courses passées, ajout et modification.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { createRaceSheet } from "./fixtures.js";
import { openHome, saveRecords } from "./helpers.js";

let browser;
let page;

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
  await page.setViewport(375, 812, { touch: true });
  await openHome(page);
});

after(() => browser?.close());

/** Clé AAAA-MM-JJ décalée de `offset` jours depuis aujourd’hui, dans le fuseau du navigateur. */
const dayKey = offset =>
  page.evaluate(offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const pad = value => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }, offset);

const openObjectives = async () => {
  await page.evaluate(() => document.querySelector('.tab[href="#objectifs"]').click());
  await page.waitFor(() => !document.getElementById("viewObjectives").hidden);
};

/**
 * Cartes affichées : titre, compte à rebours rendu, chiffres (« libellé : valeur », sauf la date de
 * la prochaine course, relative au jour du test) ou ligne de détail, pastille de date.
 */
const cards = (selector = "#objectivesList > .objective-card") =>
  page.evaluate(
    selector =>
      [...document.querySelectorAll(selector)].map(card => {
        const stats = [...card.querySelectorAll(".workout-stats > div")].map(item => {
          const label = item.querySelector("dt").textContent;
          return label === "Date" ? label : `${label} : ${item.querySelector("dd").textContent}`;
        });
        const description = card.querySelector(".calendar-event-description")?.textContent;
        return {
          name: card.querySelector(".calendar-item-open").textContent,
          countdown: card.querySelector(".objective-countdown [aria-hidden]")?.textContent ?? null,
          details: stats.length
            ? stats.map(text => text.replace(/\s/g, " "))
            : (description ?? null),
          dateTile: Boolean(card.querySelector("time.objective-date")),
          next: card.classList.contains("is-next")
        };
      }),
    selector
  );

const submitRaceForm = name =>
  page.evaluate(name => {
    const form = document.getElementById("raceEventForm");
    form.elements.namedItem("name").value = name;
    form.requestSubmit();
  }, name);

test("sans course, l’onglet Objectifs l’indique et propose d’en ajouter une", async () => {
  await openObjectives();
  assert.deepEqual(
    await page.evaluate(() => [
      document.querySelector("#objectivesList .calendar-empty")?.textContent,
      document.querySelector("#objectivesList .objectives-past"),
      document.querySelector(".view-header #addObjectiveRace").getAttribute("aria-label")
    ]),
    ["Aucune course à venir.", null, "Ajouter une course"]
  );
});

test("la prochaine course est mise en avant, puis les autres ; les passées sont repliées", async () => {
  await saveRecords(page, "raceCatalog", [createRaceSheet(await dayKey(10))]);
  await saveRecords(page, "personalRaces", [
    { id: "p-futur", name: "Course de printemps", date: await dayKey(30) },
    { id: "p-passe", name: "Course passée", date: await dayKey(-5) }
  ]);
  await openHome(page);
  await openObjectives();
  assert.deepEqual(await cards(), [
    {
      name: "Ultra de test",
      countdown: "J-10",
      details: ["Date", "Distance : 40 km", "D+ : 2 000 m"],
      dateTile: false,
      next: true
    },
    { name: "Course de printemps", countdown: "J-30", details: null, dateTile: true, next: false }
  ]);
  assert.deepEqual(
    await page.evaluate(() => {
      const next = document.querySelector(".objective-card.is-next");
      return [
        next.querySelector("a.calendar-item-open").getAttribute("href"),
        next.querySelector(".objective-countdown").textContent,
        document.querySelector(".objectives-past").open,
        document.querySelector(".objectives-past summary").textContent.replace("⌄", "")
      ];
    }),
    ["./race.html?id=fiche-test", "J-10, dans 10 jours", false, "Courses passées (1)"]
  );
  // Une course passée rappelle sa date complète, avec l’année.
  const [pastCard] = await cards(".objectives-past > .objective-card");
  assert.deepEqual(
    { ...pastCard, details: /\d{4}$/.test(pastCard.details) },
    { name: "Course passée", countdown: null, details: true, dateTile: true, next: false }
  );
});

test("une course personnelle s’ouvre en plein écran depuis les Objectifs et s’y modifie", async () => {
  await page.evaluate(() =>
    [...document.querySelectorAll(".objective-card button.calendar-item-open")]
      .find(button => button.textContent === "Course de printemps")
      .click()
  );
  assert.deepEqual(
    await page.evaluate(() => [
      document.getElementById("calendarSheet").open,
      document.getElementById("raceEventFormTitle").textContent
    ]),
    [true, "Modifier · Course de printemps"]
  );
  await submitRaceForm("Course d’été");
  await page.waitFor(() => !document.getElementById("calendarSheet").open);
  await page.waitFor(() => document.querySelector("#objectivesList").textContent.includes("d’été"));
  assert.equal(await page.evaluate(() => document.getElementById("viewObjectives").hidden), false);
  assert.deepEqual(
    (await cards()).map(card => card.name),
    ["Ultra de test", "Course d’été"]
  );
});

test("« Ajouter une course » crée une course à la date du jour, mise en avant", async () => {
  await page.evaluate(() => document.getElementById("addObjectiveRace").click());
  assert.deepEqual(
    await page.evaluate(() => {
      const form = document.getElementById("raceEventForm");
      return [form.hidden, document.getElementById("raceEventFormTitle").textContent];
    }),
    [false, "Nouvelle course"]
  );
  assert.equal(
    await page.evaluate(
      () => document.getElementById("raceEventForm").elements.namedItem("date").value
    ),
    await dayKey(0)
  );
  await submitRaceForm("Course du jour");
  await page.waitFor(() =>
    document.querySelector("#objectivesList").textContent.includes("du jour")
  );
  assert.deepEqual((await cards())[0], {
    name: "Course du jour",
    countdown: "Jour J",
    details: ["Date"],
    dateTile: false,
    next: true
  });
});

test("le logo de l’en-tête ramène à l’accueil sans entrée d’historique", async () => {
  const historyLength = await page.evaluate(() => history.length);
  await page.evaluate(() => document.querySelector("#viewObjectives .view-home").click());
  assert.deepEqual(
    await page.evaluate(() => [
      document.getElementById("viewHome").hidden,
      location.hash,
      history.length
    ]),
    [false, "#accueil", historyLength]
  );
  await openObjectives();
});

/** Attend une condition pendant un changement de page, quand l’ancienne page peut disparaître. */
async function waitAcrossNavigation(fn) {
  const deadline = Date.now() + 10000;
  for (;;) {
    if (await page.evaluate(fn).catch(() => false)) return;
    if (Date.now() > deadline) throw new Error("La navigation n’a pas abouti.");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

test("« Retour » de la fiche ramène à l’onglet Objectifs", async () => {
  await page.evaluate(() =>
    document.querySelector('.objective-card a[href="./race.html?id=fiche-test"]').click()
  );
  await waitAcrossNavigation(() => document.querySelector(".hero h1")?.textContent);
  await page.evaluate(() => document.getElementById("raceBack").click());
  await waitAcrossNavigation(
    () =>
      location.pathname.endsWith("/index.html") &&
      document.getElementById("viewObjectives")?.hidden === false &&
      document.querySelector("#objectivesList .objective-card")
  );
  assert.equal(await page.evaluate(() => location.hash), "#objectifs");
});

test("le repli des courses passées reste ouvert après une mise à jour", async () => {
  await page.evaluate(() => {
    document.querySelector(".objectives-past").open = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await page.evaluate(() => document.querySelector(".objectives-past").open), true);
});

test("à 320 px, les cartes tiennent dans la largeur", async () => {
  await page.setViewport(320, 700, { touch: true });
  assert.deepEqual(
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll("#objectivesList > .objective-card")];
      return {
        inside: cards.every(card => card.getBoundingClientRect().right <= window.innerWidth),
        countdownsVisible: cards.every(
          card =>
            card.querySelector(".objective-countdown").getBoundingClientRect().right <=
            card.getBoundingClientRect().right
        ),
        scrollWidth: document.documentElement.scrollWidth
      };
    }),
    { inside: true, countdownsVisible: true, scrollWidth: 320 }
  );
});

test("aucune erreur JavaScript", () => {
  assert.deepEqual(page.errors, []);
});
