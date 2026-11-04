// Compte du Profil et synchronisation, contre un faux serveur Supabase installé dans la page :
// aucune requête ne sort, les données sont fictives.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../../tools/browser.js";
import { installServer, openHome, readDatabase, saveRecords, signIn, todayKey } from "./helpers.js";

let browser;
let page;

/**
 * Faux Supabase, avant tout script de la page : il répond aux requêtes vers le projet et garde
 * ses lignes dans le localStorage (clé hors préfixe « alterra- », donc hors sauvegarde).
 */
function fakeSupabase() {
  const ORIGIN = "https://czhlnvkbxzmyxzycymit.supabase.co";
  const KEY = "fake-supabase";
  const load = () =>
    JSON.parse(localStorage.getItem(KEY) || "null") || {
      users: { "test@exemple.fr": "motdepasse1" },
      rows: [],
      requests: [],
      clock: Date.parse("2026-01-01T00:00:00.000Z")
    };
  const save = state => localStorage.setItem(KEY, JSON.stringify(state));
  const json = (status, body) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status });
  const session = email => ({
    access_token: `jeton-${email}`,
    refresh_token: `renouvellement-${email}`,
    expires_in: 3600,
    user: { id: "u-test", email }
  });
  const realFetch = window.fetch.bind(window);
  window.confirm = () => true;
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== ORIGIN) return realFetch(input, options);
    const state = load();
    const body = options.body ? JSON.parse(options.body) : null;
    const method = options.method || "GET";
    state.requests.push(`${method} ${url.pathname}`);
    const authorized = options.headers?.Authorization === "Bearer jeton-test@exemple.fr";
    let response;
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      response =
        grant === "password" && state.users[body.email] === body.password
          ? json(200, session(body.email))
          : grant === "refresh_token"
            ? json(200, session("test@exemple.fr"))
            : json(400, { error_code: "invalid_credentials" });
    } else if (url.pathname === "/auth/v1/user" && method === "PUT") {
      state.users["test@exemple.fr"] = body.password;
      state.lastPasswordToken = options.headers.Authorization;
      response = json(200, { id: "u-test", email: "test@exemple.fr" });
    } else if (url.pathname === "/auth/v1/user") {
      response = json(200, { id: "u-test", email: "test@exemple.fr" });
    } else if (url.pathname.startsWith("/auth/v1/")) {
      response = json(200, {});
    } else if (!authorized) {
      response = json(401, { message: "JWT expired" });
    } else if (url.pathname === "/rest/v1/records" && method === "POST") {
      for (const row of body) {
        const index = state.rows.findIndex(
          item => item.collection === row.collection && item.id === row.id
        );
        if (index >= 0 && row.modified_at < state.rows[index].modified_at) continue;
        state.clock += 1000;
        const stored = { ...row, updated_at: new Date(state.clock).toISOString() };
        if (index >= 0) state.rows[index] = stored;
        else state.rows.push(stored);
      }
      response = json(201);
    } else if (url.pathname === "/rest/v1/records") {
      const since = url.searchParams.get("updated_at")?.replace("gt.", "");
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 500);
      response = json(
        200,
        state.rows
          .filter(row => !since || row.updated_at > since)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
          .slice(offset, offset + limit)
      );
    } else if (url.pathname === "/rest/v1/rpc/delete_my_account") {
      state.rows = [];
      response = json(204);
    } else {
      response = json(404, {});
    }
    save(state);
    return response;
  };
}

before(async () => {
  browser = await launchBrowser();
  page = browser.page;
  await page.setViewport(375, 812, { touch: true });
  await installServer(page, fakeSupabase);
  await openHome(page, { signIn: false });
});

after(() => browser?.close());

const server = () => page.evaluate(() => JSON.parse(localStorage.getItem("fake-supabase")));
const text = id => page.evaluate(id => document.getElementById(id).textContent.trim(), id);
const tap = selector =>
  page.evaluate(selector => document.querySelector(selector).click(), selector);
/** Ce qui est réellement affiché : écran de connexion, accueil, barre d’onglets. */
const screens = () =>
  page.evaluate(() =>
    ["viewSignIn", "viewHome"]
      .map(id => document.getElementById(id))
      .concat(document.querySelector(".tab-bar"))
      .map(element => getComputedStyle(element).display !== "none" && !element.hidden)
  );
const waitSynced = () =>
  page.waitFor(() => /^Synchronisé/.test(document.getElementById("accountSyncStatus").textContent));

const workout = (id, date, title) => ({
  id,
  date,
  type: "trail",
  title,
  status: "completed",
  distanceKm: 10,
  createdAt: "2026-01-01T00:00:00.000Z"
});

