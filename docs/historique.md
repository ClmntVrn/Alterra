# Historique d’Alterra

Étapes terminées et vérifiées, sorties de la [feuille de route](./roadmap.md) pour qu’elle reste lisible. Les décisions toujours en vigueur sont dans sa section « Décisions de référence » ; le détail des versions publiées est dans `versions.html`.

## Feuille de route

### Étapes 1 à 3 — Cadrage, fondation locale et stockage personnel

**Statut :** terminées — 22 octobre 2026

- [x] Données, confidentialité, sauvegarde et parcours mobile cadrés.
- [x] Logique du calendrier sortie de `index.html` vers des modules ES.
- [x] Format personnel versionné, validation et interface de repository indépendante du stockage.
- [x] IndexedDB pour le catalogue de courses et les données personnelles ; utilisable hors ligne.
- [x] Export/import complet depuis l’accueil, incluant fiches de course, GPX, plan Mallorca et états de checklist ; vérifié sur le téléphone avant de retirer les données de course du dépôt.

### Étape 4 — Entraînements et courses

**Statut :** en grande partie réalisée

- [x] Ajouter une sortie depuis une journée : type, heure 24 h facultative, distance, durée, D+, météo, notes, case « réalisée ».
- [x] Modifier une sortie ; cocher/décocher « réalisée » depuis sa carte ; supprimer une sortie prévue avec confirmation.
- [x] Allure moyenne calculée depuis la distance et la durée.
- [x] Courses personnelles (nom, dates) distinctes des courses de référence du catalogue.
- [x] Sorties et courses sur plusieurs jours.
- [x] Une sortie prévue passée et non cochée est affichée « à vérifier » (décision du 26 octobre 2026).
- [x] Ressenti (1–10), FC moyenne et FC max sur les sorties réalisées.
- [x] Formulaire simplifié : type en un toucher, nom facultatif, une seule date (la fin se déduit de l’heure et de la durée), saisie rapide de l’heure et de la durée.

**Validation :** un utilisateur peut gérer son calendrier sportif sans ordinateur et marquer une sortie comme réalisée avec ses valeurs effectives.

### Étape 5 — Vue jour simplifiée

**Statut :** terminée — 27 octobre 2026 (0.8.17)

But : comprendre une journée d’un coup d’œil, sans blocs empilés ni détails inutiles.

- [x] Une seule couche par carte : le bloc orange qui entourait les cartes est supprimé.
- [x] Carte résumée : type et état, nom, chiffres clés selon le type, comme sur Strava (trail et vélo : km, D+, durée ; course à pied : km, allure, durée ; renforcement : durée) ; case ronde discrète pour marquer « réalisée » (décisions du 27 octobre 2026).
- [x] Toucher la carte ouvre le détail en plein écran : tous les chiffres, notes, « Réalisée », « Modifier », « Supprimer ». Les formulaires s’ouvrent aussi en plein écran.
- [x] Cartes de course : toucher ouvre la fiche (course de référence) ou la modification, avec suppression (course personnelle).
- [x] Vérifié sur iPhone le 27 octobre 2026.

**Validation :** sur iPhone, une journée avec plusieurs sorties se lit sans défiler ni chercher ; tout reste accessible depuis le détail.

## Refonte technique

Chantier de qualité du code décidé le 26 octobre 2026, mené en parallèle de la feuille de route : chaque étape est un commit séparé, sans changement de comportement sauf mention, vérifié par `npm run check` et un scénario dans le navigateur.

### R1 — Hygiène du dépôt

**Statut :** terminée — 26 octobre 2026

- [x] `.editorconfig`, `.gitattributes`, fins de ligne LF, `package.json` (outils de développement uniquement).
- [x] Prettier et ESLint, `npm run check` ; documents de projet déplacés dans `docs/`.

### R2 — Domaine pur et tests

**Statut :** terminée — 26 octobre 2026 (0.8.8)

- [x] Dates, durées, séances et statistiques extraites dans `src/domain/`, formats français dans `src/ui/format.js`, doublons supprimés.
- [x] Tests `node --test`, dont un test vérifiant que le service worker précache toutes les ressources livrées.
- [x] Corrigé au passage : le graphique d’activité recomptait les séances à chaque sélection de semaine.

