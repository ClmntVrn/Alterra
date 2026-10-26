// Le précache doit contenir toutes les ressources livrées, sinon l’app hors ligne casse.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const NOT_SHIPPED = new Set(["node_modules", "tests", "tools", "docs", ".git", ".github"]);
const SHIPPED_EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".svg", ".png"]);
const ROOT_TOOLING = new Set(["eslint.config.js", "package.json", "package-lock.json", "sw.js"]);

function listShippedFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".") || NOT_SHIPPED.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listShippedFiles(path);
    const file = relative(root, path).replaceAll("\\", "/");
    return SHIPPED_EXTENSIONS.has(extname(file)) && !ROOT_TOOLING.has(file) ? [file] : [];
  });
}

const source = readFileSync(join(root, "sw.js"), "utf8");
const precached = [...source.matchAll(/^\s*"\.\/([^"]*)",?$/gm)].map(match => match[1]);

test("chaque ressource livrée est précachée", () => {
  const missing = listShippedFiles(root).filter(file => !precached.includes(file));
  assert.deepEqual(missing, [], "à ajouter dans FILES de sw.js");
});

test("chaque entrée du précache existe", () => {
  const unknown = precached.filter(file => file && !existsSync(join(root, file)));
  assert.deepEqual(unknown, [], "à retirer de FILES dans sw.js");
});
