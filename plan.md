# Plan de développement d’Alterra

**Mis à jour le :** 22 octobre 2026  
**État général :** cadrage validé ; fondation locale des données personnelles en cours.

## Vision

Faire d’Alterra une application mobile simple pour gérer la préparation trail et running : entraînements, courses, activités réalisées, nutrition, matériel et, à terme, aide à la création de séances par IA. L’application doit être utilisable depuis le téléphone sans VS Code.

Les données personnelles doivent rester privées. Chaque personne possède son espace ; le partage avec un ami ne se fait que volontairement. Le dépôt GitHub ne contient ni données personnelles, ni secrets, ni clés d’API.

## Principes de réalisation

- Avancer par étapes vérifiables, en commençant par ce qui ne coûte rien.
- Ne pas ajouter de service payant avant d’avoir validé le besoin et les limites de l’offre gratuite.
- Garder l’interface mobile-first, en français, simple et utilisable hors ligne lorsque c’est pertinent.
- Prévoir l’export et la restauration des données dès le stockage local.
- Ne jamais exposer de secrets ou de clés d’API dans le code livré au navigateur.
- Traiter les recommandations sportives de l’IA comme des propositions à vérifier et valider, pas comme des prescriptions médicales.

## État actuel

- [x] Site statique en HTML, CSS et JavaScript, avec style partagé et PWA.
- [x] Calendrier des courses et navigation vers des fiches génériques alimentées par JSON.
- [x] Fiches Mallorca et SaintExpress avec informations de course, matériel et sources.
- [x] Cadrage de la progression gratuite puis backend et fonctionnalités payantes validé.
- [ ] Aucun compte ni synchronisation n’est encore implémenté ; le stockage personnel local est en place, mais la gestion des entraînements reste à construire.
- [ ] Les tableaux de bord KPI et la comparaison planifié/réalisé restent à concevoir et à construire.

## Feuille de route

### Étape 1 — Cadrer les données et la confidentialité

**Statut :** terminée — cadrage validé le 22 octobre 2026

#### Décisions déjà prises

- Commencer par un usage personnel ; un ami pourra éventuellement utiliser Alterra avec son propre compte, sans partage de données entre comptes.
- Les activités réalisées doivent pouvoir contenir : date et type, distance, durée, dénivelé positif, fréquence cardiaque, allure/vitesse, effort ressenti et notes, météo et équipement utilisé.
- Les séances planifiées doivent pouvoir contenir : date et type, distance ou durée cible, dénivelé cible, description/étapes, notes et objectif, nutrition et équipement prévus.
- Unités de référence : km, mètres de D+, durée en heures/minutes/secondes, allure en min/km et fréquences cardiaques moyenne/maximale en bpm.
- L’effort ressenti utilise une échelle simple de 1 à 10. La météo est enregistrée sous forme de catégories.
- Catégories météo combinables : ensoleillé, nuageux, pluie, vent, chaud, froid, neige/verglas ; une note libre facultative peut les compléter.
- Le choix de conserver les traces GPS/GPX des activités est reporté ; ne pas intégrer de trace dans le modèle initial avant d’avoir repris cette décision.
- Types d’entraînement prévus : trail, course à pied sur route, renforcement musculaire et vélo.
- Types de course proposés : trail, course sur route et ultra-trail. Le format ultra pourra compléter la discipline (trail ou route) plutôt que créer une catégorie incompatible.
- Une activité importée de Garmin marque la séance du jour comme réalisée ; une activité saisie manuellement peut aussi être marquée comme réalisée. Dans les deux cas, les valeurs réelles remplacent la séance prévue du même jour dans les KPIs réalisés.
- Une séance passée sans activité associée ni confirmation manuelle reste à vérifier ; elle n’est pas automatiquement déclarée manquée.
- Une séance déplacée change de date sans créer de doublon ; l’activité réalisée est conservée à sa date réelle.
- Une séance partielle reste identifiable comme telle et les KPIs réalisés utilisent les valeurs réellement effectuées, sans compter l’objectif prévu.
- Une séance annulée reste visible comme annulée et n’est pas comptée comme réalisée.
- Des boutons accessibles depuis l’accueil permettent d’exporter une sauvegarde complète vers un fichier et de la restaurer manuellement sur un autre appareil. La sauvegarde comprend aussi les données personnelles du plan Mallorca.
- Suppression d’une entrée ou de toutes les données locales avec confirmation.
- Aucune donnée personnelle envoyée automatiquement à GitHub ou synchronisée vers un autre appareil pendant la phase locale.
- Les éléments personnalisés Mallorca (objectif/scénarios, horaires de passage personnels, nutrition et rappels d’effort) sont déplacés hors du JSON public de course vers le stockage personnel ; le JSON public garde les informations de course de référence.
- Les données personnelles Mallorca ont déjà été poussées dans le dépôt public et peuvent donc rester visibles dans l’historique Git même après leur déplacement. Ne pas y ajouter d’informations privées ; toute purge d’historique sera évaluée séparément.
- Garder sur l’accueil le calendrier mensuel actuel, son titre et son court descriptif ; décider plus tard si le descriptif doit être supprimé.
- Permettre de naviguer entre les mois. Signaler dans chaque jour les entraînements et courses, avec leur état prévu ou réalisé. Employer des repères accessibles qui ne dépendent pas seulement de la couleur.
- Garder le détail d’une séance prévue consultable même lorsqu’une activité réelle du même jour est utilisée pour les totaux réalisés.
- Prévoir des KPIs avec sélection entre valeurs prévues et réalisées : distance, durée, D+, nombre de séances, sur les 12 dernières semaines.
- Dans les totaux réalisés, une activité réelle Garmin ou saisie manuellement le même jour remplace la séance prévue ; plusieurs activités réellement effectuées ce jour-là s’additionnent entre elles, sans ajouter l’entraînement planifié.

