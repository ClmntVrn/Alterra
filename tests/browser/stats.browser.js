// Onglet Stats : période choisie, comparaison, filtres, répartition par sport et records.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
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

const tap = selector =>
  page.evaluate(selector => document.querySelector(selector).click(), selector);

/** Totaux affichés : « libellé : valeur (évolution) ». */
const kpis = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("#statsKpis .stats-kpi")].map(item => {
      const [label, value, change] = [...item.children].map(child => child.textContent);
      return `${label} : ${value} (${change})`;
    })
  );

const workout = (id, date, values) => ({
  id,
  date,
  type: "trail",
  title: "Sortie",
  status: "completed",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...values
});

test("l’onglet Stats s’ouvre sur le mois en cours, sans sortie", async () => {
  await tap('.tab[href="#stats"]');
  await page.waitFor(() => !document.getElementById("viewStats").hidden);
  assert.deepEqual(
    await page.evaluate(() => {
      const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
        new Date()
      );
      return [
        document.getElementById("statsPeriodTitle").textContent ===
          month[0].toUpperCase() + month.slice(1),
        document.querySelectorAll("#statsChart .stats-bar").length,
        document.querySelector('#statsChart .stats-bar[aria-pressed="true"]') ===
          document.querySelector("#statsChart .stats-bar:last-child"),
        document.getElementById("statsSports").textContent,
        document.getElementById("statsRecords").textContent
      ];
    }),
    [
      true,
      12,
      true,
      "Aucune sortie réalisée sur cette période.",
      "Les records apparaîtront avec tes sorties."
    ]
  );
});

test("la semaine se compare à la précédente, à la même date", async () => {
  await saveRecords(page, "workouts", [
    workout("w-jour", await dayKey(0), {
      distanceKm: 20,
      ascentMeters: 600,
      durationMinutes: 120
    }),
    workout("w-velo", await dayKey(0), { type: "cycling", distanceKm: 50, durationMinutes: 120 }),
    workout("w-avant", await dayKey(-7), { distanceKm: 10, durationMinutes: 60 }),
    workout("w-ancien", await dayKey(-400), {
      title: "Marathon",
      type: "running",
      distanceKm: 42.2,
      durationMinutes: 210
    }),
    workout("w-prevu", await dayKey(0), { status: "planned", distanceKm: 99 })
  ]);
  await openHome(page);
  await tap('.tab[href="#stats"]');
  await tap('#statsPeriodKinds [data-kind="week"]');
  assert.match(
    await page.evaluate(() => document.getElementById("statsCompareLabel").textContent),
    /^Par rapport à la semaine du /
  );
  assert.deepEqual(await kpis(), [
    "Distance : 20 km (▲ 100 %)",
    "Temps : 2 h (▲ 100 %)",
    "D+ : 600 m (—)",
    "Km-effort : 26 km (▲ 160 %)",
    "Sorties : 1 (= 0 %)"
  ]);
});

test("le filtre Tout ajoute le vélo et la répartition couvre tous les sports", async () => {
  await tap('#statsCategories [data-category="all"]');
  assert.equal((await kpis())[0], "Distance : 70 km (▲ 600 %)");
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("#statsSports .stats-sport")].map(item =>
        [...item.querySelectorAll("strong, .stats-sport-heading span, p")]
          .map(part => part.textContent)
          .join(" | ")
      )
    ),
    ["Vélo | 2 h · 50 % | 1 sortie · 50 km", "Trail | 2 h · 50 % | 1 sortie · 20 km · 600 m D+"]
  );
});

test("les records portent sur toutes les sorties du filtre", async () => {
  await tap('#statsCategories [data-category="combined"]');
  const records = await page.evaluate(() =>
    [...document.querySelectorAll("#statsRecords .stats-record")].map(item =>
      [...item.children].map(child => child.textContent)
    )
  );
  assert.deepEqual(records[0].slice(0, 2), ["Plus longue sortie", "42,2 km"]);
  assert.match(records[0][2], /^Marathon · /);
  assert.deepEqual(
    records.map(([label]) => label),
    [
      "Plus longue sortie",
      "Plus gros D+",
      "Plus longue durée",
      "Meilleure semaine",
      "Meilleur mois"
    ]
  );
});

test("toucher une barre choisit la période ; l’année affiche l’année en cours", async () => {
  await tap("#statsChart .stats-bar:nth-last-child(2)");
  assert.equal((await kpis())[0], "Distance : 10 km (—)");
  await tap('#statsPeriodKinds [data-kind="year"]');
  assert.deepEqual(
    await page.evaluate(() => [
      document.getElementById("statsPeriodTitle").textContent,
      document.querySelectorAll("#statsChart .stats-bar").length
    ]),
    [String(new Date().getFullYear()), 6]
  );
});

test("la vue tient dans la largeur d’un iPhone", async () => {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true
  );
});
