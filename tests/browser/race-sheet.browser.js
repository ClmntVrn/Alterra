// Fiche course : accès depuis le calendrier, blocs, scénarios, ravitos, profil et matériel.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { createRacePlan, createRaceSheet } from "./fixtures.js";
import { openHome, openToday, saveRecords, todayKey } from "./helpers.js";

let browser;
let page;

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
  await openHome(page);
  await saveRecords(page, "raceCatalog", [createRaceSheet(await todayKey(page))]);
  await saveRecords(page, "racePlans", [createRacePlan()]);
  await page.evaluate(() => {
    localStorage.setItem("alterra-fiche-test-checkpoints", JSON.stringify(["r1"]));
    localStorage.setItem("alterra-fiche-test-gear", JSON.stringify({ g1: true }));
  });
});

after(() => browser?.close());

const texts = selector =>
  page.evaluate(
    selector =>
      [...document.querySelectorAll(selector)].map(element =>
        element.textContent.normalize("NFKC")
      ),
    selector
  );
const text = async selector => (await texts(selector))[0] ?? null;
/** Repère atteint sur le profil. */
const reached = () =>
  page.evaluate(() => document.querySelector(".elevation-chart").dataset.reached ?? null);
const isChecked = id =>
  page.evaluate(id => document.querySelector(`.checkpoint[data-id="${id}"] input`).checked, id);

test("le calendrier mène à la fiche de la course du jour", async () => {
  await openHome(page);
  await openToday(page);
  const link = await page.waitFor(() => document.querySelector(".calendar-event-link")?.href);
  assert.equal(new URL(link).pathname + new URL(link).search, "/race.html?id=fiche-test");
  await page.goto(link);
  await page.waitFor(() => document.querySelector(".elevation-chart .elevation-line"), {
    message: "Le profil d’altitude ne s’est pas affiché."
  });
});

test("l’en-tête et tous les blocs de la fiche s’affichent", async () => {
  assert.equal(await page.evaluate(() => document.title), "Ultra de test · Alterra");
  assert.deepEqual(await texts(".hero .stat strong, .hero .pill"), [
    "40 km",
    "2 000 m",
    "7:00",
    "Arrivée cible 13:00",
    "Barrière max. 12:00"
  ]);
  assert.deepEqual(await texts("#raceContent h2"), [
    "Refuge B",
    "Profil de la course",
    "Ravitos",
    "Nutrition",
    "Rappels",
    "Matériel",
    "Infos pratiques",
    "Sources"
  ]);
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("#raceContent details")].map(d => d.open)
    ),
    [false, false, false],
    "matériel, infos pratiques et sources sont repliés"
  );
  assert.equal(await text(".footer"), "Pied de fiche.");
  assert.equal(await text(".personal-plan-status"), "Plan personnel enregistré sur cet appareil.");
  assert.deepEqual(
    await page.evaluate(() => {
      const link = document.querySelector(".race-sources a");
      return [link.href, link.rel];
    }),
    ["https://example.org/", "noopener noreferrer"]
  );
});

test("le profil place les repères des ravitos et reprend la progression enregistrée", async () => {
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("[data-profile-stop]")].map(
        dot => `${dot.dataset.profileStop}:${dot.getAttribute("role")}`
      )
    ),
    ["start:img", "r1:button", "r2:button", "finish:button"]
  );
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll(".checkpoint.done")].map(card => card.dataset.id)
    ),
    ["r1"]
  );
  assert.equal(await reached(), "r1");
  assert.deepEqual(
    await page.evaluate(() => {
      const chart = document.querySelector(".elevation-chart");
      const viewBox = chart.viewBox.baseVal;
      return [
        Math.round(viewBox.width) === Math.round(chart.getBoundingClientRect().width),
        Boolean(document.querySelector(".elevation-completed-area").getAttribute("points")),
        document.querySelector(".elevation-position").getAttribute("visibility")
      ];
    }),
    [true, true, "visible"],
    "tracé à la taille de l’écran, partie parcourue remplie, position marquée"
  );
  assert.deepEqual(await texts(".elevation-section p:not([hidden])"), [], "aucun texte d’aide");
});

test("un scénario change les temps et horaires de passage", async () => {
  assert.deepEqual(
    [
      await text(".selector .active"),
      await text(".checkpoint .elapsed"),
      await text(".checkpoint .clock")
    ],
    ["Objectif\n7:00", "2h10", "08:10"]
  );
  await page.evaluate(() => document.querySelector("[data-scenario='s1']").click());
  assert.deepEqual(
    [
      await text(".selector .active"),
      await text(".checkpoint .elapsed"),
      await text(".checkpoint .clock")
    ],
    ["Prudent\n8:00", "2h30", "08:30"]
  );
});

/** Contenu visible du bloc « En course ». */
const live = () =>
  page.evaluate(() => {
    const section = document.querySelector(".live-section");
    const visible = selector => {
      const element = section.querySelector(selector);
      return element.hidden ? null : element.textContent;
    };
    return {
      label: visible(".live-label"),
      next: visible(".live-next"),
      stats: [...section.querySelectorAll(".live-stats dt")].map(
        term => `${term.textContent} ${term.nextElementSibling.textContent}`
      ),
      remaining: visible(".live-remaining"),
      reach: visible(".live-reach"),
      undo: visible(".live-undo")
    };
  });

