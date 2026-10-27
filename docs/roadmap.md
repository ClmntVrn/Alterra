# Plan de développement d’Alterra

**Mis à jour le :** 27 octobre 2026  
**État général :** version locale utilisable (0.8.16) ; suivi des entraînements et statistiques en place. Prochaines étapes : simplifier les écrans, navigation en bas d’écran, objectifs et ajout de course, puis nutrition et équipement.

## Vision

Faire d’Alterra une application mobile simple pour gérer la préparation trail et running : entraînements, courses, nutrition, matériel et, à terme, aide à la création de séances par IA. L’application doit être utilisable depuis le téléphone sans VS Code.

Les données personnelles doivent rester privées. Chaque personne possède son espace ; le partage avec un ami ne se fait que volontairement. Le dépôt GitHub ne contient ni données personnelles, ni secrets, ni clés d’API.

## Principes de réalisation

- Avancer par étapes vérifiables, en commençant par ce qui ne coûte rien.
- Ne pas ajouter de service payant avant d’avoir validé le besoin et les limites de l’offre gratuite.
- Garder l’interface mobile-first, en français, simple et utilisable hors ligne lorsque c’est pertinent.
- Prévoir l’export et la restauration des données dès le stockage local.
- Ne jamais exposer de secrets ou de clés d’API dans le code livré au navigateur.
- Traiter les recommandations sportives de l’IA comme des propositions à vérifier et valider, pas comme des prescriptions médicales.

## État actuel

- [x] PWA statique (HTML, CSS, JavaScript natif) installable et utilisable hors ligne.
- [x] Base locale IndexedDB avec sauvegarde autonome (export/import JSON, format 3), rappel de la dernière sauvegarde et demande de stockage persistant.
- [x] Calendrier mois/jour avec sorties, courses personnelles et courses de référence, y compris sur plusieurs jours.
- [x] Sorties prévues ou réalisées, modifiables ; statistiques des 12 dernières semaines sur les sorties réalisées.
- [x] Fiches de course génériques : profil GPX, ravitos, scénarios, nutrition, rappels, matériel, sources.
- [ ] Nutrition et équipement personnels.
- [ ] Comptes, synchronisation multi-appareils et intégrations (Garmin, IA).

## Décisions de référence

### Données et confidentialité

- Usage personnel d’abord ; un ami pourra plus tard utiliser Alterra avec son propre espace, sans partage implicite.
- Aucune donnée personnelle envoyée automatiquement à GitHub ou synchronisée pendant la phase locale. Les fiches de course et GPX ne sont pas dans le dépôt : elles vivent dans la base locale et la sauvegarde.
- Les données personnelles Mallorca ont déjà été poussées dans le dépôt public et peuvent rester visibles dans l’historique Git. Ne pas y ajouter d’informations privées ; toute purge d’historique sera évaluée séparément.
- Suppression d’une entrée avec confirmation ; l’import remplace toute la base après confirmation.
- Unités : km, mètres de D+, durée en minutes (saisie en heures et minutes), allure en min/km.

### Sorties prévues et réalisées

- **Une sortie est un seul enregistrement** (`workouts`, anciennement `plannedSessions`) avec un statut `planned` ou `completed`. Une fois réalisée, ses valeurs sont les valeurs réelles : **l’objectif prévu n’est pas conservé** (décision du 26 octobre 2026, qui remplace la règle initiale « garder le prévu consultable après réalisation »).
- La collection `activities` n’est pas utilisée. Elle reste dans le format de sauvegarde pour compatibilité ; un futur import (Garmin, GPX) marquera ou créera directement une sortie réalisée plutôt qu’une activité séparée.
- Types de sortie : trail, course à pied, renforcement musculaire, vélo. Météo : une catégorie au choix (ensoleillé, nuageux, pluie, neige, vent, orage).
- Une sortie n’a qu’une date de début saisie ; sa date de fin est calculée depuis l’heure et la durée (26 octobre 2026). Une sortie prévue dont la date est passée est « à vérifier », sans être déclarée manquée.
- Ressenti, FC et météo ne sont enregistrés que sur une sortie réalisée.
- Une sortie prévue peut être supprimée ; une sortie réalisée ne l’est pas depuis le calendrier (repasser d’abord en « prévu »).
- Les statistiques ne comptent que les sorties réalisées, une seule fois, dans la semaine de leur date de début.
- Le stockage des traces GPS des sorties est reporté.

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