### R3 — Nouvelle arborescence

**Statut :** terminée — 26 octobre 2026 (0.8.9)

- [x] `src/pages/`, `src/features/`, `src/storage/`, `styles/`, `assets/icons/` ; déplacements par `git mv` pour garder l’historique.
- [x] Fiche course à la racine : `race.html?id=…`.

### R4 — Découpage du calendrier

**Statut :** terminée — 26 octobre 2026 (0.8.10, 0.8.11)

- [x] `calendar.js` réduit aux vues mois/jour ; cartes et formulaires dans `features/workouts/` et `features/races/` ; règles du calendrier dans `src/domain/calendar.js` avec tests ; plus d’état global.
- [x] Corrigé au passage : la modification d’une course personnelle enregistrait un champ interne (`eventType`).
- [x] Sélecteur de mois natif (`<input type="month">`) à la place des roues maison ; vérifié sur iPhone le 26 octobre 2026.
- [x] Retours iPhone corrigés en 0.8.16 : titre du mois orange seulement pendant le choix, champ de date qui ne déborde plus sur l’heure.
- [x] Les deux correctifs de la 0.8.16 vérifiés sur iPhone le 27 octobre 2026.
- Limite acceptée le 27 octobre 2026 : sur Chrome ordinateur/Android, le titre du mois reste orange après le choix jusqu’au toucher suivant ailleurs.

### R5 — Découpage de la fiche course

**Statut :** terminée — 26 octobre 2026 (0.8.12)

- [x] `race.js` réduit au chargement et à l’assemblage ; blocs dans `features/race-sheet/` ; plan personnel et profil d’altitude dans `src/domain/` avec tests ; plus de variable globale `window.updateElevationProgress`.

### R6 — Feuilles de styles

**Statut :** terminée — 26 octobre 2026 (0.8.13, 0.8.14)

- [x] `main.css` découpée en `tokens.css`, `base.css`, `layout.css`, `components/` et `features/` ; chaque page charge ses feuilles.
- [x] Styles calculés de tous les éléments vérifiés identiques (9 écrans, 3 largeurs) ; règles inutilisées supprimées.
- [x] Aucune couleur écrite en dur hors de `tokens.css`.

### R7 — Renommage des données

**Statut :** terminée — 26 octobre 2026 (0.8.15)

- [x] Collections `plannedSessions` → `workouts` et `raceEvents` → `personalRaces`, avec migration de la base IndexedDB (version 3) dans la transaction de mise à niveau.
- [x] Sauvegarde au format 3 ; les formats 1 et 2 restent acceptés à l’import ; champ interne `eventType` retiré au passage.
- [x] Migration testée sur une copie d’une vraie sauvegarde (gardée hors du dépôt) : mise à niveau v2 → v3 dans le navigateur, contenu identique enregistrement par enregistrement, écrans, export, réimport. Test facultatif : `ALTERRA_BACKUP=… npm test`.
- [x] Vérifié sur iPhone le 26 octobre 2026 : base mise à jour au premier lancement, données intactes, sauvegarde exportée au format 3.

### R8 — Automatisation

**Statut :** terminée — 26 octobre 2026

- [x] `npm run release -- <version> "<ligne>"` : numéro de version partout, entrée datée dans `versions.html`, cache du service worker dérivé de la version, puis `npm run check` ; tout est préparé avant la première écriture. Un test vérifie que la version est identique partout.
- [x] Tests navigateur dans `tests/browser/` (calendrier, fiche course, mise à niveau de la base, mise en page mobile), lancés par `npm run test:browser` ; pilotage de Chrome ou Edge sans dépendance dans `tools/browser.js`. Vérifié qu’une migration sabotée fait échouer les tests.
- [x] Intégration continue GitHub (`.github/workflows/ci.yml`) : `npm ci`, `npm run check` puis `npm run test:browser` à chaque push ; elle signale sans bloquer la publication. Étapes reproduites localement.
- [x] CI au vert sur GitHub le 26 octobre 2026 (commit `7ff65fb`). Les premiers passages ont révélé des écarts propres à Chrome sous Linux (focus du champ de mois, absence de souris), corrigés dans les tests ; chaque test en échec devient une annotation GitHub (`tools/github-reporter.js`).
