# Consignes du projet Alterra

## Objectif et expérience

- Alterra est un site mobile-first de préparation au trail et à la montagne, utilisé notamment comme aide de course sur iPhone.
- Privilégier une interface lisible en un coup d'œil, des libellés simples en français et une bonne utilisabilité sur petit écran.
- Garder l'application simple et intuitive : éviter les textes redondants, les explications superflues et les sections qui surchargent l'interface.
- Le style visuel est outdoor, avec une palette charbon, ardoise, pierre et orange. Ne pas introduire de vert sans demande explicite.

## Structure technique

- Le projet est un site statique en HTML, CSS et JavaScript natif ; ne pas ajouter de framework ou de dépendance sans besoin concret.
- Les styles sont dans `styles/` : `tokens.css` (variables), `base.css`, `layout.css`, puis `components/` et `features/`. Chaque page charge les feuilles dont elle a besoin. Réutiliser les variables et composants existants plutôt que dupliquer les styles ; aucune couleur écrite en dur hors de `tokens.css`.
- `index.html` contient la barre d’onglets et ses vues : Accueil (statistiques et calendrier, avec accès aux fiches de course) et Profil (sauvegarde, version).
- `race.html` et `src/pages/race.js` forment la fiche générique ; les fiches de course et GPX vivent dans la base locale et les sauvegardes, pas dans le dépôt.
- Le code est rangé dans `src/` : `pages/` (points d'entrée), `features/` (fonctionnalités), `domain/` (règles pures, testées), `storage/` (repository et IndexedDB), `ui/` (formats partagés). Les icônes sont dans `assets/icons/`.
- Les détails, scénarios, ravitos, nutrition, rappels, matériel et références GPX sont des données optionnelles par course. Ne pas coder de contenu propre à une course dans le moteur de rendu.
- Le profil d'altitude est construit depuis le GPX référencé dans le JSON de course ; les identifiants des repères correspondent à ceux des ravitos.
- Le site est une PWA : `manifest.json` décrit l'application et `sw.js` met les ressources en cache. Lorsqu'une modification change les ressources livrées hors ligne, vérifier la liste `FILES` du service worker ; `CACHE_NAME` est dérivé du numéro de version.
- Pour une nouvelle version, lancer `npm run release -- <version> "<ligne d'historique>"` : il met à jour le numéro partout, l'historique de `versions.html` et le cache du service worker. Précacher toute nouvelle ressource dans `sw.js`.

## Conventions de modification

- Conserver les comportements existants, l'accessibilité clavier et les attributs ARIA lors des changements d'interface.
- Pour le calendrier, garder les dates fondées sur l'heure locale de l'appareil et recalculer la date du jour lors de l'affichage ou du retour au premier plan.
- Les données de course (dates, distances, dénivelés, horaires, ravitaillements et nutrition) doivent venir des informations fournies ou vérifiées ; ne pas inventer de consignes sportives.
- Ne pas ajouter de données personnelles, secrets, jetons ou informations sensibles au dépôt. Le dépôt pouvant être public, vérifier le contenu avant d'y enregistrer des informations privées.

## Vérification

- Après une modification, vérifier au minimum le diff et `git diff --check`.
- Pour les changements d'interface ou de PWA, tester le parcours concerné sur mobile et, si possible, dans Safari/iOS ou le navigateur intégré à l'écran d'accueil.
- Lancer `npm run check` (Prettier, ESLint, tests) après une modification ; il n'y a pas d'étape de build.

## Mise à jour de ces consignes

- Maintenir ce fichier à jour au fil du développement lorsqu'une décision durable de conception ou une convention technique change.
- Garder ces consignes concises : ne pas y recopier les détails temporaires d'une course ni les notes de session.
