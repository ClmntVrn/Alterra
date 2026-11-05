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
  assert.deepEqual(
    await texts(".elevation-section p:not([hidden]):not(.elevation-legend)"),
    [],
    "aucun texte d’aide"
  );
});

test("le profil colore la pente, liste les sections et donne le passage au doigt", async () => {
  const state = await page.evaluate(() => ({
    bands: [
      ...new Set(
        [...document.querySelectorAll(".elevation-section .elevation-slope-line")].map(line =>
          [...line.classList].find(name => name.startsWith("slope-"))
        )
      )
    ].sort(),
    sections: [...document.querySelectorAll(".checkpoint")].map(
      card => `${card.dataset.id}:${Boolean(card.querySelector(".checkpoint-section"))}`
    ),
    sectionText: document.querySelector('.checkpoint[data-id="r1"] .checkpoint-section')
      ?.textContent,
    listUnderProfile: Boolean(document.querySelector(".elevation-section ol")),
    legend: document.querySelector(".elevation-legend").textContent
  }));
  assert.ok(state.bands.length >= 2, `plusieurs classes de pente : ${state.bands}`);
  assert.deepEqual(
    state.sections,
    ["r1:true", "r2:true", "finish:true"],
    "section sur chaque ravito"
  );
  assert.match(state.sectionText, /^Section 12 km · \+\d+ m · −\d+ m$/);
  assert.equal(state.listUnderProfile, false, "pas de liste des sections sous le profil");
  assert.match(state.legend, /^< 5 %5–10 %≥ 10 %$/);

  const readout = await page.evaluate(() => {
    const chart = document.querySelector(".elevation-section .elevation-chart");
    const rect = chart.getBoundingClientRect();
    const plotLeft = 42;
    const plotRight = rect.width - 14;
    // Au milieu de la zone de tracé : environ 20 km sur une trace d’environ 39 km.
    const clientX = rect.left + (plotLeft + plotRight) / 2;
    chart.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 7,
        clientX,
        clientY: rect.top + 80,
        bubbles: true
      })
    );
    chart.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 7,
        clientX,
        clientY: rect.top + 80,
        bubbles: true
      })
    );
    const box = document.querySelector(".elevation-section .elevation-readout");
    return [box.hidden, [...box.children].map(line => line.textContent)];
  });
  assert.equal(readout[0], false);
  assert.match(readout[1][0], /^Km (19|20)(,\d)? · \d+ m · [+−-]?\d+ %$/);
  assert.match(readout[1][1], /^Passage \d{2}:\d{2} · \dh\d{2}$/, "heure estimée du scénario");
});

test("le profil s’ouvre en plein écran, zoome et revient à la course entière", async () => {
  await page.evaluate(() => document.querySelector(".elevation-expand").click());
  const full = () =>
    page.evaluate(() => {
      const dialog = document.querySelector(".elevation-full");
      const chart = dialog.querySelector(".elevation-chart");
      return {
        open: dialog.open,
        view: chart.dataset.view,
        reset: !dialog.querySelector(".elevation-reset").hidden,
        stops: chart.querySelectorAll("[data-profile-stop]").length,
        figures: chart.querySelectorAll(".elevation-section-figures").length,
        fills: Math.round(chart.getBoundingClientRect().height) >= window.innerHeight * 0.5,
        // Téléphone tenu droit (viewport des tests) : le plein écran est tourné.
        rotated: getComputedStyle(dialog).transform !== "none"
      };
    });
  assert.deepEqual(await full(), {
    open: true,
    view: "",
    reset: false,
    stops: 4,
    figures: 3,
    fills: true,
    rotated: true
  });

  await page.evaluate(() => {
    const chart = document.querySelector(".elevation-full .elevation-chart");
    const rect = chart.getBoundingClientRect();
    chart.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -600,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        cancelable: true
      })
    );
  });
  await page.waitFor(() => document.querySelector(".elevation-full .elevation-chart").dataset.view);
  const zoomed = await full();
  assert.equal(zoomed.reset, true, "bouton Course entière");
  const [from, to] = zoomed.view.split("-").map(Number);
  assert.ok(from > 0 && to < 40 && to - from < 15, `partie zoomée : ${zoomed.view}`);

  await page.evaluate(() => document.querySelector(".elevation-reset").click());
  assert.deepEqual([(await full()).view, (await full()).reset], ["", false]);

  await page.evaluate(() =>
    document
      .querySelector('.elevation-full [data-profile-stop="r1"]')
      .dispatchEvent(new MouseEvent("click"))
  );
  const wasChecked = await isChecked("r1");
  await page.evaluate(() => document.querySelector(".elevation-close").click());
  assert.equal(await page.evaluate(() => document.querySelector(".elevation-full").open), false);
  await page.evaluate(() => document.querySelector('.checkpoint[data-id="r1"] input').click());
  assert.equal(await isChecked("r1"), !wasChecked, "le plein écran coche les mêmes ravitos");
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
  const all = () =>
    page.evaluate(() => {
      const box = document.getElementById("gearAll");
      return [box.checked, box.indeterminate, box.nextElementSibling.textContent];
    });
  assert.deepEqual(await all(), [true, false, "Tout décocher"]);
  await page.evaluate(() => document.querySelector('[data-gear="g3"]').click());
  assert.deepEqual(await all(), [false, true, "Tout décocher"], "état intermédiaire");
  await page.evaluate(() => document.getElementById("gearAll").click());
  assert.deepEqual(await state(), ["0/2", "0%"]);
  assert.deepEqual(await all(), [false, false, "Tout cocher"]);
  await page.evaluate(() => document.getElementById("gearAll").click());
  assert.deepEqual(await state(), ["2/2", "100%"]);
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
