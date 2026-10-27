// Barre d’onglets : affiche la vue choisie sans rechargement et garde la position de chaque vue.

/**
 * Chaque onglet actif est un lien `#nom` portant `data-view`, l’identifiant de sa vue.
 * @param {HTMLElement} bar
 */
export function initializeTabBar(bar) {
  const tabs = [...bar.querySelectorAll("a[data-view]")];
  const scrollPositions = new Map();
  let current = null;

  function show(hash) {
    const tab = tabs.find(item => item.getAttribute("href") === hash) || tabs[0];
    if (tab === current) return;
    if (current) scrollPositions.set(current, window.scrollY);
    for (const item of tabs) {
      const isActive = item === tab;
      document.getElementById(item.dataset.view).hidden = !isActive;
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    }
    current = tab;
    window.scrollTo({ top: scrollPositions.get(tab) ?? 0, behavior: "instant" });
  }

  bar.addEventListener("click", event => {
    const tab = event.target.closest("a[data-view]");
    if (!tab) return;
    event.preventDefault();
    // Toucher l’onglet affiché remonte en haut de sa vue, comme sur iPhone.
    if (tab === current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Pas d’entrée d’historique : le geste retour ne fait pas défiler les onglets.
    history.replaceState(null, "", tab.getAttribute("href"));
    show(tab.getAttribute("href"));
  });
  window.addEventListener("hashchange", () => show(location.hash));
  show(location.hash);
}
