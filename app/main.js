import { initializeCalendar } from "./calendar.js";
import { createPersonalDataStore } from "./personal-data.js";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("Service worker:", error));
  });
}

initializeCalendar();

const exportButton = document.getElementById("exportPersonalData");
const importButton = document.getElementById("importPersonalData");
const importInput = document.getElementById("personalDataFile");
const status = document.getElementById("personalDataStatus");
const personalData = createPersonalDataStore();

function showPersonalDataStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? "error" : "success";
}

exportButton.addEventListener("click", async () => {
  exportButton.disabled = true;
  showPersonalDataStatus("Préparation de la sauvegarde…");
  try {
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
    showPersonalDataStatus("Sauvegarde téléchargée. Garde ce fichier en lieu sûr.");
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
    if (!window.confirm("Cette restauration remplacera toutes les données Alterra enregistrées sur cet appareil. Continuer ?")) {
      return;
    }
    await personalData.restore(data);
    showPersonalDataStatus("Sauvegarde restaurée sur cet appareil.");
  } catch (error) {
    console.error("Échec de la restauration des données personnelles.", error);
    showPersonalDataStatus(`Restauration impossible : ${error.message}`, true);
  } finally {
    importInput.value = "";
    importButton.disabled = false;
  }
});
