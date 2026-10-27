# Alterra — consignes pour Claude

PWA statique, mobile-first, de préparation au trail et à la montagne, utilisée surtout sur iPhone (y compris comme aide en course). Tout est en français : interface, documentation, messages de commit.

Documentation de référence, à lire avant une évolution fonctionnelle :

- [docs/specification.md](./docs/specification.md) — comportement attendu et règles de gestion ;
- [docs/roadmap.md](./docs/roadmap.md) — feuille de route par étapes et décisions prises ;
- [docs/architecture.md](./docs/architecture.md) — choix techniques et confidentialité.

## Expérience et style

- Interface lisible en un coup d'œil, libellés simples, pas de texte redondant ni de section superflue.
- Style outdoor : palette charbon, ardoise, pierre et orange. Pas de vert sans demande explicite.
- Aucune couleur écrite en dur hors de `styles/tokens.css` : utiliser ses variables (`var(--color-…)`, et `rgb(var(--rgb-…) / 30%)` pour une transparence).
- Conserver l'accessibilité clavier, les attributs ARIA et des repères qui ne reposent pas uniquement sur la couleur.

## Structure technique

- HTML, CSS et JavaScript natif en modules ES. Pas de framework, de bundler ni de dépendance sans besoin concret.
- Pages à la racine (`index.html`, `race.html`, `versions.html`), avec `sw.js` et `manifest.json` qui doivent y rester. `index.html` porte la barre d’onglets (Accueil · Objectifs · Stats · IA · Profil) et une vue par onglet disponible, affichée sans rechargement (`src/ui/tab-bar.js`) ; la fiche course reste une page à part, sans barre.
- `src/pages/` : points d'entrée des pages (`home.js` pour l'accueil, `race.js` pour la fiche).
- `src/features/<fonctionnalité>/` : `calendar/` (vues mois/jour), `workouts/` (carte et formulaire de séance), `races/` (cartes et formulaire de course personnelle), `objectives/` (onglet Objectifs), `race-sheet/` (blocs de la fiche course), `statistics/`. Génériques, sans donnée propre à une course. Chaque module reçoit ses éléments et ses callbacks ; pas d'état global modifiable.
- `src/domain/` : règles pures, sans DOM ni stockage, couvertes par les tests (`tests/`). `backup-format.js` porte le format de sauvegarde versionné (`PERSONAL_DATA_FORMAT_VERSION`) et sa validation.
- `src/storage/` : `repository.js` (interface stable) et `indexeddb.js` (adaptateur). Les écrans passent par le repository, jamais directement par IndexedDB. `personal-data.js` gère l'export/restauration, y compris les clés `localStorage` préfixées `alterra-`.
- `src/ui/` : `format.js` (formats d'affichage français partagés), `dom.js` (`el()` pour créer des éléments) et `tab-bar.js` (onglets).
- `race.html` + `src/pages/race.js` : fiche de course générique. Les fiches et leurs GPX (`profile.gpxData`) vivent dans la collection `raceCatalog` de la base locale et dans les sauvegardes, jamais dans le dépôt.
- `styles/` : `tokens.css` (variables), `base.css`, `layout.css`, `components/` et `features/` (un fichier par fonctionnalité). Chaque page charge par des `<link>` les seules feuilles qu'elle utilise, de la plus générale à la plus spécifique ; réutiliser les variables et composants existants. Icônes dans `assets/icons/`.
- Les blocs d'une fiche (scénarios, ravitos, nutrition, rappels, matériel, sources) sont facultatifs : ne pas coder de contenu propre à une course dans le moteur de rendu. Les identifiants des repères du profil correspondent à ceux des ravitos.

## Données et confidentialité

- Le dépôt GitHub est public : aucune donnée personnelle, donnée de course, trace GPX, sauvegarde JSON, secret ou clé d'API dans les fichiers suivis.
- Ne jamais inventer d'horaires, distances, dénivelés, ravitaillements ou conseils sportifs : ils viennent des informations fournies ou vérifiées.
- Vocabulaire : une séance est un `workout` (collection `workouts`), une course ajoutée au calendrier une `personalRace` (`personalRaces`), une fiche de référence une `raceSheet` (`raceCatalog`), un plan personnel un `racePlan` (`racePlans`).
- Toute modification du format de données doit rester compatible avec les sauvegardes existantes (formats 1, 2 et 3 acceptés, convertis par `migratePersonalData`) ou prévoir une migration ; incrémenter `DATABASE_VERSION` si le schéma IndexedDB change.
- Dates : toujours en heure locale de l'appareil, clés au format `AAAA-MM-JJ`. Recalculer la date du jour à l'affichage et au retour au premier plan.

## Livrer une nouvelle version

Quand une modification change les ressources livrées :

1. Ajouter toute nouvelle ressource à la liste `FILES` de `sw.js` (un test le vérifie).
2. Lancer `npm run release -- 0.8.17 "Ligne d'historique." "Autre ligne."` : numéro dans `package.json`, `package-lock.json` et dans le Profil de `index.html`, entrée datée dans `versions.html`, `CACHE_NAME` de `sw.js` dérivé de la version, puis `npm run check`. Ni commit ni push. Un test vérifie que la version est la même partout.
3. Mettre à jour les cases et statuts de `docs/roadmap.md`, et `docs/specification.md` si le comportement change.

## Façon de travailler

- Avancer point par point : une évolution ciblée à la fois, vérifiée, puis commitée séparément.
- Proposer un plan court avant un changement important ou une décision de conception ; ne pas trancher seul une question ouverte du plan.
- Après une modification : relire le diff et lancer `npm run check` (Prettier, ESLint, tests). `npm run format` reformate le code. Pour un changement d'interface, de stockage ou de PWA, lancer aussi `npm run test:browser` (tests dans Chrome ou Edge sans interface, `tests/browser/`, données fictives uniquement). Il n'y a pas d'étape de build : Node.js ne sert qu'aux outils de développement.
- Pour un changement d'interface ou de PWA, tester le parcours sur largeur mobile ; signaler ce qui reste à vérifier sur iPhone/Safari.
- Un commit de formatage pur est ajouté à `.git-blame-ignore-revs`.
- La CI GitHub (`.github/workflows/ci.yml`) relance `npm run check` et `npm run test:browser` à chaque push ; elle signale sans bloquer la publication.
- Ne pas réécrire l'historique Git (purge des anciennes données Mallorca comprise) sans décision explicite.

## Mise à jour de ces consignes

Tenir ce fichier à jour lorsqu'une convention ou une décision durable change, en restant concis (pas de notes de session ni de détails propres à une course). `.github/copilot-instructions.md` contient des consignes équivalentes pour Copilot : les garder cohérentes.
