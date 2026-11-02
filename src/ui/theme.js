// Thème choisi dans le Profil, appliqué dès le <head> pour éviter un éclair de l’autre thème.
// Sans choix enregistré, le thème suit l’iPhone (prefers-color-scheme, voir tokens.css).
// Script classique, chargé de façon synchrone après les feuilles de style.

(() => {
  const root = document.documentElement;
  try {
    const theme = localStorage.getItem("alterra-theme");
    if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  } catch {
    // Stockage indisponible : le thème du système s’applique.
  }
  // La barre du navigateur prend la couleur du fond, y compris pour un thème forcé.
  if (root.dataset.theme) {
    const background = getComputedStyle(root).getPropertyValue("--color-stone").trim();
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.dataset.color = meta.content;
      meta.content = background;
    }
  }
})();
