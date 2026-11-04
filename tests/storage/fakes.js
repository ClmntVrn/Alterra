// Doublures pour tester la synchronisation sans navigateur ni réseau : un appareil en mémoire
// (même interface que l’adaptateur IndexedDB) et un serveur Supabase en mémoire.

import { createPendingChange, pendingKey, stableStringify } from "../../src/domain/sync.js";

/** Horloge contrôlée : chaque lecture avance d’une seconde. */
export function createClock(start = Date.parse("2026-11-04T08:00:00.000Z")) {
  let time = start;
  return () => (time += 1000);
}

export function createMemoryDevice(clock) {
  const stores = new Map();
  const queue = new Map();
  let syncState = {};
  const store = collection => {
    if (!stores.has(collection)) stores.set(collection, new Map());
    return stores.get(collection);
  };
  const enqueue = (collection, id, deleted) =>
    queue.set(
      pendingKey(collection, id),
      createPendingChange(collection, id, { deleted, changedAt: new Date(clock()).toISOString() })
    );
  const copy = value => structuredClone(value);

  return {
    async list(collection) {
      return [...store(collection).values()].map(copy);
    },
    async get(collection, id) {
      return copy(store(collection).get(id) ?? null);
    },
    async save(collection, record) {
      store(collection).set(record.id, copy(record));
      enqueue(collection, record.id, false);
    },
    async remove(collection, id) {
      if (!store(collection).delete(id)) return false;
      enqueue(collection, id, true);
      return true;
    },
    async listPending() {
      return [...queue.values()].map(copy);
    },
    async enqueueAll() {
      for (const [collection, records] of stores) {
        for (const id of records.keys()) enqueue(collection, id, false);
      }
    },
    async clearPending(changes) {
      for (const change of changes) {
        if (queue.get(change.key)?.changedAt === change.changedAt) queue.delete(change.key);
      }
    },
    async applyRemote({ saves, removes }) {
      let changed = 0;
      for (const { collection, record } of saves) {
        if (queue.has(pendingKey(collection, record.id))) continue;
        if (stableStringify(store(collection).get(record.id)) === stableStringify(record)) continue;
        store(collection).set(record.id, copy(record));
        changed += 1;
      }
      for (const { collection, id } of removes) {
        if (queue.has(pendingKey(collection, id))) continue;
        if (store(collection).delete(id)) changed += 1;
      }
      return changed;
    },
    async getSyncState() {
      return copy(syncState);
    },
    async saveSyncState(value) {
      syncState = copy(value);
    }
  };
}

/**
 * Serveur Supabase en mémoire, avec les mêmes règles que supabase/schema.sql : chaque compte ne voit
 * que ses lignes, une modification plus ancienne que celle en ligne est ignorée.
 */
export function createMemoryServer(clock, users = { "a@test.fr": "secret-a" }) {
  const rows = new Map();
  const tokens = new Map();
  let failNext = null;
  let tokenCount = 0;
  const userIds = Object.fromEntries(
    Object.keys(users).map((email, index) => [email, `u${index + 1}`])
  );

  function issue(email) {
    tokenCount += 1;
    const accessToken = `access-${tokenCount}`;
    tokens.set(accessToken, email);
    return {
      accessToken,
      refreshToken: `refresh-${email}`,
      expiresAt: clock() + 3600_000,
      user: { id: userIds[email], email }
    };
  }
  function userOf(token) {
    if (failNext) {
      const error = failNext;
      failNext = null;
      throw error;
    }
    const email = tokens.get(token);
    if (!email) throw Object.assign(new Error("Session expirée"), { status: 401 });
    return userIds[email];
  }

  return {
    rows,
    /** Fait échouer la prochaine requête authentifiée. */
    failOnce(error) {
      failNext = error;
    },
    expireTokens() {
      tokens.clear();
    },
    client: {
      async signIn(email, password) {
        if (users[email] !== password) {
          throw Object.assign(new Error("E-mail ou mot de passe incorrect."), { status: 400 });
        }
        return issue(email);
      },
      async refresh(refreshToken) {
        const email = refreshToken.replace("refresh-", "");
        if (!users[email]) throw Object.assign(new Error("Refusé"), { status: 400 });
        return issue(email);
      },
      async signOut(token) {
        tokens.delete(token);
      },
      async updatePassword(token, password) {
        const userId = userOf(token);
        const email = Object.keys(userIds).find(key => userIds[key] === userId);
        users[email] = password;
      },
      async pull(token, since, { offset = 0, limit = 500 } = {}) {
        const userId = userOf(token);
        return [...rows.values()]
          .filter(row => row.user_id === userId && (!since || row.updated_at > since))
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
          .slice(offset, offset + limit)
          .map(({ collection, id, data, deleted, updated_at }) =>
            structuredClone({ collection, id, data, deleted, updated_at })
          );
      },
      async upsert(token, batch) {
        const userId = userOf(token);
        for (const row of batch) {
          if (row.user_id !== userId) throw Object.assign(new Error("RLS"), { status: 403 });
          const key = `${userId}/${row.collection}/${row.id}`;
          const existing = rows.get(key);
          if (existing && row.modified_at < existing.modified_at) continue;
          rows.set(key, { ...structuredClone(row), updated_at: new Date(clock()).toISOString() });
        }
      },
      async deleteAccount(token) {
        const userId = userOf(token);
        for (const [key, row] of rows) if (row.user_id === userId) rows.delete(key);
      }
    }
  };
}