### Étape 6 — Fiche course lisible en course

**Statut :** réalisée en 0.8.18 — à vérifier sur iPhone

But : une fiche consultable en quelques secondes pendant la course, sans lire de texte.

Décisions du 27 octobre 2026 : fiche unique réorganisée, sans mode course (pour s’y habituer avant la course) ; pas d’avance ni de retard affichés ; pas d’écran maintenu allumé ; position GPS en direct reportée à une version ultérieure.

- [x] Bloc « En course » en haut : prochain ravito en grand, distance, D+ et D− jusqu’à lui (calculés sur le GPX), heure de passage du scénario choisi, km jusqu’à l’arrivée ; grand bouton « Ravito atteint » et « Annuler ».
- [x] Profil dessiné à la largeur de l’écran (textes lisibles), partie parcourue remplie en orange, ligne de position, noms qui ne se chevauchent plus, zone de toucher élargie ; légende, pastille D+, texte de progression et texte d’aide retirés.
- [x] Ravitos : toute la carte se touche, le prochain est encadré en orange, les passés sont réduits ; texte d’aide des scénarios retiré.
- [x] Ordre : en-tête compact, En course, profil, ravitos, nutrition, rappels ; matériel, infos pratiques et sources repliés.
- [ ] À vérifier sur iPhone avec une vraie fiche : lisibilité dehors, noms des ravitos sur le profil, rotation de l’écran.
- [ ] Plus tard : position GPS en direct sur le profil, en option.

**Validation :** sur iPhone, en plein soleil et en mouvement, on trouve le prochain ravito et le reste à parcourir en moins de 5 secondes.

### Étape 7 — Navigation en bas d’écran

**Statut :** à faire

- Barre d’onglets toujours visible en bas, adaptée à l’iPhone (zone de sécurité, PWA plein écran) : Accueil (calendrier), Objectifs, IA, Profil, et éventuellement KPI.
- Profil : réglages, sauvegarde/restauration, puis plus tard équipement et nutrition (étape 10).
- Statistiques déplacées dans l’onglet KPI si on le retient, sinon laissées sur l’accueil.
- À trancher : onglet KPI séparé ou non ; onglet IA visible dès maintenant (« bientôt ») ou ajouté seulement à l’étape 15 ; une page HTML par onglet (choix le plus simple) ou une seule page avec des vues.

**Validation :** chaque onglet s’ouvre d’un toucher, y compris hors ligne, sans perte de position sur l’accueil ; la barre ne masque aucun contenu.

### Étape 8 — Objectifs

**Statut :** à faire

- Onglet Objectifs : courses à venir (personnelles et fiches de référence) avec compte à rebours, accès direct à la fiche ; courses passées repliées.
- Autres objectifs datés, par exemple la fin d’un programme d’entraînement.
- À trancher : types d’objectifs à prévoir au départ en plus des courses ; ce qui est affiché pour un objectif (date, compte à rebours, note).

**Validation :** les objectifs sont créés, modifiés, supprimés sur le téléphone et inclus dans la sauvegarde.

### Étape 9 — Ajout d’une course depuis l’application

**Statut :** à faire

Aujourd’hui une fiche de course n’arrive que par restauration d’une sauvegarde.

- Créer et modifier une fiche depuis le téléphone : nom, dates, lieu, distance, D+, import du fichier GPX, liste des ravitos (nom, km).
- Les blocs facultatifs (nutrition, rappels, matériel, sources) restent ajoutables plus tard ; aucune valeur inventée.
- Lien entre la course et l’onglet Objectifs ; ajout possible au calendrier.
- À trancher : faut-il fusionner course personnelle (`personalRace`) et fiche (`raceSheet`) pour l’utilisateur, ou garder une course simple et une fiche facultative ; champs obligatoires.

**Validation :** une course créée sur iPhone avec son GPX affiche une fiche complète utilisable hors ligne et figure dans la sauvegarde.

