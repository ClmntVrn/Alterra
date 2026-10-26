# Plan de développement d’Alterra

**Mis à jour le :** 26 octobre 2026  
**État général :** version locale utilisable (0.8.7) ; suivi des entraînements et statistiques en place, nutrition et équipement à venir.

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
- [x] Base locale IndexedDB avec sauvegarde autonome (export/import JSON, format 2), rappel de la dernière sauvegarde et demande de stockage persistant.
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

- **Une sortie est un seul enregistrement** (`plannedSessions`) avec un statut `planned` ou `completed`. Une fois réalisée, ses valeurs sont les valeurs réelles : **l’objectif prévu n’est pas conservé** (décision du 26 octobre 2026, qui remplace la règle initiale « garder le prévu consultable après réalisation »).
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

### Étape 5 — Nutrition et équipement

**Statut :** à faire

- Créer un catalogue personnel de produits nutritionnels avec glucides et sodium par portion ou par gramme.
- Permettre d’ajouter et retirer des produits d’une sortie ou d’une course.
- Gérer l’équipement : chaussures, vêtements, sac et accessoires.
- Relier l’équipement aux sorties, notamment pour suivre les kilomètres cumulés des chaussures.

**Validation :** les catalogues sont modifiables par l’utilisateur, enregistrés localement et inclus dans l’export/restauration.

### Étape 6 — Tableau de bord et KPIs

**Statut :** première version réalisée

- [x] Graphique des 12 dernières semaines sur les sorties réalisées : distance, durée, D+ et km-effort.
- [x] Filtres Trail + course à pied, Trail, Course à pied, Vélo ; totaux de la semaine sélectionnée.
- [x] Repères du calendrier distinguant entraînement/course et prévu/réalisé sans reposer uniquement sur la couleur.
- [ ] Extraire les calculs KPI dans `app/domain/` et les couvrir par des tests.
- [ ] Éventuellement : nombre de sorties par semaine, comparaison avec le volume prévu.

### Étape 7 — Fiabiliser la version gratuite

**Statut :** à faire

- Ajouter des tests unitaires sans dépendance (`node --test`) pour les règles de dates, de KPI et de validation des sauvegardes.
- Tester les parcours principaux sur petit écran et sur iPhone/PWA.
- Tester les cas hors ligne, les erreurs de stockage, les exports invalides et les restaurations.
- Vérifier l’accessibilité clavier, les libellés et les confirmations avant suppression.

**Validation :** les fonctions des étapes précédentes sont utilisables et les données peuvent être sauvegardées/restaurées sans perte silencieuse.

### Étape 8 — Préparer et tester la migration

**Statut :** à faire

- Stabiliser le format d’export et les identifiants des données.
- Tester la migration de données locales vers un espace de test sans écraser la sauvegarde d’origine.
- Comparer les offres gratuites de backend, leurs quotas, leur politique de pause, leurs sauvegardes et leurs conditions de confidentialité ; choisir ensuite le fournisseur.

**Validation :** une sauvegarde locale peut être migrée et vérifiée ; les limites et risques du fournisseur choisi sont compris.

### Étape 9 — Comptes et synchronisation multi-appareils

**Statut :** à faire

- Authentification et synchronisation avec un backend, d’abord sur une offre gratuite.
- Isolation des données par compte imposée côté serveur/base de données.
- Migration des données locales avec confirmation et export de secours.
- Compte indépendant pour un ami ; rien de partagé sans action explicite.
- Récupération de compte, export et suppression des données.

**Validation :** les données d’un compte ne sont jamais accessibles depuis un autre ; une modification se synchronise entre appareils.

### Étape 10 — Services payants et intégrations avancées

**Statut :** à faire — seulement si le besoin est confirmé

- Évaluer un hébergement et un backend payants si les limites de l’offre gratuite gênent l’usage ; décider si un nom de domaine est utile.
- Étudier l’intégration Garmin (ou Strava) via les accès officiels ; conserver un import de fichier comme solution de repli. Une activité importée marque ou crée la sortie réalisée du jour.
- Ajouter une IA côté serveur, sans clé dans le navigateur, avec limites de dépenses configurables ; les séances proposées sont examinées et validées avant ajout au calendrier.
- Présenter les coûts récurrents et obtenir l’accord de l’utilisateur avant d’activer tout service payant.

**Validation :** chaque service externe a un coût et une politique de données documentés ; les clés restent côté serveur.

## Suivi

- Mettre à jour les cases et le statut de l’étape concernée après chaque évolution notable.
- Ajouter les décisions importantes dans « Décisions de référence » en datant celles qui en remplacent une autre.
- Ne pas marquer une étape terminée avant d’avoir vérifié ses critères de validation.
