# Architecture proposée pour Alterra

**Statut :** architecture validée le 22 octobre 2026 ; étape 2 en cours  
**Mise à jour :** 22 octobre 2026

Ce document décrit une évolution progressive de l’application actuelle, sans backend ni frais au départ. Les choix déjà confirmés par l’utilisateur sont marqués comme tels ; les détails techniques restent modifiables avant de coder.

## 1. Point de départ

Alterra est actuellement une PWA statique en HTML, CSS et JavaScript natif :

- `index.html` contient le calendrier ; sa logique est maintenant déplacée dans `app/calendar.js`.
- `app/main.js` initialise le calendrier et le service worker.
- `app/domain/models.js` définit la version et la validation de base du format personnel.
- `app/storage/repository.js` définit l’interface entre les fonctions de l’application et l’adaptateur de stockage, sans encore persister de données.
- `races/race.html` et `races/race.js` affichent les fiches de course génériques.
- Les courses de référence sont décrites dans des fichiers JSON sous `races/`.
- `sw.js` met en cache l’interface et les ressources du site pour l’utilisation hors ligne.

Cette base peut évoluer sans introduire immédiatement de framework, de compte utilisateur ou de service payant.

## 2. Architecture cible pour la première version personnelle

```text
Interface PWA
  Calendrier mensuel · détails du jour · formulaires · KPIs
                     │
                     ▼
Services métier
  entraînements · activités · courses personnelles · nutrition · équipement
  calculs KPI purs et testables
                     │
                     ▼
Interface de stockage
  repositories / opérations de lecture, création, modification, suppression
                     │
                     ▼
IndexedDB dans le navigateur
  données privées enregistrées sur cet appareil
```

Le code reste en JavaScript natif avec des modules ES. Les pages et les styles existants sont conservés ; le code du calendrier est déplacé progressivement hors du HTML lorsque l’on commencera à le faire évoluer.

Structure indicative, à ajuster au moment de l’implémentation :

```text
app/
  main.js
  calendar.js
  domain/
    models.js
    kpis.js
  storage/
    database.js
    repositories.js
```

Ne créer que les modules nécessaires à la première fonctionnalité ; éviter de bâtir une couche abstraite complexe avant d’en avoir besoin.

## 3. Séparer données publiques et données personnelles

### Données publiques du site

Les JSON du catalogue et les fiches de course publiques restent des ressources versionnées dans le dépôt. Elles décrivent les parcours et les informations de référence, pas le profil privé de l’utilisateur.

### Données privées de l’utilisateur

Elles sont enregistrées dans IndexedDB sur l’appareil et ne sont pas :

- écrites dans les fichiers suivis par Git ;
- incluses dans le précache du service worker ;
- envoyées à un serveur pendant la phase locale ;
- partagées avec un autre compte.

Collections locales envisagées :

- `plannedSessions` : entraînements prévus, objectifs, étapes, notes, nutrition et équipement prévus, statut ;
- `activities` : séances réellement faites, saisies manuellement ou, plus tard, importées ;
- `raceEvents` : courses ajoutées par l’utilisateur à son calendrier, distinctes des fiches publiques du catalogue ;
- `nutritionProducts` : produits personnels et valeurs nutritionnelles ;
- `equipment` : chaussures, vêtements, sac et matériel ;
- `settings` : version du format de données et préférences non sensibles.

Chaque entrée reçoit un identifiant stable. Une activité peut référencer une séance prévue, sans effacer ni remplacer l’objectif d’origine. Les références aux équipements et produits sont des identifiants, pas des copies de leurs fiches.

Les champs validés pour les activités et les séances figurent dans [plan.md](./plan.md). Les unités de référence sont métriques : km, mètres, durée en heures/minutes/secondes, allure en min/km et fréquence cardiaque en bpm. Les traces GPS restent hors du premier modèle ; ce choix est reporté.

Les informations personnelles propres à Mallorca — objectif de temps, scénarios et horaires de passage personnels, plan nutritionnel et rappels d’effort — seront séparées des données publiques de la course. Elles seront stockées dans les données locales privées et incluses dans le fichier de sauvegarde personnel ; elles ne devront pas être ajoutées au JSON public de course versionné dans GitHub.

## 4. Calendrier et calcul des KPIs

- L’accueil conserve le calendrier mensuel actuel, son titre et son court descriptif.
- Les repères d’une journée distinguent entraînement/course et prévu/réalisé ; ils ne reposent pas uniquement sur la couleur.
- Toucher une journée ouvre ses séances prévues, activités réelles et courses.
- La séance prévue reste consultable après réalisation.
- Le tableau de bord propose les indicateurs distance, durée, dénivelé positif et nombre de séances sur les 12 dernières semaines, avec sélection des valeurs prévues ou réalisées.
- Les règles de calcul sont isolées dans des fonctions métier sans dépendance à l’interface ou à IndexedDB, afin de pouvoir les tester avec des données déterministes.
- Lorsqu’une activité réelle existe un jour donné, elle remplace la séance prévue de ce jour dans les valeurs réalisées ; plusieurs activités réelles du jour s’additionnent entre elles. La séance prévue n’est pas comptée comme une seconde activité.
- Une séance déplacée change de date sans doublon ; une séance partielle utilise les valeurs réelles ; une séance annulée n’est pas comptée comme réalisée ; une séance passée non confirmée reste « à vérifier ».

