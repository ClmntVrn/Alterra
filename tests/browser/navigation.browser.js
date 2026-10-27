// Barre d’onglets de l’accueil : vues, onglets à venir, pastille de sauvegarde et mise en page.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { openHome, openToday } from "./helpers.js";

let browser;
let page;

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
  await page.setViewport(375, 812, { touch: true });
  await openHome(page);
});

after(() => browser?.close());

const state = () =>
  page.evaluate(() => ({
    home: !document.getElementById("viewHome").hidden,
    profile: !document.getElementById("viewProfile").hidden,
    // Texte rendu, sans les éléments masqués, tel qu’un lecteur d’écran l’annonce.
    current:
      document
        .querySelector('.tab[aria-current="page"]')
        ?.innerText.replace(/\s+/g, " ")
        .replace(" ,", ",")
        .trim() ?? null,
    hash: location.hash
  }));
const tap = selector =>
  page.evaluate(selector => document.querySelector(selector).click(), selector);

test("l’accueil s’ouvre par défaut avec les statistiques et le calendrier", async () => {
  assert.deepEqual(await state(), { home: true, profile: false, current: "Accueil", hash: "" });
  assert.deepEqual(
    await page.evaluate(() =>
      ["activityStatistics", "calendarDays"].map(id =>
        document.getElementById("viewHome").contains(document.getElementById(id))
      )
    ),
    [true, true]
  );
});

test("Objectifs, Stats et IA sont grisés et annoncés indisponibles", async () => {
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll(".tab.is-soon")].map(tab => [
        tab.tagName,
        tab.getAttribute("aria-disabled"),
        tab.textContent.replace(/\s+/g, " ").trim()
      ])
    ),
    [
      ["SPAN", "true", "Objectifs Bientôt"],
      ["SPAN", "true", "Stats Bientôt"],
      ["SPAN", "true", "IA Bientôt"]
    ]
  );
});

test("le Profil s’ouvre sans rechargement ; le retour à l’accueil garde la journée affichée", async () => {
  await openToday(page);
  const day = await page.evaluate(() => document.getElementById("calendarDayTitle").textContent);
  await page.evaluate(() => {
    window.notReloaded = true;
  });
  const historyLength = await page.evaluate(() => history.length);
  await tap('.tab[href="#profil"]');
  assert.deepEqual(await state(), {
    home: false,
    profile: true,
    current: "Profil, sauvegarde à faire",
    hash: "#profil"
  });
  assert.equal(
    await page.evaluate(() => history.length),
    historyLength,
    "pas d’entrée d’historique"
  );
  await tap('.tab[href="#accueil"]');
  assert.deepEqual(await state(), {
    home: true,
    profile: false,
    current: "Accueil",
    hash: "#accueil"
  });
  assert.deepEqual(
    await page.evaluate(() => [
      window.notReloaded,
      document.getElementById("calendarDayTitle").hidden,
      document.getElementById("calendarDayTitle").textContent
    ]),
    [true, false, day]
  );
});

test("la pastille du Profil signale une sauvegarde à faire, puis disparaît", async () => {
  const badge = () =>
    page.evaluate(() => [
      document.getElementById("profileBadge").hidden,
      document.getElementById("profileBadgeText").hidden
    ]);
  assert.deepEqual(await badge(), [false, false], "aucune sauvegarde sur une installation neuve");
  await page.evaluate(async () => {
    const { createPersonalDataStore } = await import("/src/storage/personal-data.js");
    await createPersonalDataStore().recordBackup(new Date().toISOString());
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitFor(() => document.getElementById("profileBadge").hidden);
  assert.deepEqual(await badge(), [true, true]);
});

test("une adresse #profil ouvre directement le Profil", async () => {
  // Depuis index.html, seule l’ancre changerait : on repart d’une autre page pour un vrai lancement.
  await page.gotoBlank();
  await page.goto("/index.html#profil");
  await page.waitFor(() => !document.getElementById("personalDataLastBackup").hidden);
  assert.deepEqual(await state(), {
    home: false,
    profile: true,
    current: "Profil",
    hash: "#profil"
  });
});

for (const width of [320, 390]) {
  test(`à ${width} px, la barre tient sur une ligne et ne cache pas la fin de la page`, async () => {
    await page.setViewport(width, 700, { touch: true });
    await openHome(page);
    const layout = await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
      const bar = document.querySelector(".tab-bar").getBoundingClientRect();
      const tabs = [...document.querySelectorAll(".tab")].map(tab => tab.getBoundingClientRect());
      const calendar = document.querySelector(".calendar-section").getBoundingClientRect();
      return {
        barBottom: Math.round(bar.bottom),
        viewport: window.innerHeight,
        oneRow: tabs.every(tab => Math.abs(tab.top - tabs[0].top) < 1),
        tabsInside: tabs.every(tab => tab.left >= 0 && tab.right <= window.innerWidth + 0.5),
        calendarAboveBar: calendar.bottom <= bar.top,
        scrollWidth: document.documentElement.scrollWidth
      };
    });
    assert.deepEqual(layout, {
      barBottom: 700,
      viewport: 700,
      oneRow: true,
      tabsInside: true,
      calendarAboveBar: true,
      scrollWidth: width
    });
  });
}

test("la fiche course n’a pas de barre d’onglets", async () => {
  await page.goto("/race.html?id=inconnue");
  await page.waitFor(() => document.querySelector(".race-error"));
  assert.equal(await page.evaluate(() => document.querySelector(".tab-bar")), null);
});

test("aucune erreur JavaScript, hors fiche inconnue attendue", () => {
  assert.deepEqual(
    page.errors.filter(error => !/Course inconnue/.test(error)),
    []
  );
});