### Étape 10 — Nutrition et équipement

**Statut :** à faire

Rangés dans l’onglet Profil.

- Créer un catalogue personnel de produits nutritionnels avec glucides et sodium par portion ou par gramme.
- Permettre d’ajouter et retirer des produits d’une sortie ou d’une course.
- Gérer l’équipement : chaussures, vêtements, sac et accessoires.
- Relier l’équipement aux sorties, notamment pour suivre les kilomètres cumulés des chaussures.

**Validation :** les catalogues sont modifiables par l’utilisateur, enregistrés localement et inclus dans l’export/restauration.

### Étape 11 — Tableau de bord et KPIs

**Statut :** première version réalisée

- [x] Graphique des 12 dernières semaines sur les sorties réalisées : distance, durée, D+ et km-effort.
- [x] Filtres Trail + course à pied, Trail, Course à pied, Vélo ; totaux de la semaine sélectionnée.
- [x] Repères du calendrier distinguant entraînement/course et prévu/réalisé sans reposer uniquement sur la couleur.
- [x] Calculs KPI extraits dans `src/domain/statistics.js` et couverts par des tests.
- [ ] Éventuellement : nombre de sorties par semaine, comparaison avec le volume prévu.

### Étape 12 — Fiabiliser la version gratuite

**Statut :** à faire

- [x] Tests unitaires `node --test` des dates, durées, séances, KPI et de la validation des sauvegardes.
- Tester les parcours principaux sur petit écran et sur iPhone/PWA.
- Tester les cas hors ligne, les erreurs de stockage, les exports invalides et les restaurations.
- Vérifier l’accessibilité clavier, les libellés et les confirmations avant suppression.

**Validation :** les fonctions des étapes précédentes sont utilisables et les données peuvent être sauvegardées/restaurées sans perte silencieuse.

### Étape 13 — Préparer et tester la migration

**Statut :** à faire

- Stabiliser le format d’export et les identifiants des données.
- Tester la migration de données locales vers un espace de test sans écraser la sauvegarde d’origine.
- Comparer les offres gratuites de backend, leurs quotas, leur politique de pause, leurs sauvegardes et leurs conditions de confidentialité ; choisir ensuite le fournisseur.

**Validation :** une sauvegarde locale peut être migrée et vérifiée ; les limites et risques du fournisseur choisi sont compris.

### Étape 14 — Comptes et synchronisation multi-appareils

**Statut :** à faire

- Authentification et synchronisation avec un backend, d’abord sur une offre gratuite.
- Isolation des données par compte imposée côté serveur/base de données.
- Migration des données locales avec confirmation et export de secours.
- Compte indépendant pour un ami ; rien de partagé sans action explicite.
- Récupération de compte, export et suppression des données.

**Validation :** les données d’un compte ne sont jamais accessibles depuis un autre ; une modification se synchronise entre appareils.

### Étape 15 — Services payants et intégrations avancées

**Statut :** à faire — seulement si le besoin est confirmé

- Évaluer un hébergement et un backend payants si les limites de l’offre gratuite gênent l’usage ; décider si un nom de domaine est utile.
- Étudier l’intégration Garmin (ou Strava) via les accès officiels ; conserver un import de fichier comme solution de repli. Une activité importée marque ou crée la sortie réalisée du jour.
- Ajouter une IA côté serveur, sans clé dans le navigateur, avec limites de dépenses configurables ; les séances proposées sont examinées et validées avant ajout au calendrier.
- Onglet IA : assistant conversationnel pour créer une séance spécifique ou une fiche de course à partir d’un lien, avec validation avant tout enregistrement.
- Présenter les coûts récurrents et obtenir l’accord de l’utilisateur avant d’activer tout service payant.

**Validation :** chaque service externe a un coût et une politique de données documentés ; les clés restent côté serveur.

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

## Suivi

- Mettre à jour les cases et le statut de l’étape concernée (feuille de route ou refonte technique) après chaque évolution notable.
- Ajouter les décisions importantes dans « Décisions de référence » en datant celles qui en remplacent une autre.
- Ne pas marquer une étape terminée avant d’avoir vérifié ses critères de validation.
