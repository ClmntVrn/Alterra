import { initializeCalendar } from "../features/calendar/calendar.js";
import { initializeActivityStatistics } from "../features/statistics/activity-statistics.js";
import { createPersonalDataStore } from "../storage/personal-data.js";
import { loadRaceCatalog } from "../storage/race-catalog.js";
import { daysBetween } from "../domain/dates.js";
import { formatDaysAgo } from "../ui/format.js";
import { initializeTabBar } from "../ui/tab-bar.js";

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
const status = document.getElementById("personalDataStatus");
const lastBackup = document.getElementById("personalDataLastBackup");
const profileBadges = ["profileBadge", "profileBadgeText"].map(id => document.getElementById(id));
initializeTabBar(document.querySelector(".tab-bar"));
const personalData = createPersonalDataStore();
let raceCatalogPromise = loadRaceCatalog(personalData);
const updateActivityStatistics = initializeActivityStatistics(
  document.getElementById("activityStatistics"),
  personalData.repository
);
const refreshCalendar = initializeCalendar(
  raceCatalogPromise,
  personalData.repository,
  updateActivityStatistics
);

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
  lastBackup.hidden = false;
  // Le rappel est dans Profil : une pastille sur l’onglet le signale depuis les autres vues.
  for (const badge of profileBadges) badge.hidden = lastBackup.dataset.state !== "stale";
}

function refreshLastBackup() {
  showLastBackup().catch(error => console.error("Date de la dernière sauvegarde :", error));
}

refreshLastBackup();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshLastBackup();
});

exportButton.addEventListener("click", async () => {
  exportButton.disabled = true;
  showPersonalDataStatus("Préparation de la sauvegarde…");
  try {
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
    if (
      !window.confirm(
        "Cette importation remplacera toutes les données Alterra de cet appareil, y compris les courses et états de checklist. Continuer ?"
      )
    ) {
      return;
    }
    await personalData.restore(data);
    raceCatalogPromise = loadRaceCatalog(personalData);
    await refreshCalendar(await raceCatalogPromise);
    refreshLastBackup();
    showPersonalDataStatus("Base complète restaurée sur cet appareil.");
  } catch (error) {
    console.error("Échec de la restauration des données personnelles.", error);
    showPersonalDataStatus(`Restauration impossible : ${error.message}`, true);
  } finally {
    importInput.value = "";
    importButton.disabled = false;
  }
});
