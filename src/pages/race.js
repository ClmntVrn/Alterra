// Fiche course : charge la fiche et le plan personnel depuis la base locale, puis assemble les blocs.

import { applyPersonalPlan, hasRequiredRaceFields } from "../domain/race-plan.js";
import { createCheckpointsSection } from "../features/race-sheet/checkpoints.js";
import { createElevationSection } from "../features/race-sheet/elevation-profile.js";
import { createGearChecklist } from "../features/race-sheet/gear-checklist.js";
import {
  renderNutrition,
  renderPersonalPlanStatus,
  renderPracticalInfo,
  renderReminders,
  renderSources
} from "../features/race-sheet/info-sections.js";
import { renderRaceHeader } from "../features/race-sheet/race-header.js";
import { createLiveSection } from "../features/race-sheet/race-live.js";
import { createPersonalDataStore } from "../storage/personal-data.js";
import { loadRaceCatalog } from "../storage/race-catalog.js";
import { el } from "../ui/dom.js";

const content = document.getElementById("raceContent");
const raceId = new URLSearchParams(location.search).get("id");
const personalData = createPersonalDataStore();

function renderRace(race, personalPlan = null, storageError = null) {
  if (!hasRequiredRaceFields(race)) {
    throw new Error("Les données principales de la course sont incomplètes.");
  }
  const displayRace = applyPersonalPlan(race, personalPlan);
  document.title = `${displayRace.name} · Alterra`;

  const elevation = displayRace.profile?.gpx ? createElevationSection(displayRace) : null;
  let live = null;
  const checkpoints = displayRace.checkpoints?.length
    ? createCheckpointsSection(displayRace, {
        onChange: () => {
          elevation?.update();
          live?.update();
        }
      })
    : null;
  live = checkpoints ? createLiveSection(displayRace, checkpoints) : null;

  content.replaceChildren(renderRaceHeader(displayRace));
  if (live) content.append(live.element);
  if (elevation) content.append(elevation.element);
  if (checkpoints) content.append(checkpoints.element);
  if (displayRace.nutrition) content.append(renderNutrition(displayRace.nutrition));
  if (displayRace.reminders?.items?.length) content.append(renderReminders(displayRace.reminders));
  // Blocs repliés, utiles avant la course : matériel, infos pratiques, sources.
  if (displayRace.gear?.groups?.length) {
    content.append(createGearChecklist(displayRace, displayRace.gear));
  }
  if (displayRace.practicalInfo?.items?.length) {
    content.append(renderPracticalInfo(displayRace.practicalInfo));
  }
  if (displayRace.sources?.length) {
    content.append(renderSources(displayRace.sources, displayRace.verifiedAt));
  }
  if (displayRace.footer)
    content.append(el("p", { className: "footer", text: displayRace.footer }));
  const planStatus = renderPersonalPlanStatus(personalPlan, storageError);
  if (planStatus) content.append(planStatus);

  elevation
    ?.load({
      isChecked: id => checkpoints?.isChecked(id) ?? false,
      toggle: id => checkpoints?.toggle(id)
    })
    .then(profile => live?.setProfile(profile));
}

function showError(message, error) {
  console.error(message, error);
  content.replaceChildren(
    el("section", { className: "section race-error" }, [
      el("h1", { text: "Fiche course indisponible" }),
      el("p", { text: message })
    ])
  );
}

async function loadRace() {
  if (!raceId) {
    showError("Aucune course n’a été sélectionnée.", new Error("Paramètre id manquant."));
    return;
  }
  try {
    const catalog = await loadRaceCatalog(personalData);
    const race = catalog.find(entry => entry.id === raceId);
    if (!race) {
      showError(
        "Cette course n’est pas dans la base de cet appareil. Importe une sauvegarde complète pour la restaurer.",
        new Error(`Course inconnue : ${raceId}.`)
      );
      return;
    }
    let personalPlan = null;
    let storageError = null;
    try {
      personalPlan = await personalData.repository.get("racePlans", race.id);
    } catch (error) {
      storageError = error;
      console.error("Impossible de lire le plan personnel sur cet appareil.", error);
    }
    renderRace(race, personalPlan, storageError);
  } catch (error) {
    showError("Vérifie ta connexion, puis réessaie depuis le calendrier.", error);
  }
}

loadRace();
