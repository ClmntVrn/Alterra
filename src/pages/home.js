import { createAccountView } from "../features/account/account.js";
import { initializeCalendar } from "../features/calendar/calendar.js";
import { createObjectivesView } from "../features/objectives/objectives.js";
import { initializeActivityStatistics } from "../features/statistics/activity-statistics.js";
import { initializePeriodStatistics } from "../features/statistics/period-statistics.js";
import { createPersonalDataStore } from "../storage/personal-data.js";
import { loadRaceCatalog } from "../storage/race-catalog.js";
import { createSupabaseClient } from "../storage/supabase.js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../storage/supabase-config.js";
import { createSync } from "../storage/sync.js";
import { PERSONAL_DATA_COLLECTIONS } from "../domain/backup-format.js";
import { daysBetween } from "../domain/dates.js";
import { listRaceResultsAsWorkouts } from "../domain/statistics.js";
import { formatDaysAgo } from "../ui/format.js";
import { initializeTabBar } from "../ui/tab-bar.js";
import { initializeThemeToggle } from "../ui/theme-toggle.js";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => console.error("Service worker:", error));
  });
}

if (navigator.storage?.persist) {
  navigator.storage
    .persisted()
    .then(persisted => persisted || navigator.storage.persist())
    .catch(error => console.warn("Stockage persistant :", error));
}

const BACKUP_REMINDER_DAYS = 7;
const exportButton = document.getElementById("exportPersonalData");
const importButton = document.getElementById("importPersonalData");
const importInput = document.getElementById("personalDataFile");
const importChoice = document.getElementById("importChoice");
const status = document.getElementById("personalDataStatus");
const lastBackup = document.getElementById("personalDataLastBackup");
const profileBadges = ["profileBadge", "profileBadgeText"].map(id => document.getElementById(id));
const SYNC_DELAY_MS = 1500;

// Lien de réinitialisation du mot de passe : Supabase ramène ici avec le jeton dans l’ancre, qu’on
// retire aussitôt de l’adresse.
const authParams = new URLSearchParams(location.hash.slice(1));
const recoveryToken =
  authParams.get("type") === "recovery" ? authParams.get("access_token") || "" : "";
const authError = authParams.get("error_description") || "";
if (recoveryToken || authError) history.replaceState(null, "", `${location.pathname}#profil`);

initializeTabBar(document.querySelector(".tab-bar"));
initializeThemeToggle(document.getElementById("themeToggle"));
const personalData = createPersonalDataStore();
let raceCatalogPromise = loadRaceCatalog(personalData);
const updateActivityStatistics = initializeActivityStatistics(
  document.getElementById("activityStatistics")
);
const updatePeriodStatistics = initializePeriodStatistics(document.getElementById("viewStats"));
const renderObjectives = createObjectivesView({
  container: document.getElementById("objectivesList"),
  onEditPersonalRace: race => calendar.openPersonalRace(race),
  onEditResult: race => calendar.openRaceResult(race)
});
const calendar = initializeCalendar(raceCatalogPromise, personalData.repository, sources => {
  // Une course validée compte comme une sortie réalisée.
  const activities = [
    ...sources.workouts,
    ...listRaceResultsAsWorkouts([...sources.races, ...sources.personalRaces])
  ];
  updateActivityStatistics(activities);
  updatePeriodStatistics(activities);
  renderObjectives(sources);
});
document
  .getElementById("addObjectiveRace")
  .addEventListener("click", () => calendar.openPersonalRace());

/** @type {import("../storage/sync.js").SyncStatus | null} */
let syncStatus = null;
const sync = createSync({
  adapter: personalData.syncAdapter,
  client: createSupabaseClient({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY }),
  onRemoteChange: () =>
    refreshFromRemote().catch(error => console.error("Affichage des données reçues :", error)),
  onStatus: status => {
    syncStatus = status;
    account.render(status);
    refreshLastBackup();
  }
});
const account = createAccountView({
  container: document.getElementById("account"),
  sync,
  beforeFirstSignIn,
  recoveryUrl: `${location.origin}${location.pathname}`
});

/** Données venues d’un autre appareil : fiches et calendrier relus. */
async function refreshFromRemote() {
  raceCatalogPromise = loadRaceCatalog(personalData);
  await raceCatalogPromise;
  await calendar.refresh();
}

/**
 * Première connexion sur cet appareil avec des données : elles vont partir sur le compte, une
 * sauvegarde de secours est d’abord téléchargée. Renvoie false si la personne renonce.
 */