test("le bloc En course montre le prochain ravito et le coche d’un toucher", async () => {
  const before = await live();
  assert.deepEqual(
    before.stats.map(stat => stat.split(" ")[0]),
    ["Distance", "D+", "D−", "Passage"]
  );
  assert.deepEqual(
    { ...before, stats: [before.stats[0], before.stats[3]] },
    {
      label: "PROCHAIN RAVITO",
      next: "Refuge B",
      stats: ["Distance 13 km", "Passage 11:00"],
      remaining: "Arrivée dans 28 km",
      reach: "Ravito atteint",
      undo: "Annuler"
    },
    "scénario Prudent choisi au test précédent"
  );

  await page.evaluate(() => document.querySelector(".live-reach").click());
  assert.equal(await isChecked("r2"), true);
  assert.equal(await reached(), "r2", "le profil suit");
  const atRefuge = await live();
  assert.deepEqual(
    [atRefuge.label, atRefuge.next, atRefuge.stats[0], atRefuge.remaining, atRefuge.reach],
    ["VERS L’ARRIVÉE", "Arrivée", "Distance 15 km", null, "Arrivée atteinte"]
  );

  await page.evaluate(() => document.querySelector(".live-undo").click());
  assert.equal(await isChecked("r2"), false);
  assert.equal((await live()).next, "Refuge B");
});

test("toucher un repère coche le ravito et fait avancer la progression", async () => {
  await page.evaluate(() =>
    document.querySelector('[data-profile-stop="r2"]').dispatchEvent(new MouseEvent("click"))
  );
  assert.equal(await isChecked("r2"), true);
  assert.deepEqual(
    await page.evaluate(() => {
      const dot = document.querySelector('[data-profile-stop="r2"]');
      return [
        dot.classList.contains("is-done"),
        dot.getAttribute("aria-pressed"),
        JSON.parse(localStorage.getItem("alterra-fiche-test-checkpoints"))
      ];
    }),
    [true, "true", ["r1", "r2"]]
  );
  assert.equal(await reached(), "r2");

  await page.evaluate(() =>
    document
      .querySelector('[data-profile-stop="finish"]')
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
  );
  assert.equal(await reached(), "finish", "le clavier coche aussi un repère");
  const finished = await live();
  assert.deepEqual(
    [finished.label, finished.next, finished.stats, finished.reach, finished.undo],
    ["COURSE TERMINÉE", "Arrivée", [], null, "Annuler"]
  );
});

test("toucher la carte d’un ravito le coche ; le prochain est mis en avant", async () => {
  const cards = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".checkpoint")].map(
        card =>
          `${card.dataset.id}:${card.classList.contains("done") ? "fait" : ""}${card.classList.contains("is-next") ? "suivant" : ""}`
      )
    );
  await page.evaluate(() => document.getElementById("resetCheckpoints").click());
  assert.deepEqual(await cards(), ["r1:suivant", "r2:", "finish:"]);
  await page.evaluate(() => document.querySelector('.checkpoint[data-id="r1"] .place').click());
  assert.equal(await isChecked("r1"), true);
  assert.deepEqual(await cards(), ["r1:fait", "r2:suivant", "finish:"]);
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.checkpoint[data-id="r1"] .checkpoint-plan'))
          .display
    ),
    "none",
    "ravito passé réduit"
  );
});

test("la progression s’arrête au premier ravito non coché, puis se réinitialise", async () => {
  await page.evaluate(() => document.querySelector('.checkpoint[data-id="r1"] input').click());
  assert.equal(await reached(), "start");
  assert.equal(
    await page.evaluate(() =>
      document.querySelector(".elevation-current").getAttribute("visibility")
    ),
    "hidden"
  );
  await page.evaluate(() => document.getElementById("resetCheckpoints").click());
  assert.deepEqual(
    await page.evaluate(() => [
      document.querySelectorAll(".checkpoint.done").length,
      document.querySelectorAll(".elevation-stop-dot.is-done").length,
      localStorage.getItem("alterra-fiche-test-checkpoints")
    ]),
    [0, 0, "[]"]
  );
});

test("la checklist du matériel compte les éléments obligatoires", async () => {
  const state = () =>
    page.evaluate(() => [
      document.getElementById("gearCount").textContent,
      document.getElementById("gearProgressBar").style.width
    ]);
  assert.deepEqual(await state(), ["1/2", "50%"]);
  await page.evaluate(() => {
    document.querySelector('[data-gear="g2"]').click();
    document.querySelector('[data-gear="g3"]').click();
  });
  assert.deepEqual(await state(), ["2/2", "100%"]);
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("alterra-fiche-test-gear"))),
    { g1: true, g2: true, g3: true }
  );
  await page.evaluate(() => document.getElementById("resetGear").click());
  assert.deepEqual(await state(), ["0/2", "0%"]);
});

test("une fiche inconnue affiche un message clair", async () => {
  await page.goto("/race.html?id=inconnue");
  await page.waitFor(() => document.querySelector(".race-error"));
  assert.equal(await text(".race-error h1"), "Fiche course indisponible");
});

test("aucune erreur JavaScript, hors fiche inconnue attendue", () => {
  assert.deepEqual(
    page.errors.filter(error => !/Course inconnue/.test(error)),
    []
  );
});
