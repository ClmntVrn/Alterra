import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRelease, cacheName, compareVersions } from "../../tools/release.js";

const files = () => ({
  "package.json": JSON.stringify({ name: "alterra", version: "0.8.16" }),
  "package-lock.json": JSON.stringify({
    name: "alterra",
    version: "0.8.7",
    packages: { "": { name: "alterra", version: "0.8.7" } }
  }),
  "index.html": "<footer><span>Version <strong>0.8.16</strong></span></footer>",
  "versions.html": [
    '<p class="sub">Version actuelle : <strong>0.8.16</strong></p>',
    '<section class="section version-list">',
    '<article class="version-entry"><h2>0.8.16</h2></article>',
    "</section>"
  ].join("\n"),
  "sw.js": 'const CACHE_NAME = "alterra-v54";\nconst FILES = [];'
});

const release = (version = "0.8.17", items = ["Corriger <tout> & le reste."]) =>
  applyRelease(files(), version, items, new Date(2026, 10, 3));

test("compareVersions compare numériquement chaque partie", () => {
  assert.ok(compareVersions("0.8.10", "0.8.9") > 0);
  assert.ok(compareVersions("0.9.0", "0.8.16") > 0);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});

test("la version est mise à jour partout, y compris le cache hors ligne", () => {
  const updated = release();
  assert.equal(JSON.parse(updated["package.json"]).version, "0.8.17");
  const lock = JSON.parse(updated["package-lock.json"]);
  assert.deepEqual([lock.version, lock.packages[""].version], ["0.8.17", "0.8.17"]);
  assert.match(updated["index.html"], /Version <strong>0\.8\.17<\/strong>/);
  assert.match(updated["versions.html"], /Version actuelle : <strong>0\.8\.17<\/strong>/);
  assert.match(updated["sw.js"], /const CACHE_NAME = "alterra-0\.8\.17";/);
  assert.equal(cacheName("0.8.17"), "alterra-0.8.17");
});

test("l’entrée d’historique est ajoutée en tête, datée et échappée", () => {
  const html = release("0.8.17", ["Première ligne.", "  ", "Corriger <tout> & le reste."])[
    "versions.html"
  ];
  assert.ok(html.indexOf("<h2>0.8.17</h2>") < html.indexOf("<h2>0.8.16</h2>"));
  assert.equal(html.match(/<article class="version-entry">/g).length, 2, "deux entrées ouvertes");
  assert.equal(html.match(/<\/article>/g).length, 2, "chaque entrée est fermée");
  assert.match(html, /<\/article>\s*<article class="version-entry"><h2>0\.8\.16<\/h2>/);
  assert.match(html, /<time datetime="2026-11-03">3 novembre 2026<\/time>/);
  assert.match(html, /<li>Première ligne\.<\/li>/);
  assert.match(html, /<li>Corriger &lt;tout&gt; &amp; le reste\.<\/li>/);
  assert.equal((html.match(/<li>/g) || []).length, 2, "les lignes vides sont ignorées");
});

test("une version invalide, non supérieure ou sans historique est refusée", () => {
  assert.throws(() => release("0.8"), /Version invalide/);
  assert.throws(() => release("0.8.16"), /doit être supérieure/);
  assert.throws(() => release("0.8.2"), /doit être supérieure/);
  assert.throws(() => release("0.8.17", [" "]), /au moins une ligne/);
});

test("rien n’est calculé si un fichier n’a pas le format attendu", () => {
  const broken = { ...files(), "sw.js": "const FILES = [];" };
  assert.throws(
    () => applyRelease(broken, "0.8.17", ["Ligne."], new Date()),
    /Introuvable : CACHE_NAME/
  );
});
