# Architecture d’Alterra

**Statut :** architecture validée le 22 octobre 2026, en place pour la version locale  
**Mise à jour :** 26 octobre 2026

Ce document décrit l’architecture actuelle et son évolution prévue, sans backend ni frais au départ.

## 1. Vue d’ensemble

Alterra est une PWA statique en HTML, CSS et JavaScript natif (modules ES), sans framework ni étape de build.

```text
Pages (index.html, race.html, versions.html, styles/)
  statistiques · calendrier mois/jour · formulaires · fiches de course
                     │
                     ▼
Points d’entrée et fonctionnalités (src/pages/, src/features/)
  calendrier, statistiques, sauvegarde, fiche de course
                     │
                     ▼
Repository (src/storage/repository.js)
  list · get · save · remove, indépendant du stockage
                     │
                     ▼
Adaptateur IndexedDB (src/storage/indexeddb.js)
  base « alterra-personal-data » sur l’appareil
```

| Fichier                                          | Rôle                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/home.js`                              | Initialise l’accueil, le service worker, le stockage persistant et la sauvegarde.                                          |
| `src/pages/race.js`                              | Fiche course : chargement de la fiche et du plan personnel, assemblage des blocs.                                          |
| `src/features/race-sheet/`                       | Blocs de la fiche : en-tête, profil GPX, ravitos et scénarios, matériel, infos.                                            |
| `src/features/calendar/calendar.js`              | Calendrier : vue mois/jour, navigation et rafraîchissement, sans état global.                                              |
| `src/features/calendar/month-grid.js`            | Grille du calendrier, générique.                                                                                           |
| `src/features/calendar/month-picker.js`          | Choix du mois avec le sélecteur natif (`<input type="month">`).                                                            |
| `src/features/statistics/activity-statistics.js` | Graphique et totaux des 12 dernières semaines.                                                                             |
| `src/features/workouts/`                         | Carte et formulaire d’une séance, libellés des types et états.                                                             |
| `src/features/races/`                            | Cartes des courses et formulaire d’une course personnelle.                                                                 |
| `src/domain/`                                    | Règles pures, sans DOM ni stockage : dates, durées, séances, statistiques, calendrier.                                     |
| `src/domain/backup-format.js`                    | Format de sauvegarde versionné et validation.                                                                              |
| `src/domain/race-plan.js`                        | Application du plan personnel à la fiche de référence.                                                                     |
| `src/domain/elevation-profile.js`                | Distances de la trace, points du profil, graduations et progression.                                                       |
| `src/storage/personal-data.js`                   | Export/restauration complète, y compris les clés `localStorage` `alterra-*`.                                               |
| `src/storage/race-catalog.js`                    | Chargement du catalogue de courses depuis la base locale.                                                                  |
| `src/ui/format.js`                               | Formats d’affichage français partagés (dates, nombres, périodes).                                                          |
| `src/ui/dom.js`                                  | Création d’éléments HTML (`el()`).                                                                                         |
| `styles/`                                        | `tokens.css`, `base.css`, `layout.css`, puis une feuille par composant et fonctionnalité ; chaque page charge les siennes. |
| `assets/icons/`                                  | Icônes du site et de l’écran d’accueil.                                                                                    |
| `sw.js`, `manifest.json`                         | Précache hors ligne et manifeste de la PWA, à la racine pour couvrir tout le site.                                         |
| `tests/`                                         | Tests `node --test` du domaine, des formats et du précache du service worker.                                              |

Le code des écrans délègue les calculs à `src/domain/` ; c’est la partie couverte par les tests. Un test vérifie aussi que chaque ressource livrée figure dans le précache de `sw.js`.

Les écrans passent par le repository, jamais directement par les transactions IndexedDB. Le jour où une synchronisation sera nécessaire, une implémentation distante du même repository pourra remplacer ou compléter IndexedDB.

## 2. Données

### Données du dépôt

Le dépôt ne contient que le code de l’application : aucune fiche de course, trace GPX ni donnée personnelle. Une installation neuve démarre avec un calendrier vide ; une sauvegarde restaure courses, traces et données privées.

### Données sur l’appareil

Collections IndexedDB (clé `id`, identifiant stable généré par `crypto.randomUUID()` pour les créations) :

| Collection                       | Contenu                                                               | Utilisation              |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| `plannedSessions`                | Sorties prévues ou réalisées (statut `planned` ou `completed`)        | Calendrier, statistiques |
| `raceEvents`                     | Courses personnelles (nom, dates)                                     | Calendrier               |
| `raceCatalog`                    | Fiches de course de référence, GPX embarqué dans `profile.gpxData`    | Calendrier, fiches       |
| `racePlans`                      | Plan personnel d’une course (objectif, scénarios, nutrition, rappels) | Fiches                   |
| `activities`                     | Non utilisée, conservée pour compatibilité du format                  | —                        |
| `nutritionProducts`, `equipment` | Prévues pour l’étape 5                                                | —                        |
| `settings`                       | Réglages : catalogue initialisé, date de la dernière sauvegarde       | Accueil                  |

Une sortie réalisée est le même enregistrement que la sortie prévue, mis à jour avec les valeurs réelles : le prévu n’est pas conservé après réalisation. Champs d’une sortie : `date`, `endDate` (calculée depuis `time` et `durationMinutes`, absente si la sortie tient sur un jour), `type`, `title`, `status`, `time`, `distanceKm`, `durationMinutes`, `ascentMeters`, `notes`, `createdAt`, `completedAt`, et pour une sortie réalisée `perceivedEffort` (1–10), `heartRateAvg`, `heartRateMax` (bpm) et `weather`. L’état « à vérifier » n’est pas stocké : il est déduit à l’affichage d’une sortie prévue dont la date est passée.

Les états de progression des fiches (ravitos cochés, matériel) sont dans `localStorage` sous des clés `alterra-*` et sont inclus dans la sauvegarde.

Les dates sont des clés locales `AAAA-MM-JJ`, interprétées dans le fuseau de l’appareil ; les périodes (`date` → `endDate`) sont inclusives.

## 3. Sauvegarde et limites

- L’export est un JSON autonome (format 2, le format 1 reste accepté) : toutes les collections, les réglages, les états `localStorage` et la date de la sauvegarde.
- L’import valide le fichier puis, après confirmation, remplace toute la base en une seule transaction.
- L’accueil affiche la date de la dernière sauvegarde et la met en avant au-delà de 7 jours. Au démarrage, l’application demande un stockage persistant (`navigator.storage.persist()`).
- Le schéma IndexedDB a un numéro de version (`DATABASE_VERSION`) pour migrer sans effacer les données.

Limites :

- pas de synchronisation entre appareils ;
- l’effacement des données du navigateur ou la perte de l’appareil supprime la base ;
- les exports contiennent des données personnelles et doivent être conservés en lieu sûr ;
- IndexedDB n’est pas chiffré : la protection de l’appareil reste importante.

Le service worker ne met en cache que l’interface ; les données personnelles ne transitent pas par son cache. Chaque changement des ressources livrées impose d’incrémenter `CACHE_NAME`.

## 4. Évolutions prévues

- **Couleurs :** remplacer les couleurs écrites en dur dans les feuilles de styles par des variables.
- **Backend :** quand la synchronisation sera nécessaire, ajouter une implémentation distante du repository avec authentification et isolation des données par utilisateur vérifiées côté serveur ; migrer par export puis import vérifié, sans supprimer la sauvegarde source.
- **Intégrations :** Garmin/Strava et IA passeront par un serveur ; aucun secret d’API dans le navigateur. Les séances générées par IA restent des propositions à valider.

## 5. Confidentialité de l’historique

Le dépôt GitHub est public. Des données privées de Mallorca ont été publiées dans d’anciens commits et peuvent rester dans l’historique Git. Une éventuelle purge réécrirait l’historique : c’est une décision distincte à discuter avant toute action.
