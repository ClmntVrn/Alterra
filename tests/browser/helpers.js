// Actions communes aux tests navigateur.

/** Clé AAAA-MM-JJ du jour, dans le fuseau du navigateur. */
export function todayKey(page) {
  return page.evaluate(() => {
    const today = new Date();
    const pad = value => String(value).padStart(2, "0");
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  });
}

/** Enregistre des données par le stockage de l’application (la page doit être celle du site). */
export function saveRecords(page, collection, records) {
  return page.evaluate(
    async (collection, records) => {
      const { createPersonalDataStore } = await import("/src/storage/personal-data.js");
      const { repository } = createPersonalDataStore();
      for (const record of records) await repository.save(collection, record);
    },
    collection,
    records
  );
}

const pagesWithServer = new WeakSet();

/**
 * Serveur Supabase par défaut des tests : la connexion accepte tout, le reste échoue comme hors
 * ligne. Aucune requête ne sort ; les confirmations sont acceptées.
 */
function offlineServer() {
  const realFetch = window.fetch.bind(window);
  window.confirm = () => true;
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (!url.hostname.endsWith(".supabase.co")) return realFetch(input, options);
    if (url.pathname === "/auth/v1/token") {
      return new Response(
        JSON.stringify({
          access_token: "jeton-test",
          refresh_token: "renouvellement-test",
          expires_in: 3600,
          user: { id: "u-test", email: "test@exemple.fr" }
        })
      );
    }
    throw new TypeError("Load failed");
  };
}

/**
 * Installe un faux serveur Supabase avant tout script de la page, pour toute la durée du test.
 * @param {Function} [server] Fonction exécutée dans la page avant ses scripts.
 */
export async function installServer(page, server = offlineServer) {
  if (pagesWithServer.has(page)) return;
  pagesWithServer.add(page);
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${server})();` });
}

/** Se connecte depuis l’écran de connexion affiché. */
export function signIn(page, email = "test@exemple.fr", password = "motdepasse1") {
  return page.evaluate(
    (email, password) => {
      const form = document.getElementById("accountSignIn");
      form.elements.namedItem("email").value = email;
      form.elements.namedItem("password").value = password;
      form.requestSubmit();
    },
    email,
    password
  );
}

/**
 * Ouvre l’accueil et attend l’affichage du calendrier et des événements enregistrés. Sans session,
 * se connecte d’abord (faux serveur) ; `signIn: false` s’arrête sur l’écran de connexion.
 */
export async function openHome(page, { signIn: shouldSignIn = true } = {}) {
  await installServer(page);
  await page.goto("/index.html");
  const screen = await page.waitFor(
    () =>
      !document.body.classList.contains("is-auth-pending") &&
      (document.body.classList.contains("is-signed-out") ? "signIn" : "app"),
    { message: "Ni l’application ni l’écran de connexion ne se sont affichés." }
  );
  if (screen === "signIn") {
    if (!shouldSignIn) return;
    await signIn(page);
    await page.waitFor(() => !document.body.classList.contains("is-signed-out"), {
      message: "La connexion de test a échoué."
    });
  }
  await page.waitFor(
    () =>
      document.querySelectorAll(".calendar-day").length > 0 &&
      !document.getElementById("personalDataLastBackup").hidden,
    { message: "L’accueil ne s’est pas affiché." }
  );
}

/** Affiche la journée du jour dans le calendrier. */
export function openToday(page) {
  return page.evaluate(() =>
    document.querySelector(".calendar-day.is-today .calendar-date-button").click()
  );
}

/** Contenu brut de la base locale : version, collections et enregistrements. */
export function readDatabase(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("alterra-personal-data");
        request.onsuccess = () => {
          const database = request.result;
          const stores = [...database.objectStoreNames];
          const result = { version: database.version, stores, data: {} };
          const transaction = database.transaction(stores, "readonly");
          for (const store of stores) {
            transaction.objectStore(store).getAll().onsuccess = event => {
              result.data[store] = event.target.result;
            };
          }
          transaction.oncomplete = () => {
            database.close();
            resolve(result);
          };
        };
        request.onerror = () => reject(request.error);
      })
  );
}
