export async function loadRaceCatalog(personalData) {
  const saved = await personalData.repository.list("raceCatalog");
  const settings = await personalData.getSettings();
  if (settings.raceCatalogInitialized) return saved;
  if (saved.length) {
    await personalData.initializeRaceCatalog(saved);
    return saved;
  }

  await personalData.saveSettings({ ...settings, raceCatalogInitialized: true });
  return [];
}
