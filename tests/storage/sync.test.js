import { test } from "node:test";
import assert from "node:assert/strict";
import { createSync } from "../../src/storage/sync.js";
import { createClock, createMemoryDevice, createMemoryServer } from "./fakes.js";

function setup() {
  const clock = createClock();
  const server = createMemoryServer(clock, { "a@test.fr": "secret-a", "b@test.fr": "secret-b" });
  const device = (name = "phone") => {
    const adapter = createMemoryDevice(clock);
    const events = { remote: 0, statuses: [] };
    const sync = createSync({
      adapter,
      client: server.client,
      now: clock,
      onRemoteChange: () => (events.remote += 1),
      onStatus: status => events.statuses.push(status)
    });
    return { name, adapter, sync, events };
  };
  return { server, device };
}

const workout = (id, title) => ({ id, title, date: "2026-11-04", status: "completed" });

test("la première connexion envoie les données de l’appareil", async () => {
  const { server, device } = setup();
  const phone = device();
  await phone.adapter.save("workouts", workout("w1", "Trail"));
  await phone.adapter.save("personalRaces", { id: "r1", name: "Course", date: "2026-12-01" });
  const status = await phone.sync.signIn(" a@test.fr ", "secret-a");
  assert.deepEqual(
    [status.connected, status.email, status.pending, status.error],
    [true, "a@test.fr", 0, ""]
  );
  assert.deepEqual([...server.rows.keys()].sort(), ["u1/personalRaces/r1", "u1/workouts/w1"]);
});

test("un second appareil récupère les données, puis chaque modification circule", async () => {
  const { device } = setup();
  const phone = device();
  const tablet = device("tablet");
  await phone.adapter.save("workouts", workout("w1", "Trail"));
  await phone.sync.signIn("a@test.fr", "secret-a");
  await tablet.sync.signIn("a@test.fr", "secret-a");
  assert.deepEqual(await tablet.adapter.list("workouts"), [workout("w1", "Trail")]);
  assert.equal(tablet.events.remote, 1, "l’écran est rafraîchi");

  await tablet.adapter.save("workouts", workout("w1", "Trail long"));
  await tablet.adapter.save("workouts", workout("w2", "Vélo"));
  await tablet.sync.sync();
  await phone.sync.sync();
  await phone.adapter.remove("workouts", "w2");
  await phone.sync.sync();
  assert.deepEqual(await phone.adapter.list("workouts"), [workout("w1", "Trail long")]);
  await tablet.sync.sync();
  assert.deepEqual(await tablet.adapter.list("workouts"), [workout("w1", "Trail long")]);
});

test("la modification la plus récente l’emporte, même envoyée en dernier", async () => {
  const { device } = setup();
  const phone = device();
  const tablet = device("tablet");
  await phone.adapter.save("workouts", workout("w1", "Départ"));
  await phone.sync.signIn("a@test.fr", "secret-a");
  await tablet.sync.signIn("a@test.fr", "secret-a");
  // Le téléphone modifie hors ligne, la tablette modifie après lui et envoie la première.
  await phone.adapter.save("workouts", workout("w1", "Téléphone"));
  await tablet.adapter.save("workouts", workout("w1", "Tablette"));
  await tablet.sync.sync();
  await phone.sync.sync();
  assert.deepEqual(await phone.adapter.get("workouts", "w1"), workout("w1", "Tablette"));
});

test("hors ligne, les modifications attendent et partent au retour du réseau", async () => {
  const { server, device } = setup();
  const phone = device();
  await phone.sync.signIn("a@test.fr", "secret-a");
  await phone.adapter.save("workouts", workout("w1", "Trail"));
  server.failOnce(Object.assign(new Error("Pas de connexion à Internet."), { offline: true }));
  await phone.sync.sync();
  const offline = phone.events.statuses.at(-1);
  assert.deepEqual([offline.pending, offline.offline, offline.connected], [1, true, true]);
  await phone.sync.sync();
  assert.equal(phone.events.statuses.at(-1).pending, 0);
  assert.ok(server.rows.has("u1/workouts/w1"));
});

test("un jeton expiré est renouvelé sans redemander le mot de passe", async () => {
  const { server, device } = setup();
  const phone = device();
  await phone.sync.signIn("a@test.fr", "secret-a");
  server.expireTokens();
  await phone.adapter.save("workouts", workout("w1", "Trail"));
  await phone.sync.sync();
  const status = phone.events.statuses.at(-1);
  assert.deepEqual([status.error, status.pending, status.connected], ["", 0, true]);
});

test("chaque compte ne voit que ses données", async () => {
  const { device } = setup();
  const phone = device();
  const friend = device("friend");
  await phone.adapter.save("workouts", workout("w1", "À moi"));
  await phone.sync.signIn("a@test.fr", "secret-a");
  await friend.sync.signIn("b@test.fr", "secret-b");
  assert.deepEqual(await friend.adapter.list("workouts"), []);
});

test("un mauvais mot de passe laisse l’appareil déconnecté", async () => {
  const { device } = setup();
  const phone = device();
  await assert.rejects(phone.sync.signIn("a@test.fr", "faux"), /mot de passe incorrect/);
  assert.equal((await phone.sync.status()).connected, false);
});

test("la déconnexion garde les données ; la suppression du compte vide le serveur", async () => {
  const { server, device } = setup();
  const phone = device();
  await phone.adapter.save("workouts", workout("w1", "Trail"));
  await phone.sync.signIn("a@test.fr", "secret-a");
  assert.equal((await phone.sync.signOut()).connected, false);
  assert.equal((await phone.adapter.list("workouts")).length, 1);
  await phone.sync.sync();
  await phone.sync.signIn("a@test.fr", "secret-a");
  await phone.sync.deleteAccount();
  assert.equal(server.rows.size, 0);
  assert.equal((await phone.sync.status()).connected, false);
  assert.equal((await phone.adapter.list("workouts")).length, 1);
});

test("le mot de passe se change une fois connecté", async () => {
  const { device } = setup();
  const phone = device();
  await phone.sync.signIn("a@test.fr", "secret-a");
  await phone.sync.changePassword("nouveau-secret");
  await phone.sync.signOut();
  await assert.rejects(phone.sync.signIn("a@test.fr", "secret-a"));
  assert.equal((await phone.sync.signIn("a@test.fr", "nouveau-secret")).connected, true);
});
