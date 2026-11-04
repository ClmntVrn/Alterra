// Client minimal de Supabase (connexion et table `records`), par simples requêtes HTTP.

import { PULL_PAGE_SIZE } from "../domain/sync.js";

/**
 * @typedef {{ accessToken: string, refreshToken: string, expiresAt: number,
 *   user: { id: string, email: string } }} Session
 */

/** Erreur lisible ; `offline` quand le réseau manque, `status` pour une réponse du serveur. */
export class SyncError extends Error {
  constructor(message, { status = 0, code = "", offline = false, cause } = {}) {
    super(message, { cause });
    this.name = "SyncError";
    this.status = status;
    this.code = code;
    this.offline = offline;
  }
}

const MESSAGES = Object.freeze({
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed: "Adresse e-mail pas encore confirmée.",
  weak_password: "Mot de passe trop faible : 8 caractères au moins.",
  same_password: "Le nouveau mot de passe doit être différent de l’ancien.",
  over_email_send_rate_limit: "Trop d’e-mails envoyés : réessaie dans une heure.",
  over_request_rate_limit: "Trop de tentatives : réessaie dans quelques minutes."
});

function toSession(body, now) {
  if (!body?.access_token || !body?.refresh_token || !body?.user?.id) {
    throw new SyncError("Réponse de connexion inattendue.");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now() + Number(body.expires_in || 3600) * 1000,
    user: { id: body.user.id, email: body.user.email || "" }
  };
}

/**
 * @param {{ url: string, key: string, fetch?: typeof fetch, now?: () => number }} options
 */
export function createSupabaseClient({ url, key, fetch: fetchImpl, now = Date.now }) {
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  async function request(path, { method = "GET", body, token, headers = {} } = {}) {
    let response;
    try {
      response = await doFetch(`${url}${path}`, {
        method,
        headers: {
          apikey: key,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (error) {
      throw new SyncError("Pas de connexion à Internet.", { offline: true, cause: error });
    }
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const code = data?.error_code || data?.code || data?.error || "";
      const message =
        MESSAGES[code] ||
        (response.status === 401 || response.status === 403
          ? "Session expirée : reconnecte-toi."
          : `Le serveur a répondu ${response.status}. Réessaie plus tard.`);
      throw new SyncError(message, { status: response.status, code });
    }
    return data;
  }

  return Object.freeze({
    /** @returns {Promise<Session>} */
    async signIn(email, password) {
      const body = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email, password }
      });
      return toSession(body, now);
    },

    /** @returns {Promise<Session>} */
    async refresh(refreshToken) {
      const body = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: refreshToken }
      });
      return toSession(body, now);
    },

    signOut(token) {
      return request("/auth/v1/logout", { method: "POST", token });
    },

    updatePassword(token, password) {
      return request("/auth/v1/user", { method: "PUT", token, body: { password } });
    },

    /** Envoie l’e-mail de réinitialisation ; son lien ramène à `redirectTo`. */
    recover(email, redirectTo) {
      return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        body: { email }
      });
    },

    /** Lit l’utilisateur d’un jeton (lien de réinitialisation). */
    async getUser(token) {
      const user = await request("/auth/v1/user", { token });
      return { id: user.id, email: user.email || "" };
    },

    /**
     * Lignes modifiées après `since` (toutes si null), par pages, de la plus ancienne.
     * @returns {Promise<import("../domain/sync.js").RemoteRow[]>}
     */
    pull(token, since, { offset = 0, limit = PULL_PAGE_SIZE } = {}) {
      const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : "";
      return request(
        `/rest/v1/records?select=collection,id,data,deleted,updated_at` +
          `&order=updated_at.asc,collection.asc,id.asc&limit=${limit}&offset=${offset}${filter}`,
        { token }
      );
    },

    /** Ajoute ou remplace des lignes ; la base ignore celles plus anciennes qu’en ligne. */
    upsert(token, rows) {
      return request("/rest/v1/records?on_conflict=user_id,collection,id", {
        method: "POST",
        token,
        body: rows,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
      });
    },

    deleteAccount(token) {
      return request("/rest/v1/rpc/delete_my_account", { method: "POST", token, body: {} });
    }
  });
}
