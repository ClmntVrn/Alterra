// Nouvelle version en une commande : numéro, historique des versions et cache hors ligne.
// Usage : npm run release -- 0.8.17 "Ajouter tel truc." "Corriger tel autre."
// Ne fait ni commit ni push.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Fichiers modifiés par une nouvelle version, relatifs à la racine du dépôt. */
export const RELEASE_FILES = Object.freeze([
  "package.json",
  "package-lock.json",
  "index.html",
  "versions.html",
  "sw.js"
]);

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** Compare deux versions AAAA.BB.CC ; renvoie un nombre négatif, nul ou positif. */
export function compareVersions(left, right) {
  const a = left.match(VERSION_PATTERN).slice(1).map(Number);
  const b = right.match(VERSION_PATTERN).slice(1).map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** Nom du cache du service worker pour une version. */
export const cacheName = version => `alterra-${version}`;

const escapeHtml = text =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function replaceOnce(source, pattern, replacement, description) {
  if (!pattern.test(source)) throw new Error(`Introuvable : ${description}.`);
  return source.replace(pattern, replacement);
}

/**
 * Calcule le nouveau contenu des fichiers ; ne touche pas au disque.
 * @param {Record<string, string>} files Contenu actuel de RELEASE_FILES.
 * @param {string} version Nouvelle version, supérieure à l’actuelle.
 * @param {string[]} items Lignes de l’historique, en français.
 * @param {Date} date Date de la version, à l’heure locale.
 * @returns {Record<string, string>}
 */
export function applyRelease(files, version, items, date) {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Version invalide : « ${version} ». Format attendu : 0.8.17.`);
  }
  const lines = items.map(item => item.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Indique au moins une ligne d’historique pour cette version.");

  const pkg = JSON.parse(files["package.json"]);
  if (compareVersions(version, pkg.version) <= 0) {
    throw new Error(
      `La version ${version} doit être supérieure à la version actuelle ${pkg.version}.`
    );
  }
  pkg.version = version;

  const lock = JSON.parse(files["package-lock.json"]);
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;

  const pad = value => String(value).padStart(2, "0");
  const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const dateLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
  const entry = [
    `<article class="version-entry">`,
    `  <div class="version-heading">`,
    `    <h2>${version}</h2>`,
    `    <time datetime="${dateKey}">${dateLabel}</time>`,
    `  </div>`,
    `  <ul>`,
    ...lines.map(line => `    <li>${escapeHtml(line)}</li>`),
    `  </ul>`,
    `</article>`,
    ``,
    // La nouvelle entrée se place avant la première existante, dont on remet la balise d’ouverture.
    `<article class="version-entry">`
  ].join("\n");

  let versions = replaceOnce(
    files["versions.html"],
    /(Version actuelle : <strong>)[^<]*(<\/strong>)/,
    `$1${version}$2`,
    "la version actuelle dans versions.html"
  );
  versions = replaceOnce(
    versions,
    /<article class="version-entry">/,
    entry,
    "la première entrée de versions.html"
  );

  return {
    "package.json": `${JSON.stringify(pkg, null, 2)}\n`,
    "package-lock.json": `${JSON.stringify(lock, null, 2)}\n`,
    "index.html": replaceOnce(
      files["index.html"],
      /(Version <strong>)[^<]*(<\/strong>)/,
      `$1${version}$2`,
      "le numéro de version en bas de index.html"
    ),
    "versions.html": versions,
    "sw.js": replaceOnce(
      files["sw.js"],
      /const CACHE_NAME = "[^"]*";/,
      `const CACHE_NAME = "${cacheName(version)}";`,
      "CACHE_NAME dans sw.js"
    )
  };
}

async function main([version, ...items]) {
  const current = Object.fromEntries(
    RELEASE_FILES.map(file => [file, readFileSync(join(ROOT, file), "utf8")])
  );
  const updated = applyRelease(current, version, items, new Date());
  // Tout est formaté avant la première écriture : une erreur ne laisse pas de version à moitié faite.
  const prettier = await import("prettier");
  const formatted = {};
  for (const file of RELEASE_FILES) {
    const filepath = join(ROOT, file);
    const options = (await prettier.resolveConfig(filepath)) || {};
    formatted[file] = await prettier.format(updated[file], { ...options, filepath });
  }
  for (const file of RELEASE_FILES) writeFileSync(join(ROOT, file), formatted[file]);
  console.log(`Version ${version} préparée : ${RELEASE_FILES.join(", ")}.`);
  console.log("Vérification avec npm run check…");
  const check = spawnSync("npm run check", { cwd: ROOT, stdio: "inherit", shell: true });
  if (check.status !== 0) {
    console.error("npm run check a échoué : corrige avant de commiter.");
    process.exitCode = 1;
    return;
  }
  console.log("Prêt : relis le diff, mets à jour docs/roadmap.md si besoin, puis commite.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
