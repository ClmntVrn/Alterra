import { test } from "node:test";
import assert from "node:assert/strict";
import { listObjectives } from "../../src/domain/objectives.js";

const names = list => list.map(race => race.name);

test("listObjectives trie les courses à venir de la plus proche à la plus lointaine", () => {
  const { upcoming, past } = listObjectives(
    {
      races: [
        { id: "b", name: "Fiche B", date: "2026-12-01" },
        { id: "a", name: "Fiche A", date: "2026-11-01", startTime: "07:00" }
      ],
      personalRaces: [{ id: "p", name: "Perso", date: "2026-11-01" }]
    },
    "2026-10-27"
  );
  assert.deepEqual(names(upcoming), ["Fiche A", "Perso", "Fiche B"]);
  assert.deepEqual(
    upcoming.map(race => [race.eventType, race.daysLeft]),
    [
      ["race", 5],
      ["personalRace", 5],
      ["race", 35]
    ]
  );
  assert.deepEqual(past, []);
});

test("listObjectives garde une course à venir jusqu’à son dernier jour", () => {
  const { upcoming, past } = listObjectives(
    {
      races: [],
      personalRaces: [
        { id: "1", name: "Sur deux jours", date: "2026-10-26", endDate: "2026-10-27" },
        { id: "2", name: "Hier", date: "2026-10-26" },
        { id: "3", name: "Il y a un an", date: "2025-10-26" }
      ]
    },
    "2026-10-27"
  );
  assert.deepEqual(names(upcoming), ["Sur deux jours"]);
  assert.equal(upcoming[0].daysLeft, -1);
  assert.deepEqual(names(past), ["Hier", "Il y a un an"]);
});

test("listObjectives ignore les courses sans date valide ou sans nom", () => {
  const { upcoming, past } = listObjectives(
    {
      races: [{ id: "x", name: "Sans date" }],
      personalRaces: [
        { id: "y", date: "2026-11-01" },
        { id: "z", name: "Date invalide", date: "2026-13-40" }
      ]
    },
    "2026-10-27"
  );
  assert.deepEqual([...upcoming, ...past], []);
});
