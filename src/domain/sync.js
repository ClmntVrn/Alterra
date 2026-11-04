// Règles de la synchronisation avec la base en ligne, sans réseau ni stockage.
// Une modification locale attend dans une file (collection, identifiant, heure) jusqu’à son envoi ;
// les nouveautés en ligne sont récupérées depuis le dernier repère du serveur.

/** Écart retiré au repère de récupération, pour ne manquer aucune écriture simultanée. */
export const PULL_MARGIN_MS = 60_000;
export const PULL_PAGE_SIZE = 500;
const BATCH_MAX_ROWS = 100;
const BATCH_MAX_BYTES = 1_500_000;

/**
 * @typedef {{ key: string, collection: string, id: string, deleted: boolean, changedAt: string }}
 *   PendingChange Modification locale en attente d’envoi.
 * @typedef {{ collection: string, id: string, data: Object|null, deleted: boolean,
 *   updated_at: string }} RemoteRow Ligne lue en ligne.
 */

/** @returns {string} Clé d’une modification en attente : « workouts/abc ». */
export function pendingKey(collection, id) {
  return `${collection}/${id}`;
}

/** @returns {PendingChange} */
export function createPendingChange(collection, id, { deleted = false, changedAt }) {
  return { key: pendingKey(collection, id), collection, id, deleted, changedAt };
}

/**
 * Ligne à envoyer pour une modification ; une séance supprimée entre-temps part comme suppression.
 * @param {PendingChange} change
 * @param {Object|null} record Enregistrement local actuel.
 * @param {string} userId
 */
export function toRemoteRow(change, record, userId) {
  const deleted = change.deleted || !record;
  return {
    user_id: userId,
    collection: change.collection,
    id: change.id,
    data: deleted ? null : record,
    deleted,
    modified_at: change.changedAt
  };
}

/**
 * Lots d’envoi d’au plus 100 lignes et d’environ 1,5 Mo (une fiche avec son GPX peut peser lourd).
 * @template T
 * @param {T[]} rows
 * @param {{ maxRows?: number, maxBytes?: number, measure?: (row: T) => unknown }} [options]
 *   measure : partie de l’élément envoyée, dont la taille compte.
 * @returns {T[][]}
 */
export function chunkRows(
  rows,
  { maxRows = BATCH_MAX_ROWS, maxBytes = BATCH_MAX_BYTES, measure = row => row } = {}
) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const row of rows) {
    const rowSize = JSON.stringify(measure(row)).length;
    if (current.length && (current.length >= maxRows || size + rowSize > maxBytes)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += rowSize;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** @returns {string|null} Repère de récupération, avancé d’une minute de marge. */
export function pullSince(cursor) {
  // Le serveur donne des microsecondes, que tous les navigateurs ne lisent pas.
  const time = Date.parse(String(cursor ?? "").replace(/(\.\d{3})\d+/, "$1"));
  return Number.isFinite(time) ? new Date(time - PULL_MARGIN_MS).toISOString() : null;
}

/** Texte JSON aux clés triées : la base en ligne ne garde pas l’ordre des clés. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter(key => value[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Changements à appliquer sur l’appareil depuis des lignes lues en ligne. Une modification locale
 * pas encore envoyée l’emporte ; les collections inconnues et les données invalides sont ignorées.
 * @param {RemoteRow[]} rows
 * @param {{ pendingKeys: Set<string>, collections: readonly string[] }} options
 * @returns {{ saves: Array<{ collection: string, record: Object }>,
 *   removes: Array<{ collection: string, id: string }>, cursor: string|null }}
 */
export function planPulledRows(rows, { pendingKeys, collections }) {
  const saves = [];
  const removes = [];
  let cursor = null;
  for (const row of rows) {
    if (row.updated_at && (!cursor || row.updated_at > cursor)) cursor = row.updated_at;
    if (!collections.includes(row.collection) || typeof row.id !== "string") continue;
    if (pendingKeys.has(pendingKey(row.collection, row.id))) continue;
    if (row.deleted) {
      removes.push({ collection: row.collection, id: row.id });
    } else if (row.data && typeof row.data === "object" && row.data.id === row.id) {
      saves.push({ collection: row.collection, record: row.data });
    }
  }
  return { saves, removes, cursor };
}