async function beforeFirstSignIn() {
  if ((await personalData.syncAdapter.getSyncState()).userId) return true;
  const data = await personalData.exportAll();
  const hasData = PERSONAL_DATA_COLLECTIONS.some(collection => data[collection].length);
  if (!hasData) return true;
  if (
    !window.confirm(
      "Première connexion sur cet appareil : ses données vont être ajoutées à ton compte. Une sauvegarde de secours va d’abord être téléchargée. Continuer ?"
    )
  ) {
    return false;
  }
  await exportBackup();
  return true;
}

let syncTimer = 0;
personalData.onLocalChange(() => {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => sync.sync(), SYNC_DELAY_MS);
});
window.addEventListener("online", () => sync.sync());
sync
  .status()
  .then(() => sync.sync())
  .catch(error => console.error("Synchronisation :", error));
if (recoveryToken) account.openRecovery(recoveryToken);
if (authError) account.showMessage(`Lien refusé : ${authError}`, true);

/** Demande fusion ou remplacement ; renvoie 'merge', 'replace' ou 'cancel'. */
function askImportMode() {
  importChoice.returnValue = "cancel";
  importChoice.showModal();
  return new Promise(resolve =>
    importChoice.addEventListener("close", () => resolve(importChoice.returnValue), { once: true })
  );
}

function showPersonalDataStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? "error" : "success";
}

async function showLastBackup() {
  const { lastBackupAt } = await personalData.getSettings();
  const backupDate = lastBackupAt ? new Date(lastBackupAt) : null;
  if (!backupDate || Number.isNaN(backupDate.getTime())) {
    lastBackup.textContent = "Aucune sauvegarde exportée depuis cet appareil.";
    lastBackup.dataset.state = "stale";
  } else {
    const days = Math.max(0, daysBetween(backupDate, new Date()));
    lastBackup.textContent = `Dernière sauvegarde : ${formatDaysAgo(days)}.`;
    lastBackup.dataset.state = days >= BACKUP_REMINDER_DAYS ? "stale" : "recent";
  }
  // Synchronisé récemment : les données sont aussi en ligne, pas besoin de rappel.
  const syncedAt =
    syncStatus?.connected && syncStatus.lastSyncAt && new Date(syncStatus.lastSyncAt);
  if (syncedAt && daysBetween(syncedAt, new Date()) < BACKUP_REMINDER_DAYS) {
    lastBackup.dataset.state = "recent";
  }
  lastBackup.hidden = false;
  // Le rappel est dans Profil : une pastille sur l’onglet le signale depuis les autres vues.
  for (const badge of profileBadges) badge.hidden = lastBackup.dataset.state !== "stale";
}

function refreshLastBackup() {
  showLastBackup().catch(error => console.error("Date de la dernière sauvegarde :", error));
}

refreshLastBackup();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  refreshLastBackup();
  sync.sync();
});

/** Télécharge la base complète et note la date de cette sauvegarde. */
async function exportBackup() {
  await raceCatalogPromise;
  const data = await personalData.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alterra-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  await personalData.recordBackup(data.settings.lastBackupAt);
  refreshLastBackup();
}

exportButton.addEventListener("click", async () => {
  exportButton.disabled = true;
  showPersonalDataStatus("Préparation de la sauvegarde…");
  try {
    await exportBackup();
    showPersonalDataStatus("Base complète exportée. Garde ce fichier en lieu sûr.");
  } catch (error) {
    console.error("Échec de la sauvegarde des données personnelles.", error);
    showPersonalDataStatus("La sauvegarde a échoué. Vérifie le stockage de cet appareil.", true);
  } finally {
    exportButton.disabled = false;
  }
});

importButton.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
  const [file] = importInput.files || [];
  if (!file) return;
  importButton.disabled = true;
  try {
    const data = JSON.parse(await file.text());
    const mode = await askImportMode();
    if (mode === "cancel") return;
    await personalData.restore(data, { merge: mode === "merge" });
    raceCatalogPromise = loadRaceCatalog(personalData);
    await raceCatalogPromise;
    await calendar.refresh();
    refreshLastBackup();
    showPersonalDataStatus(
      mode === "merge"
        ? "Sauvegarde fusionnée avec les données de cet appareil."
        : "Base complète restaurée sur cet appareil."
    );
  } catch (error) {
    console.error("Échec de la restauration des données personnelles.", error);
    showPersonalDataStatus(`Restauration impossible : ${error.message}`, true);
  } finally {
    importInput.value = "";
    importButton.disabled = false;
  }
});