- Définir les données à gérer : séances prévues, activités réalisées, courses, produits nutritionnels et équipements.
- Distinguer les informations de référence du projet (ex. données d’une course) des données privées de chaque utilisateur.
- Définir les règles de visibilité, de partage, d’export et de suppression.
- Définir le parcours mobile principal et les écrans minimums de la première version.

**Validation :** données à gérer, types, règles de statut, accueil mobile, confidentialité, partage, sauvegarde et suppression ont été définis avant l’ajout de données utilisateur.

### Étape 2 — Préparer la fondation gratuite et locale

**Statut :** terminée — 22 octobre 2026

Voir l’[architecture validée](./architecture.md).

- [x] Sortir la logique du calendrier de `index.html` vers des modules JavaScript natifs.
- [x] Définir un format personnel versionné et une validation de base des collections.
- [x] Définir une interface de repository indépendante de l’adaptateur de stockage.
- [x] Garder les données personnelles hors des fichiers de course publics et n’ajouter que le code de l’application au précache.
- [x] Préparer une structure qui pourra accueillir IndexedDB puis un backend sans réécrire l’interface.

**Validation :** l’application reste déployable comme site statique et aucune donnée privée n’est publiée.

### Étape 3 — Stockage personnel sur l’appareil

**Statut :** réalisée — archive vérifiée sur le téléphone

L’application démarre désormais sans données de course ; l’import d’une archive complète restaure le catalogue, les GPX et les données personnelles.

- [x] Implémenter IndexedDB pour enregistrer les données personnelles et le catalogue local dans le navigateur.
- Permettre de consulter et modifier ces données hors ligne sur l’appareil.
- [x] Ajouter sur l’accueil des actions visibles pour sauvegarder toutes les données dans un fichier et importer/restaurer une sauvegarde depuis l’appareil (notamment via l’app Fichiers sur iPhone).
- [x] Inclure dans cette sauvegarde les fiches de course de référence, leurs traces GPX, les informations privées Mallorca et l’état des checklists.
- [x] Afficher clairement qu’à ce stade les appareils ne se synchronisent pas automatiquement.
- [x] Transférer le plan Mallorca vers le stockage privé local et retirer ses champs personnels du JSON public après vérification de la sauvegarde sur le téléphone.
- [x] Vérifier sur le téléphone un export format 2 contenant les courses, leurs GPX et le plan Mallorca avant de retirer les données de course du dépôt.

**Validation :** les données survivent à la fermeture et au redémarrage de l’application ; un export peut être restauré ; les fonctions principales sont utilisables hors ligne.

### Étape 4 — Entraînements, courses et activités

**Statut :** en cours

- [x] Ajouter une séance depuis une journée du calendrier, avec type, heure au format 24 h facultative, case réalisé, objectifs et notes.
- [x] Marquer une séance comme réalisée avec une case à cocher sans effacer les objectifs prévus ; permettre de la remettre à faire.
- [x] Supprimer une séance depuis sa carte dans le détail du jour, avec confirmation.
- [x] Modifier une séance prévue ou réalisée directement dans sa fiche ; les valeurs réelles remplacent les objectifs, avec allure calculée et météo au choix.
- Gérer les courses de l’utilisateur sans confondre ces événements avec les courses de référence du catalogue.
- Permettre la saisie manuelle d’une activité réalisée : date, durée, distance, dénivelé, notes et effort ressenti.
- Prévoir des états clairement distincts (prévu, réalisé via Garmin, réalisé manuellement, à vérifier, annulé) ; pour une saisie manuelle simple, modifier directement la fiche réalisée avec les valeurs effectives.
- Reprendre la décision sur le stockage des traces GPS, puis décider si un import local de fichiers d’activité est souhaité. Si oui, commencer par GPX et évaluer FIT/TCX séparément.
- Conserver la séance prévue dans le calendrier comme référence, même après l’import d’une activité réalisée.

**Validation :** un utilisateur peut gérer son calendrier sportif sans ordinateur, marquer une séance comme réalisée, puis modifier simplement les valeurs pour refléter ce qui a été fait.

### Étape 5 — Nutrition et équipement

**Statut :** à faire

- Créer un catalogue personnel de produits nutritionnels avec glucides et sodium par portion ou par gramme.
- Permettre d’ajouter et retirer des produits d’une séance ou d’une course.
- Gérer l’équipement : chaussures, vêtements, sac et accessoires.
- Relier l’équipement aux activités, notamment pour suivre les kilomètres cumulés des chaussures.

