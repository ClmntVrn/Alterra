// Synchronisation de la base locale avec le compte en ligne. L’appareil reste la source de
// l’affichage et fonctionne hors ligne : ses modifications partent dès que possible, puis les
// nouveautés des autres appareils sont récupérées.

import { PERSONAL_DATA_COLLECTIONS } from "../domain/backup-format.js";
import {
  PULL_PAGE_SIZE,
  chunkRows,
  planPulledRows,
  pullSince,
  toRemoteRow
} from "../domain/sync.js";
import { SyncError } from "./supabase.js";

const REFRESH_MARGIN_MS = 60_000;

/**
 * @typedef {Object} SyncStatus
 * @property {boolean} connected Une session est ouverte sur cet appareil.
 * @property {string} email
 * @property {boolean} syncing
 * @property {number} pending Modifications pas encore envoyées.
 * @property {string|null} lastSyncAt Fin de la dernière synchronisation réussie.
 * @property {string} error Message de la dernière erreur, vide si tout va bien.
 * @property {boolean} offline La dernière tentative a échoué faute de réseau.
 */

/**
 * @param {Object} options
 * @param {Object} options.adapter Adaptateur IndexedDB (file, état, application des changements).
 * @param {ReturnType<typeof import("./supabase.js").createSupabaseClient>} options.client
 * @param {() => void} [options.onRemoteChange] Appelé quand des données d’un autre appareil arrivent.
 * @param {(status: SyncStatus) => void} [options.onStatus]
 * @param {() => number} [options.now]
 */
export function createSync({ adapter, client, onRemoteChange, onStatus, now = Date.now }) {
  let running = null;
  let again = false;
  let syncing = false;
  let lastError = null;

  async function report() {
    const [state, pending] = await Promise.all([adapter.getSyncState(), adapter.listPending()]);
    /** @type {SyncStatus} */
    const status = {
      connected: Boolean(state.session),
      email: state.session?.user.email || state.email || "",
      syncing,
      pending: pending.length,
      lastSyncAt: state.lastSyncAt || null,
      error: lastError?.message || "",
      offline: Boolean(lastError?.offline)
    };
    onStatus?.(status);
    return status;
  }

  async function updateState(changes) {
    const state = await adapter.getSyncState();
    const next = { ...state, ...changes };
    await adapter.saveSyncState(next);
    return next;
  }

  /** Jeton valable, renouvelé s’il expire bientôt ; session fermée si le renouvellement est refusé. */
  async function getToken({ forceRefresh = false } = {}) {
    const state = await adapter.getSyncState();
    if (!state.session) throw new SyncError("Connecte-toi pour synchroniser.");
    if (!forceRefresh && state.session.expiresAt - REFRESH_MARGIN_MS > now()) {
      return state.session.accessToken;
    }
    try {
      const session = await client.refresh(state.session.refreshToken);
      await updateState({ session });
      return session.accessToken;
    } catch (error) {
      if (!error.offline && error.status >= 400 && error.status < 500) {
        await updateState({ session: null });
        throw new SyncError("Session expirée : reconnecte-toi.", { status: error.status });
      }
      throw error;
    }
  }

  /** Exécute une requête authentifiée, avec un renouvellement du jeton en cas de refus. */
  async function withToken(call) {
    try {
      return await call(await getToken());
    } catch (error) {
      if (error.status !== 401) throw error;
      return call(await getToken({ forceRefresh: true }));
    }
  }

  async function push(userId) {
    const pending = await adapter.listPending();
    if (!pending.length) return;
    const rows = [];
    for (const change of pending) {
      const record = change.deleted ? null : await adapter.get(change.collection, change.id);
      rows.push({ change, row: toRemoteRow(change, record, userId) });
    }
    for (const chunk of chunkRows(rows, { measure: item => item.row })) {
      await withToken(token =>
        client.upsert(
          token,
          chunk.map(item => item.row)
        )
      );
      await adapter.clearPending(chunk.map(item => item.change));
    }
  }

  async function pull(cursor) {
    const since = pullSince(cursor);
    let nextCursor = cursor || null;
    let changed = 0;
    for (let offset = 0; ; offset += PULL_PAGE_SIZE) {
      const rows = await withToken(token => client.pull(token, since, { offset }));
      const pendingKeys = new Set((await adapter.listPending()).map(change => change.key));
      const plan = planPulledRows(rows, { pendingKeys, collections: PERSONAL_DATA_COLLECTIONS });
      changed += await adapter.applyRemote(plan);
      if (plan.cursor && (!nextCursor || plan.cursor > nextCursor)) nextCursor = plan.cursor;
      if (rows.length < PULL_PAGE_SIZE) break;
    }
    return { cursor: nextCursor, changed };
  }

  async function runSync() {
    const state = await adapter.getSyncState();
    if (!state.session) return;
    syncing = true;
    await report();
    try {
      // Premier passage de ce compte sur l’appareil : tout ce qui est ici part en ligne.
      if (!state.initialPushDone) {
        await adapter.enqueueAll();
        await updateState({ initialPushDone: true });
      }
      await push(state.session.user.id);
      const { cursor, changed } = await pull(state.cursor);
      await updateState({ cursor, lastSyncAt: new Date(now()).toISOString() });
      lastError = null;
      if (changed) onRemoteChange?.();
    } catch (error) {
      lastError =
        error instanceof SyncError
          ? error
          : new SyncError(error.message, { status: error.status, offline: error.offline });
      if (!lastError.offline) console.error("Synchronisation :", error);
    } finally {
      syncing = false;
      await report();
    }
  }

  /** Lance une synchronisation ; un appel pendant qu’elle tourne en relance une à la fin. */
  function sync() {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await runSync();
      } while (again);
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return Object.freeze({
    sync,
    status: report,

    /**
     * Ouvre la session. Un autre compte que le précédent repart de zéro : les données de l’appareil
     * lui sont envoyées.
     */
    async signIn(email, password) {
      const session = await client.signIn(email.trim(), password);
      const state = await adapter.getSyncState();
      const sameUser = state.userId === session.user.id;
      await adapter.saveSyncState({
        ...(sameUser ? state : {}),
        session,
        userId: session.user.id,
        email: session.user.email
      });
      lastError = null;
      await sync();
      return report();
    },

    /** Ferme la session ; les données restent sur l’appareil. */
    async signOut() {
      const state = await adapter.getSyncState();
      if (state.session) {
        await client.signOut(state.session.accessToken).catch(() => {});
      }
      await updateState({ session: null });
      lastError = null;
      return report();
    },

    async changePassword(password) {
      await withToken(token => client.updatePassword(token, password));
    },

    recover(email, redirectTo) {
      return client.recover(email.trim(), redirectTo);
    },

    /** Nouveau mot de passe depuis le lien reçu par e-mail (jeton de réinitialisation). */
    async completeRecovery(accessToken, password) {
      await client.updatePassword(accessToken, password);
      return client.getUser(accessToken);
    },

    /** Supprime le compte et toutes ses données en ligne ; l’appareil garde les siennes. */
    async deleteAccount() {
      await withToken(token => client.deleteAccount(token));
      await adapter.saveSyncState({});
      lastError = null;
      return report();
    }
  });
}
