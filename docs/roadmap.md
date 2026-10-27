# Plan de développement d’Alterra

**Mis à jour le :** 27 octobre 2026  
**État général :** version locale utilisable (0.8.23) ; entraînements, statistiques, barre d’onglets et objectifs en place, retours iPhone attendus sur les étapes 6 à 8. Prochaines étapes : ajout d’une course depuis l’application (fusion course et fiche), puis nutrition et équipement.

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
- [x] Fiches de course génériques : profil GPX, ravitos, scénarios, nutrition, rappels, matériel, sources ; bloc « En course » pour suivre la progression.
- [x] Barre d’onglets (Accueil, Objectifs, Profil ; Stats et IA à venir) et onglet Objectifs avec compte à rebours.
- [ ] Ajout d’une fiche de course complète depuis l’application.
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

### Étapes 1 à 5 — terminées

Cadrage, stockage local et sauvegarde, entraînements et courses, vue jour simplifiée (22 au 27 octobre 2026, jusqu’à 0.8.17). Détail dans [l’historique](./historique.md).

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

**Statut :** réalisée en 0.8.20 — à vérifier sur iPhone

Décisions du 27 octobre 2026 : une seule page avec des vues ; l’accueil garde statistiques et calendrier ; onglet Stats séparé, grisé jusqu’à l’étape 11 (graphique et totaux par année, mois…) ; Objectifs et IA visibles en grisé pour se représenter l’application (IA pourra être retiré en attendant l’étape 15) ; Profil simple et rapide.

- [x] Barre d’onglets fixe en bas, tenant compte de la barre d’accueil de l’iPhone : Accueil · Objectifs · Stats · IA · Profil ; onglet actif en orange et `aria-current` ; onglets à venir grisés avec « Bientôt ».
- [x] Vues sans rechargement ni entrée d’historique, position conservée ; `#profil` ouvre le Profil.
- [x] Profil : sauvegarde (déplacée depuis l’accueil) et version avec l’historique ; pastille sur l’onglet quand une sauvegarde est à faire.
- [x] Fiche course sans barre d’onglets.
- [ ] À vérifier sur iPhone : barre au-dessus de la barre d’accueil en appli installée, haut de l’écran (encoche), pastille du Profil.

**Validation :** chaque onglet s’ouvre d’un toucher, y compris hors ligne, sans perte de position sur l’accueil ; la barre ne masque aucun contenu.

### Étape 8 — Objectifs

**Statut :** réalisée en 0.8.21, retouchée en 0.8.22 — à vérifier sur iPhone

Décisions du 27 octobre 2026 : l’onglet ne liste que les courses ; compte à rebours en jours (« J-23 ») ; les autres objectifs datés sont reportés.

- [x] Onglet Objectifs actif : prochaine course mise en avant (compte à rebours en grand, date, distance et D+ connus), puis les autres courses à venir ; courses passées repliées.
- [x] Une fiche de référence ouvre sa page ; une course personnelle s’ouvre en plein écran pour être modifiée ou supprimée ; le bouton ＋ la crée à la date du jour.
- [x] Aucune nouvelle donnée : les courses existantes sont reprises, la sauvegarde ne change pas.
- [x] Retours du 27 octobre (0.8.22) : cartes réorganisées (compte à rebours à droite, chiffres clés, pastille de date), en-tête d’une ligne avec logo (retour à l’accueil) et bouton ＋, bouton retour (flèche) sur la fiche course vers l’écran précédent. En 0.8.23 : même bouton retour rond partout (plein écran, historique), accueil titré « Alterra » sans phrase d’accroche.
- [ ] À vérifier sur iPhone : lecture du compte à rebours, ajout et modification depuis l’onglet.
- [ ] Plus tard : autres objectifs datés (fin de programme, test…), avec un nom, une date et une note, visibles aussi au calendrier par un repère discret.

**Validation :** depuis l’onglet, on voit d’un coup d’œil le nombre de jours avant la prochaine course, et on ajoute, modifie ou supprime une course sur le téléphone.

### Étape 9 — Ajout d’une course depuis l’application

**Statut :** à faire

Aujourd’hui une fiche de course n’arrive que par restauration d’une sauvegarde.

- Créer et modifier une fiche depuis le téléphone : nom, dates, lieu, distance, D+, import du fichier GPX, liste des ravitos (nom, km).
- Les blocs facultatifs (nutrition, rappels, matériel, sources) restent ajoutables plus tard ; aucune valeur inventée.
- Lien entre la course et l’onglet Objectifs ; ajout possible au calendrier.
- Décidé le 27 octobre 2026 : une seule notion de course pour l’utilisateur, la course du calendrier est sa fiche (fusion de `personalRace` et `raceSheet`).
- À trancher : champs obligatoires ; conversion des courses et fiches déjà enregistrées.

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

Chantier R1 à R8 terminé le 26 octobre 2026 (0.8.8 à 0.8.16) : outils, domaine testé, arborescence, découpage du calendrier et de la fiche, feuilles de styles, renommage des données, automatisation. Détail dans [l’historique](./historique.md).

## Suivi

- Mettre à jour les cases et le statut de l’étape concernée après chaque évolution notable.
- Une fois une étape terminée et vérifiée sur iPhone, déplacer son détail dans [l’historique](./historique.md) et n’en garder qu’une ligne ici.
- Ajouter les décisions importantes dans « Décisions de référence » en datant celles qui en remplacent une autre.
- Ne pas marquer une étape terminée avant d’avoir vérifié ses critères de validation.
