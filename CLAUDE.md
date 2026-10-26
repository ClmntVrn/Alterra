# Alterra — consignes pour Claude

PWA statique, mobile-first, de préparation au trail et à la montagne, utilisée surtout sur iPhone (y compris comme aide en course). Tout est en français : interface, documentation, messages de commit.

Documentation de référence, à lire avant une évolution fonctionnelle :

- [docs/specification.md](./docs/specification.md) — comportement attendu et règles de gestion ;
- [docs/roadmap.md](./docs/roadmap.md) — feuille de route par étapes et décisions prises ;
- [docs/architecture.md](./docs/architecture.md) — choix techniques et confidentialité.

## Expérience et style

- Interface lisible en un coup d'œil, libellés simples, pas de texte redondant ni de section superflue.
- Style outdoor : palette charbon, ardoise, pierre et orange. Pas de vert sans demande explicite.
- Conserver l'accessibilité clavier, les attributs ARIA et des repères qui ne reposent pas uniquement sur la couleur.

## Structure technique

- HTML, CSS et JavaScript natif en modules ES. Pas de framework, de bundler ni de dépendance sans besoin concret.
- `index.html` : accueil (statistiques, calendrier, sauvegarde). `app/main.js` l'initialise.
- `app/calendar.js` : calendrier mois/jour, formulaires de sorties et de courses personnelles.
- `components/` : composants génériques (`calendar/`, `statistics/`), sans donnée propre à une course.
- `app/domain/models.js` : format de sauvegarde versionné (`PERSONAL_DATA_FORMAT_VERSION`) et validation.
- `app/storage/` : `repository.js` (interface stable) et `indexeddb.js` (adaptateur). Les écrans passent par le repository, jamais directement par IndexedDB.
- `app/personal-data.js` : export/restauration, y compris les clés `localStorage` préfixées `alterra-`.
- `races/race.html` + `races/race.js` : fiche de course générique. Les fiches et leurs GPX (`profile.gpxData`) vivent dans la collection `raceCatalog` de la base locale et dans les sauvegardes, jamais dans le dépôt.
- `styles.css` : feuille de styles unique ; réutiliser ses variables et composants.
- Les blocs d'une fiche (scénarios, ravitos, nutrition, rappels, matériel, sources) sont facultatifs : ne pas coder de contenu propre à une course dans le moteur de rendu. Les identifiants des repères du profil correspondent à ceux des ravitos.

## Données et confidentialité

- Le dépôt GitHub est public : aucune donnée personnelle, donnée de course, trace GPX, sauvegarde JSON, secret ou clé d'API dans les fichiers suivis.
- Ne jamais inventer d'horaires, distances, dénivelés, ravitaillements ou conseils sportifs : ils viennent des informations fournies ou vérifiées.
- Toute modification du format de données doit rester compatible avec les sauvegardes existantes (formats 1 et 2 acceptés) ou prévoir une migration ; incrémenter `DATABASE_VERSION` si le schéma IndexedDB change.
- Dates : toujours en heure locale de l'appareil, clés au format `AAAA-MM-JJ`. Recalculer la date du jour à l'affichage et au retour au premier plan.

## Livrer une nouvelle version

Quand une modification change les ressources livrées :

1. Ajouter toute nouvelle ressource à la liste `FILES` de `sw.js` et incrémenter `CACHE_NAME`.
2. Mettre à jour le numéro de version en bas de `index.html`.
3. Documenter l'évolution dans `versions.html`.
4. Mettre à jour les cases et statuts de `docs/roadmap.md`, et `docs/specification.md` si le comportement change.

## Façon de travailler

- Avancer point par point : une évolution ciblée à la fois, vérifiée, puis commitée séparément.
- Proposer un plan court avant un changement important ou une décision de conception ; ne pas trancher seul une question ouverte du plan.
- Après une modification : relire le diff et lancer `npm run check` (Prettier, ESLint, tests). `npm run format` reformate le code. Il n'y a pas d'étape de build : Node.js ne sert qu'aux outils de développement.
- Pour un changement d'interface ou de PWA, tester le parcours sur largeur mobile ; signaler ce qui reste à vérifier sur iPhone/Safari.
- Un commit de formatage pur est ajouté à `.git-blame-ignore-revs`.
- Ne pas réécrire l'historique Git (purge des anciennes données Mallorca comprise) sans décision explicite.

## Mise à jour de ces consignes

Tenir ce fichier à jour lorsqu'une convention ou une décision durable change, en restant concis (pas de notes de session ni de détails propres à une course). `.github/copilot-instructions.md` contient des consignes équivalentes pour Copilot : les garder cohérentes.
