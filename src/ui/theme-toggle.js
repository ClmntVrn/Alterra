// Bouton de thème du Profil : automatique (suit l’iPhone), clair, puis sombre.

const STORAGE_KEY = "alterra-theme";
const THEMES = Object.freeze({
  auto: "Thème : automatique, comme l’iPhone",
  light: "Thème : clair",
  dark: "Thème : sombre"
});
const NEXT = Object.freeze({ auto: "light", light: "dark", dark: "auto" });

function readTheme() {
  try {
    const theme = localStorage.getItem(STORAGE_KEY);
    return theme in THEMES && theme !== "auto" ? theme : "auto";
  } catch {
    return "auto";
  }
}

/** Applique le thème : sans attribut, prefers-color-scheme décide (tokens.css). */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Fond du thème actif pour un choix forcé ; sinon chaque balise garde sa couleur selon sa media.
  const background = getComputedStyle(root).getPropertyValue("--color-stone").trim();
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.content = theme === "auto" ? meta.dataset.color : background;
  }
}

/**
 * @param {HTMLButtonElement} button Contient une icône `[data-theme-icon]` par thème.
 */
export function initializeThemeToggle(button) {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.dataset.color ??= meta.getAttribute("content");
  }
  let theme = readTheme();

  function render() {
    for (const icon of button.querySelectorAll("[data-theme-icon]")) {
      icon.hidden = icon.dataset.themeIcon !== theme;
    }
    button.setAttribute("aria-label", THEMES[theme]);
    button.title = THEMES[theme];
  }

  button.addEventListener("click", () => {
    theme = NEXT[theme];
    try {
      if (theme === "auto") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Non enregistré : le choix vaut pour cette visite.
    }
    applyTheme(theme);
    render();
  });
  render();
}