**Validation :** les catalogues sont modifiables par l’utilisateur, enregistrés localement et inclus dans l’export/restauration.

### Étape 6 — Tableau de bord et KPIs

**Statut :** à faire

- Conserver l’accueil sous forme de calendrier mensuel, avec son titre et son court descriptif actuels ; naviguer entre les mois.
- Signaler par jour les entraînements et courses, prévus ou réalisés, au moyen de repères accessibles qui ne reposent pas uniquement sur la couleur.
- Ajouter au calendrier des KPIs rapides avec un sélecteur entre la vue prévue et la vue réalisée.
- Tracer sur les 12 dernières semaines la distance, la durée, le dénivelé positif et le nombre de séances ; permettre d’identifier clairement l’indicateur et la série affichés.
- Garder consultables les objectifs prévus même quand un entraînement réalisé les remplace dans les totaux réalisés.
- Définir explicitement le traitement des séances annulées, déplacées, partielles ou non renseignées pour ne pas fausser les totaux.
- Règle de calcul par jour : dès qu’une activité réalisée (importée de Garmin ou saisie manuellement) existe pour une journée, utiliser les données réelles de cette journée à la place des données prévues pour les totaux réalisés ; ne jamais additionner l’activité et la séance planifiée comme deux séances.
- Prévoir le rapprochement d’activités Garmin multiples et de séances multiples le même jour afin d’éviter les doublons tout en conservant toutes les activités réellement effectuées.

**Validation :** l’accueil conserve le calendrier mensuel et ses textes actuels ; les repères distinguent clairement entraînement/course et prévu/réalisé ; les KPIs permettent de choisir prévu ou réalisé et présentent les quatre mesures sur 12 semaines ; une activité réelle, importée ou saisie, remplace le prévu dans les totaux réalisés.

### Étape 7 — Fiabiliser la version gratuite

**Statut :** à faire

- Tester les parcours principaux sur petit écran et sur iPhone/PWA.
- Tester les cas hors ligne, les erreurs de stockage, les exports invalides et les restaurations.
- Vérifier les calculs KPI avec des semaines sans activité, des entraînements incomplets, déplacés, annulés et importés, notamment le remplacement du prévu par le réalisé le même jour et le cas de plusieurs activités réelles.
- Vérifier l’accessibilité clavier, les libellés et les confirmations avant suppression.
- Documenter l’usage, les limites du stockage local et la procédure de sauvegarde.

**Validation :** les fonctions définies dans les étapes précédentes sont utilisables et les données peuvent être sauvegardées/restaurées sans perte silencieuse.

### Étape 8 — Préparer et tester la migration

**Statut :** à faire

- Stabiliser le format d’export et les identifiants des données.
- Tester la migration de données locales vers un espace de test sans écraser la sauvegarde d’origine.
- Comparer les offres gratuites de backend, leurs quotas, leur politique de pause, leurs sauvegardes et leurs conditions de confidentialité.
- Choisir le fournisseur seulement après cette comparaison.

**Validation :** une sauvegarde locale peut être migrée et vérifiée ; les limites et risques du fournisseur choisi sont compris.

### Étape 9 — Comptes et synchronisation multi-appareils

**Statut :** à faire

- Ajouter l’authentification et la synchronisation avec un backend, d’abord sur une offre gratuite.
- Imposer l’isolation des données par compte côté serveur/base de données, pas uniquement dans l’interface.
- Migrer les données locales avec confirmation et conserver un export de secours.
- Créer un compte indépendant pour un ami ; ne rien partager entre comptes sans action explicite.
- Prévoir les parcours de récupération de compte, export et suppression des données.

**Validation :** les données d’un compte ne sont jamais accessibles depuis un autre compte ; une modification se synchronise entre appareils ; l’ami dispose d’un espace autonome.

### Étape 10 — Services payants et intégrations avancées

**Statut :** à faire — seulement si le besoin est confirmé

- Évaluer un hébergement et un backend payants si les limites ou pauses de l’offre gratuite gênent l’usage.
- Décider si un nom de domaine est utile.
- Étudier l’intégration Garmin via les accès officiels et leurs conditions d’approbation ; conserver un import de fichier comme solution de repli.
- Ajouter une IA côté serveur, sans clé dans le navigateur, avec limites de dépenses configurables.
- Faire générer des propositions de séances que l’utilisateur peut examiner, modifier et valider avant leur ajout au calendrier.
- Présenter les coûts récurrents et obtenir l’accord de l’utilisateur avant d’activer tout service payant.

**Validation :** chaque service externe a un coût et une politique de données documentés ; les clés restent côté serveur ; l’utilisateur garde le contrôle sur les séances proposées et enregistrées.

## Suivi

- Mettre à jour les cases et le statut de l’étape concernée après chaque évolution notable.
- Ajouter les décisions techniques importantes et les limites découvertes dans l’étape correspondante.
- Ne pas marquer une étape terminée avant d’avoir vérifié ses critères de validation.
