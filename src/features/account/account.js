// Accès réservé et compte : écran de connexion tant qu’aucune session n’est ouverte, puis dans le
// Profil l’état de la synchronisation, le changement de mot de passe, la déconnexion et la
// suppression du compte en ligne. Le mot de passe oublié se règle depuis l’écran de connexion.

const MIN_PASSWORD_LENGTH = 8;
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « Synchronisé à 14:32 », « Synchronisé le 3 nov. à 14:32 », avec les envois en attente. */
export function describeSyncStatus(status, today = new Date()) {
  const pending = status.pending
    ? `${status.pending} modification${status.pending > 1 ? "s" : ""} en attente`
    : "";
  if (status.syncing) return "Synchronisation…";
  if (status.offline) return ["Hors ligne", pending].filter(Boolean).join(" : ") + ".";
  if (status.error) return status.error;
  const last = status.lastSyncAt ? new Date(status.lastSyncAt) : null;
  if (!last || Number.isNaN(last.getTime())) return pending ? `${pending}.` : "";
  const sameDay = last.toDateString() === today.toDateString();
  const when = sameDay
    ? `à ${timeFormatter.format(last)}`
    : `le ${dayFormatter.format(last)} à ${timeFormatter.format(last)}`;
  return `Synchronisé ${when}${pending ? ` · ${pending}` : ""}.`;
}

/**
 * @param {Object} options
 * @param {Document | HTMLElement} options.root Contient l’écran de connexion et le compte du Profil.
 * @param {ReturnType<typeof import("../../storage/sync.js").createSync>} options.sync
 * @param {string} options.recoveryUrl Page où ramène l’e-mail de réinitialisation.
 */
export function createAccountView({ root, sync, recoveryUrl }) {
  const signInView = root.querySelector("#viewSignIn");
  const signInForm = root.querySelector("#accountSignIn");
  const signInMessage = root.querySelector("#accountSignInStatus");
  const signedIn = root.querySelector("#accountSignedIn");
  const email = root.querySelector("#accountEmail");
  const syncStatus = root.querySelector("#accountSyncStatus");
  const passwordForm = root.querySelector("#accountPasswordForm");
  const recovery = root.querySelector("#accountRecovery");
  const profileMessage = root.querySelector("#accountStatus");
  let current = null;
  let recoveryToken = "";

  /** Message sur l’écran affiché : connexion sans session, Profil sinon. */
  function say(text, isError = false) {
    const message = current?.connected ? profileMessage : signInMessage;
    for (const other of [profileMessage, signInMessage]) {
      if (other !== message) other.textContent = "";
    }
    message.textContent = text;
    if (isError) message.dataset.state = "error";
    else delete message.dataset.state;
  }

  /** Désactive les boutons pendant une action et affiche son erreur éventuelle. */
  async function run(scope, action) {
    const buttons = scope.querySelectorAll("button");
    buttons.forEach(button => (button.disabled = true));
    try {
      await action();
    } catch (error) {
      say(error.message || "L’opération a échoué. Réessaie.", true);
    } finally {
      buttons.forEach(button => (button.disabled = false));
    }
  }

  function checkPassword(field) {
    field.setCustomValidity(
      field.value.length < MIN_PASSWORD_LENGTH
        ? `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
        : ""
    );
    return field.form.reportValidity();
  }

  signInForm.addEventListener("submit", event => {
    event.preventDefault();
    run(signInForm, async () => {
      say("Connexion…");
      const fields = signInForm.elements;
      await sync.signIn(fields.namedItem("email").value, fields.namedItem("password").value);
      signInForm.reset();
      say("");
    });
  });

  root.querySelector("#accountForgot").addEventListener("click", () => {
    const field = signInForm.elements.namedItem("email");
    if (!field.value.trim() || !field.checkValidity()) {
      field.setCustomValidity("Saisis ton e-mail pour recevoir le lien.");
      field.reportValidity();
      field.setCustomValidity("");
      return;
    }
    run(signInForm, async () => {
      await sync.recover(field.value, recoveryUrl);
      say("E-mail envoyé : ouvre son lien pour choisir un nouveau mot de passe.");
    });
  });

  root.querySelector("#accountSyncNow").addEventListener("click", () => {
    say("");
    sync.sync();
  });

  root.querySelector("#accountChangePassword").addEventListener("click", () => {
    passwordForm.hidden = false;
    passwordForm.elements.namedItem("password").focus();
  });
  passwordForm.addEventListener("submit", event => {
    event.preventDefault();
    const field = passwordForm.elements.namedItem("password");
    if (!checkPassword(field)) return;
    run(passwordForm, async () => {
      await sync.changePassword(field.value);
      passwordForm.reset();
      passwordForm.hidden = true;
      say("Mot de passe changé.");
    });
  });
  passwordForm.querySelector(".account-cancel").addEventListener("click", () => {
    passwordForm.reset();
    passwordForm.hidden = true;
  });

  root.querySelector("#accountSignOut").addEventListener("click", () => {
    const pending = current?.pending
      ? `\n\n${current.pending} modification${current.pending > 1 ? "s" : ""} pas encore envoyée${current.pending > 1 ? "s" : ""} partira à la prochaine connexion.`
      : "";
    if (
      !window.confirm(
        `Se déconnecter ? L’écran de connexion s’affichera ; les données restent sur cet appareil.${pending}`
      )
    )
      return;
    run(signedIn, async () => {
      await sync.signOut();
      say("Déconnecté.");
    });
  });

  root.querySelector("#accountDelete").addEventListener("click", () => {
    if (
      !window.confirm(
        "Supprimer ton compte et toutes tes données en ligne ? Les données de cet appareil sont gardées. C’est définitif."
      )
    ) {
      return;
    }
    run(signedIn, async () => {
      await sync.deleteAccount();
      say("Compte et données en ligne supprimés.");
    });
  });

  recovery.querySelector("form").addEventListener("submit", event => {
    const field = recovery.querySelector('[name="password"]');
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    if (!checkPassword(field)) return;
    run(recovery, async () => {
      const user = await sync.completeRecovery(recoveryToken, field.value);
      recovery.close();
      signInForm.elements.namedItem("email").value = user.email;
      say("Nouveau mot de passe enregistré : connecte-toi avec lui.");
    });
  });

  return {
    /** @param {import("../../storage/sync.js").SyncStatus} status */
    render(status) {
      const wasConnected = current?.connected;
      current = status;
      document.body.classList.remove("is-auth-pending");
      document.body.classList.toggle("is-signed-out", !status.connected);
      signInView.hidden = status.connected;
      // Juste après la connexion : l’Accueil, quel que soit l’onglet de l’adresse (#profil…).
      if (status.connected && wasConnected === false) {
        if (!["", "#accueil"].includes(location.hash)) {
          history.replaceState(null, "", "#accueil");
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      email.textContent = status.email;
      syncStatus.textContent = describeSyncStatus(status);
      syncStatus.dataset.state = status.error && !status.offline ? "error" : "";
      // Session fermée par le serveur : le message reste visible sur l’écran de connexion.
      if (!status.connected && status.error) say(status.error, true);
    },

    /** Ouvre le choix d’un nouveau mot de passe, depuis le lien de l’e-mail. */
    openRecovery(token) {
      recoveryToken = token;
      recovery.showModal();
    },

    showMessage: say
  };
}