Les règles détaillées de remplacement et les cas limites sont suivis dans [plan.md](./plan.md).

## 5. Stockage local, sauvegarde et limites

IndexedDB sert de base locale structurée. Une petite couche de repositories fournit les opérations métier ; les écrans ne manipulent pas directement les transactions IndexedDB. Le schéma possède un numéro de version pour permettre des migrations locales sans effacer les données existantes.

Les sauvegardes exportées sont des fichiers JSON versionnés validés avant restauration. Restaurer remplace toutes les données Alterra de l’appareil après confirmation. Le transfert initial du plan personnel Mallorca est déclenché depuis sa fiche, puis une copie privée locale doit être vérifiée sur le téléphone avant de retirer ses champs du JSON public. Les données locales ne sont pas synchronisées automatiquement.

L’accueil proposera un accès visible à « Sauvegarder mes données » et « Importer une sauvegarde ». Sur iPhone, l’export ouvrira le partage ou l’enregistrement de fichier pour permettre de choisir l’app Fichiers, iCloud Drive ou un autre emplacement. L’import permettra de sélectionner le fichier de sauvegarde depuis l’appareil.

La sauvegarde complète contient les données privées locales, dont le plan personnel Mallorca. La restauration valide le format avant import et demande confirmation avant toute modification des données existantes ; le mode de restauration (remplacement complet ou fusion) reste à décider lors de la conception de l’import. L’utilisateur peut supprimer une entrée ou effacer toutes les données locales avec confirmation.

**Limites à afficher clairement :**

- les données ne sont pas synchronisées entre appareils ;
- la suppression des données du navigateur ou la perte de l’appareil peut supprimer la base locale ;
- les exports contiennent des données personnelles et doivent être conservés en lieu sûr ;
- IndexedDB n’est pas un coffre chiffré : la protection de l’appareil et de son compte système reste importante.

Pendant cette phase, le service worker ne met en cache que l’interface et les ressources publiques ; les données d’activité ne transitent pas par son cache.

## 6. Migration future vers un backend

Quand le besoin de synchronisation sera confirmé, la même interface de repositories pourra recevoir une implémentation distante à la place ou en complément d’IndexedDB. La migration commencera par un export local et un import vérifié, sans supprimer la sauvegarde source.

Le backend devra fournir :

- authentification et isolation des données par utilisateur vérifiées côté serveur/base de données ;
- synchronisation multi-appareils ;
- export et suppression des données ;
- un espace indépendant pour chaque ami, sans partage implicite.

L’intégration Garmin et l’IA viendront après. Les secrets d’API ne seront jamais livrés au navigateur ; les appels à des services qui les exigent passeront par un serveur. Les séances générées par IA resteront des propositions à valider par l’utilisateur.

## 7. Données Mallorca et confidentialité

Le dépôt GitHub est public. Certaines informations de préparation propres à Mallorca (objectif de temps, scénarios et horaires de passage, nutrition et rappels d’effort) se trouvent actuellement dans le JSON de course versionné. La décision est prise de les déplacer à terme dans les données personnelles locales, incluses dans le fichier de sauvegarde privé. Le JSON de course gardera les informations générales et officielles nécessaires à la fiche.

Ces informations ont déjà été publiées dans le dépôt et peuvent rester présentes dans l’historique Git, même après leur déplacement. Ne pas y ajouter de nouvelles données personnelles. Une éventuelle purge de l’historique est une décision distincte qui devra être discutée avant toute action, car elle réécrit les commits du dépôt.

## 8. Ordre d’implémentation proposé

1. [x] Valider cette architecture et le modèle minimal des données.
2. [x] Extraire le code du calendrier en modules sans changer son comportement.
3. [x] Définir le format personnel initial et l’interface du repository.
4. [ ] Créer et tester la base IndexedDB, son versionnage et l’adaptateur.
5. [ ] Ajouter les fonctions d’export, de validation/restauration et de suppression.
6. [ ] Relier ensuite les formulaires du calendrier aux données locales.
7. [ ] Ajouter les activités, les KPIs et les autres domaines par étapes, avec tests des règles prévu/réalisé.

La vérification se fait d’abord sur le serveur local et dans le navigateur mobile, puis sur la PWA installée en HTTPS. Aucun compte, synchronisation, intégration Garmin ou coût récurrent n’est nécessaire pour ces premières étapes.
