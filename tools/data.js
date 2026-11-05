// Accès en ligne de commande aux données du compte Alterra (table `records` de Supabase),
// avec les identifiants du fichier `.env.local` (jamais versionné) :
//   ALTERRA_EMAIL=…
//   ALTERRA_PASSWORD=…
// Les règles d’accès de la base limitent l’outil aux lignes de ce compte, comme l’application.
//
// Usage :
//   npm run data -- list [collection]          liste les enregistrements
//   npm run data -- get <collection> <id>      enregistre la ligne dans .local/<collection>/<id>.json
//   npm run data -- put <collection> <fichier> envoie le fichier comme version la plus récente
//   npm run data -- delete <collection> <id>   supprime l’enregistrement sur tous les appareils
// Les appareils récupèrent les changements à leur prochaine synchronisation.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONAL_DATA_COLLECTIONS } from "../src/domain/backup-format.js";
import { createSupabaseClient } from "../src/storage/supabase.js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../src/storage/supabase-config.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const LOCAL_DIR = join(ROOT, ".local");

function readCredentials() {
  let text;
  try {
    text = readFileSync(join(ROOT, ".env.local"), "utf8");
  } catch {
    throw new Error("Fichier .env.local absent : ajoute ALTERRA_EMAIL et ALTERRA_PASSWORD.");
  }
  const values = Object.fromEntries(
    text
      .split(/\r?\n/)
      .map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(match => [match[1], match[2]])
  );
  if (!values.ALTERRA_EMAIL || !values.ALTERRA_PASSWORD) {
    throw new Error("ALTERRA_EMAIL ou ALTERRA_PASSWORD manquant dans .env.local.");
  }
  return { email: values.ALTERRA_EMAIL, password: values.ALTERRA_PASSWORD };
}

function assertCollection(collection) {
  if (!PERSONAL_DATA_COLLECTIONS.includes(collection)) {
    throw new Error(
      `Collection inconnue : ${collection}. Choix : ${PERSONAL_DATA_COLLECTIONS.join(", ")}.`
    );
  }
}

async function pullAll(client, token) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await client.pull(token, null, { offset, limit: 500 });
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

function describe(record) {
  const label = record.name || record.title || record.raceId || "";
  return [record.date, label].filter(Boolean).join(" · ");
}

async function main([command, ...args]) {
  if (!["list", "get", "put", "delete"].includes(command)) {
    throw new Error("Commande attendue : list, get, put ou delete (voir tools/data.js).");
  }
  const client = createSupabaseClient({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY });
  const { email, password } = readCredentials();
  const session = await client.signIn(email, password);
  const token = session.accessToken;

  try {
    if (command === "list" || command === "get") {
      const [collection, id] = args;
      if (collection) assertCollection(collection);
      if (command === "get" && !id) throw new Error("Usage : get <collection> <id>.");
      const rows = (await pullAll(client, token)).filter(
        row => !row.deleted && (!collection || row.collection === collection)
      );
      if (command === "list") {
        for (const row of rows) console.log(`${row.collection}/${row.id}  ${describe(row.data)}`);
        console.log(`${rows.length} enregistrement(s).`);
        return;
      }
      const row = rows.find(item => item.id === id);
      if (!row) throw new Error(`${collection}/${id} introuvable en ligne.`);
      const file = join(LOCAL_DIR, collection, `${id}.json`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(row.data, null, 2)}\n`);
      console.log(`Enregistré dans ${relative(ROOT, file)}.`);
      return;
    }

    const [collection, target] = args;
    assertCollection(collection);
    if (!target)
      throw new Error(`Usage : ${command} <collection> <${command === "put" ? "fichier" : "id"}>.`);
    const record = command === "put" ? JSON.parse(readFileSync(target, "utf8")) : null;
    const id = record ? record.id : target;
    if (typeof id !== "string" || !id.trim()) throw new Error("L’enregistrement n’a pas d’id.");
    await client.upsert(token, [
      {
        user_id: session.user.id,
        collection,
        id,
        data: record,
        deleted: !record,
        modified_at: new Date().toISOString()
      }
    ]);
    console.log(`${collection}/${id} ${record ? "envoyé" : "supprimé"}.`);
  } finally {
    await client.signOut(token).catch(() => {});
  }
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
