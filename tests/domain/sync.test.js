import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunkRows,
  createPendingChange,
  planPulledRows,
  pullSince,
  stableStringify,
  toRemoteRow
} from "../../src/domain/sync.js";

const collections = ["workouts", "personalRaces"];

test("toRemoteRow envoie l’enregistrement, ou une suppression s’il n’existe plus", () => {
  const change = createPendingChange("workouts", "w1", { changedAt: "2026-11-04T08:00:00.000Z" });
  assert.equal(change.key, "workouts/w1");
  assert.deepEqual(toRemoteRow(change, { id: "w1", title: "Trail" }, "u1"), {
    user_id: "u1",
    collection: "workouts",
    id: "w1",
    data: { id: "w1", title: "Trail" },
    deleted: false,
    modified_at: "2026-11-04T08:00:00.000Z"
  });
  assert.equal(toRemoteRow(change, null, "u1").deleted, true);
  assert.equal(toRemoteRow(change, null, "u1").data, null);
});

test("chunkRows coupe en lots selon le nombre de lignes et leur taille", () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    id: String(index),
    text: "x".repeat(40)
  }));
  assert.deepEqual(
    chunkRows(rows, { maxRows: 2 }).map(chunk => chunk.length),
    [2, 2, 1]
  );
  assert.deepEqual(
    chunkRows(rows, { maxBytes: 120 }).map(chunk => chunk.length),
    [2, 2, 1]
  );
  assert.equal(
    chunkRows([{ big: "x".repeat(500) }], { maxBytes: 10 }).length,
    1,
    "une ligne seule"
  );
  assert.deepEqual(chunkRows([]), []);
});

test("pullSince recule le repère d’une minute et lit les microsecondes", () => {
  assert.equal(pullSince("2026-11-04T10:00:00.123456+00:00"), "2026-11-04T09:59:00.123Z");
  assert.equal(pullSince(null), null);
  assert.equal(pullSince("pas une date"), null);
});

test("stableStringify ne dépend pas de l’ordre des clés", () => {
  assert.equal(
    stableStringify({ b: 1, a: [{ d: 2, c: 3 }] }),
    stableStringify({ a: [{ c: 3, d: 2 }], b: 1 })
  );
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
  assert.equal(stableStringify({ a: 1, b: undefined }), stableStringify({ a: 1 }));
});

test("planPulledRows garde les modifications locales en attente et ignore l’inconnu", () => {
  const rows = [
    {
      collection: "workouts",
      id: "w1",
      data: { id: "w1" },
      deleted: false,
      updated_at: "2026-11-04T10:00:01Z"
    },
    {
      collection: "workouts",
      id: "w2",
      data: null,
      deleted: true,
      updated_at: "2026-11-04T10:00:03Z"
    },
    {
      collection: "workouts",
      id: "w3",
      data: { id: "w3" },
      deleted: false,
      updated_at: "2026-11-04T10:00:02Z"
    },
    {
      collection: "inconnue",
      id: "x",
      data: { id: "x" },
      deleted: false,
      updated_at: "2026-11-04T10:00:00Z"
    },
    {
      collection: "workouts",
      id: "w4",
      data: { id: "autre" },
      deleted: false,
      updated_at: "2026-11-04T10:00:00Z"
    }
  ];
  const plan = planPulledRows(rows, { pendingKeys: new Set(["workouts/w3"]), collections });
  assert.deepEqual(plan, {
    saves: [{ collection: "workouts", record: { id: "w1" } }],
    removes: [{ collection: "workouts", id: "w2" }],
    cursor: "2026-11-04T10:00:03Z"
  });
});
