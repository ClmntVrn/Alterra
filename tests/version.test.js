// Le numéro de version doit être le même partout, sinon l’iPhone peut garder l’ancienne version.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cacheName } from "../tools/release.js";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const { version } = JSON.parse(read("package.json"));

test("index.html, versions.html, package-lock.json et le cache affichent la même version", () => {
  const lock = JSON.parse(read("package-lock.json"));
  const versions = read("versions.html");
  assert.equal(lock.version, version, "package-lock.json");
  assert.equal(lock.packages[""].version, version, "package-lock.json (racine)");
  assert.match(read("index.html"), new RegExp(`Version <strong>${version}</strong>`), "index.html");
  assert.match(
    versions,
    new RegExp(`Version actuelle : <strong>${version}</strong>`),
    "versions.html"
  );
  assert.equal(versions.match(/<h2>([^<]+)<\/h2>/)[1], version, "première entrée de versions.html");
  assert.match(read("sw.js"), new RegExp(`const CACHE_NAME = "${cacheName(version)}";`), "sw.js");
});
