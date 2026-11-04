import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupabaseClient } from "../../src/storage/supabase.js";

/** Client branché sur une fausse fonction fetch qui note les requêtes et rend `reply`. */
function setup(reply = () => ({ status: 200, body: {} })) {
  const calls = [];
  const client = createSupabaseClient({
    url: "https://projet.supabase.co",
    key: "sb_publishable_test",
    now: () => 1_000_000,
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: options.body && JSON.parse(options.body) });
      const { status, body } = reply(url, options);
      return new Response(body === undefined ? null : JSON.stringify(body), { status });
    }
  });
  return { client, calls };
}

const sessionBody = {
  access_token: "jeton",
  refresh_token: "renouvellement",
  expires_in: 3600,
  user: { id: "u1", email: "a@test.fr" }
};

test("signIn envoie l’e-mail et le mot de passe avec la clé publique", async () => {
  const { client, calls } = setup(() => ({ status: 200, body: sessionBody }));
  assert.deepEqual(await client.signIn("a@test.fr", "secret"), {
    accessToken: "jeton",
    refreshToken: "renouvellement",
    expiresAt: 1_000_000 + 3_600_000,
    user: { id: "u1", email: "a@test.fr" }
  });
  assert.equal(calls[0].url, "https://projet.supabase.co/auth/v1/token?grant_type=password");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.apikey, "sb_publishable_test");
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(calls[0].body, { email: "a@test.fr", password: "secret" });
});

test("les erreurs connues sont traduites, le réseau absent est signalé", async () => {
  const { client } = setup(() => ({
    status: 400,
    body: { error_code: "invalid_credentials", msg: "Invalid login credentials" }
  }));
  await assert.rejects(client.signIn("a@test.fr", "faux"), {
    message: "E-mail ou mot de passe incorrect.",
    status: 400
  });
  const offline = createSupabaseClient({
    url: "https://projet.supabase.co",
    key: "k",
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    }
  });
  await assert.rejects(offline.signIn("a@test.fr", "x"), { offline: true });
});

test("pull lit les lignes après le repère, dans l’ordre, avec le jeton du compte", async () => {
  const { client, calls } = setup(() => ({ status: 200, body: [] }));
  await client.pull("jeton", "2026-11-04T09:59:00.000Z", { offset: 500 });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/rest/v1/records");
  assert.equal(url.searchParams.get("updated_at"), "gt.2026-11-04T09:59:00.000Z");
  assert.equal(url.searchParams.get("order"), "updated_at.asc,collection.asc,id.asc");
  assert.equal(url.searchParams.get("offset"), "500");
  assert.equal(calls[0].headers.Authorization, "Bearer jeton");
  await client.pull("jeton", null);
  assert.equal(new URL(calls[1].url).searchParams.has("updated_at"), false);
});

test("upsert remplace les lignes existantes sans les renvoyer", async () => {
  const { client, calls } = setup(() => ({ status: 201, body: undefined }));
  await client.upsert("jeton", [{ id: "w1" }]);
  assert.equal(
    calls[0].url,
    "https://projet.supabase.co/rest/v1/records?on_conflict=user_id,collection,id"
  );
  assert.equal(calls[0].headers.Prefer, "resolution=merge-duplicates,return=minimal");
  assert.deepEqual(calls[0].body, [{ id: "w1" }]);
});

test("une session refusée demande de se reconnecter", async () => {
  const { client } = setup(() => ({ status: 401, body: { message: "JWT expired" } }));
  await assert.rejects(client.pull("vieux", null), {
    status: 401,
    message: "Session expirée : reconnecte-toi."
  });
});
