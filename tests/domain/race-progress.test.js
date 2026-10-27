import { test } from "node:test";
import assert from "node:assert/strict";
import { findRaceProgress } from "../../src/domain/race-progress.js";

const checkpoints = [{ id: "r1" }, { id: "r2" }, { id: "finish" }];
const checked = ids => id => ids.includes(id);

test("findRaceProgress part du départ quand rien n’est coché", () => {
  assert.deepEqual(findRaceProgress(checkpoints, checked([])), {
    reached: null,
    next: { id: "r1" }
  });
});

test("findRaceProgress s’arrête au premier ravito non coché", () => {
  assert.deepEqual(findRaceProgress(checkpoints, checked(["r1", "finish"])), {
    reached: { id: "r1" },
    next: { id: "r2" }
  });
});

test("findRaceProgress n’a plus de prochain ravito une fois l’arrivée cochée", () => {
  assert.deepEqual(findRaceProgress(checkpoints, checked(["r1", "r2", "finish"])), {
    reached: { id: "finish" },
    next: null
  });
});