test("sans session, seul l’écran de connexion s’affiche ; un mauvais mot de passe est signalé", async () => {
  assert.deepEqual(await screens(), [true, false, false]);
  await signIn(page, "test@exemple.fr", "faux");
  await page.waitFor(
    () => document.getElementById("accountSignInStatus").dataset.state === "error"
  );
  assert.equal(await text("accountSignInStatus"), "E-mail ou mot de passe incorrect.");
  assert.deepEqual(await screens(), [true, false, false]);
});

test("la connexion envoie les données de l’appareil et affiche la synchronisation", async () => {
  await saveRecords(page, "workouts", [workout("w-local", await todayKey(page), "Trail local")]);
  await signIn(page, "test@exemple.fr", "motdepasse1");
  await page.waitFor(() => !document.body.classList.contains("is-signed-out"));
  assert.deepEqual(await screens(), [false, true, true], "l’application s’ouvre");
  await tap('.tab[href="#profil"]');
  await waitSynced();
  assert.equal(await text("accountEmail"), "test@exemple.fr");
  assert.deepEqual(
    (await server()).rows.map(row => [row.collection, row.id, row.data.title, row.deleted]),
    [["workouts", "w-local", "Trail local", false]]
  );
  assert.equal(
    await page.evaluate(() => document.getElementById("personalDataLastBackup").dataset.state),
    "recent",
    "plus de rappel de sauvegarde une fois synchronisé"
  );
});

test("une modification d’un autre appareil arrive et s’affiche", async () => {
  const today = await todayKey(page);
  await page.evaluate(day => {
    const state = JSON.parse(localStorage.getItem("fake-supabase"));
    state.clock += 1000;
    state.rows.push({
      user_id: "u-test",
      collection: "workouts",
      id: "w-tablette",
      data: {
        id: "w-tablette",
        date: day,
        type: "running",
        title: "Course de la tablette",
        status: "completed",
        distanceKm: 5,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      deleted: false,
      modified_at: new Date(state.clock).toISOString(),
      updated_at: new Date(state.clock).toISOString()
    });
    localStorage.setItem("fake-supabase", JSON.stringify(state));
  }, today);
  await tap("#accountSyncNow");
  await page.waitFor(async () => {
    const { createPersonalDataStore } = await import("/src/storage/personal-data.js");
    const records = await createPersonalDataStore().repository.list("workouts");
    return records.some(record => record.id === "w-tablette");
  });
  await tap('.tab[href="#stats"]');
  await tap('#statsCategories [data-category="all"]');
  await tap('#statsPeriodKinds [data-kind="week"]');
  await page.waitFor(
    () => document.querySelector("#statsKpis .stats-kpi:last-child dd")?.textContent === "2"
  );
});

test("une séance enregistrée depuis l’application part en ligne", async () => {
  await page.evaluate(() => {
    document.querySelector('.tab[href="#accueil"]').click();
    document.querySelector(".calendar-day.is-today .calendar-date-button").click();
    document.getElementById("addTrainingButton").click();
    const form = document.getElementById("trainingForm");
    form.elements.namedItem("title").value = "Séance du formulaire";
    form.requestSubmit();
  });
  await page.waitFor(
    () =>
      JSON.parse(localStorage.getItem("fake-supabase")).rows.some(
        row => row.data?.title === "Séance du formulaire"
      ),
    { timeout: 8000 }
  );
});

test("la déconnexion ramène à l’écran de connexion et garde les données", async () => {
  await tap('.tab[href="#profil"]');
  await tap("#accountSignOut");
  await page.waitFor(() => document.body.classList.contains("is-signed-out"));
  assert.deepEqual(await screens(), [true, false, false]);
  const database = await readDatabase(page);
  assert.equal(database.data.workouts.length, 3);
  assert.equal(database.data.syncState[0].value.session, null);
});

test("le lien de réinitialisation ouvre le choix d’un nouveau mot de passe", async () => {
  await page.gotoBlank();
  await page.goto("/index.html#access_token=jeton-recup&type=recovery&expires_in=3600");
  await page.waitFor(() => document.getElementById("accountRecovery").open);
  assert.equal(await page.evaluate(() => location.hash), "#profil", "jeton retiré de l’adresse");
  await page.evaluate(() => {
    const dialog = document.getElementById("accountRecovery");
    dialog.querySelector('[name="password"]').value = "nouveau-secret";
    dialog.querySelector('[value="save"]').click();
  });
  await page.waitFor(() => !document.getElementById("accountRecovery").open);
  const state = await server();
  assert.deepEqual(
    [state.users["test@exemple.fr"], state.lastPasswordToken],
    ["nouveau-secret", "Bearer jeton-recup"]
  );
  assert.equal(
    await page.evaluate(
      () => document.getElementById("accountSignIn").elements.namedItem("email").value
    ),
    "test@exemple.fr"
  );
});

test("aucune erreur JavaScript", () => {
  assert.deepEqual(page.errors, []);
});
