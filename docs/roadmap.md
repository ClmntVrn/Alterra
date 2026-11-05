# Plan de développement d’Alterra

**Mis à jour le :** 5 novembre 2026  
**État général :** version locale utilisable (0.8.28) ; entraînements, statistiques et onglet Stats, barre d’onglets, objectifs, courses validées et thème sombre en place, retours iPhone attendus sur les étapes 6 à 8 et les retours du 2 novembre. Prochaines étapes : ajout d’une course depuis l’application (fusion course et fiche), puis nutrition et équipement.

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
- [x] Barre d’onglets (Accueil, Objectifs, Stats, Profil ; IA à venir), onglet Objectifs avec compte à rebours et onglet Stats.
- [ ] Ajout d’une fiche de course complète depuis l’application.
- [ ] Nutrition et équipement personnels.
- [x] Compte et synchronisation multi-appareils (Supabase, 0.8.30).
- [ ] Intégrations (Garmin, IA).

## Décisions de référence

### Données et confidentialité

- Usage personnel d’abord ; un ami pourra plus tard utiliser Alterra avec son propre espace, sans partage implicite.
- Aucune donnée personnelle envoyée automatiquement à GitHub ou synchronisée pendant la phase locale. Les fiches de course et GPX ne sont pas dans le dépôt : elles vivent dans la base locale et la sauvegarde.
- Les données personnelles Mallorca ont déjà été poussées dans le dépôt public et peuvent rester visibles dans l’historique Git. Ne pas y ajouter d’informations privées ; toute purge d’historique sera évaluée séparément.
- Suppression d’une entrée avec confirmation. L’import propose de fusionner (ajout de ce qui manque, l’appareil l’emporte) ou de tout remplacer (2 novembre 2026).
- Unités : km, mètres de D+, durée en minutes (saisie en deux cases heures et minutes), allure en min/km, vitesse en km/h pour le vélo.

### Sorties prévues et réalisées

- **Une sortie est un seul enregistrement** (`workouts`, anciennement `plannedSessions`) avec un statut `planned` ou `completed`. Une fois réalisée, ses valeurs sont les valeurs réelles : **l’objectif prévu n’est pas conservé** (décision du 26 octobre 2026, qui remplace la règle initiale « garder le prévu consultable après réalisation »).
- La collection `activities` n’est pas utilisée. Elle reste dans le format de sauvegarde pour compatibilité ; un futur import (Garmin, GPX) marquera ou créera directement une sortie réalisée plutôt qu’une activité séparée.
- Types de sortie : trail, course à pied, renforcement musculaire, vélo. Météo : une catégorie au choix (ensoleillé, nuageux, pluie, neige, vent, orage).
- Une sortie n’a qu’une date de début saisie ; sa date de fin est calculée depuis l’heure et la durée (26 octobre 2026). Une sortie prévue dont la date est passée est « à vérifier », sans être déclarée manquée.
- Ressenti, FC et météo ne sont enregistrés que sur une sortie réalisée.
- Une sortie prévue peut être supprimée ; une sortie réalisée ne l’est pas depuis le calendrier (repasser d’abord en « prévu »).
- Les statistiques ne comptent que les sorties réalisées, une seule fois, dans la semaine de leur date de début, ainsi que les courses validées avec leurs chiffres de montre (champ `result` sur la course, 2 novembre 2026).
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

### Retours d’usage du 2 novembre 2026

**Statut :** réalisés en 0.8.25 — à vérifier sur iPhone

- [x] Toute la carte d’une course ou séance réagit au toucher, sans sélectionner le titre.
- [x] La date de fin d’une nouvelle course suit sa date de début.
- [x] Courses passées validables avec les mêmes champs qu’une séance réalisée (distance, durée, D+, ressenti, FC, météo, notes), comptées dans les statistiques (0.8.26).
- [x] Matériel : case « Tout » en tête de liste à la place du bouton de réinitialisation en bas.
- [x] Import au choix : fusionner (l’appareil l’emporte) ou tout remplacer.
- [x] Style façon apple.com (orange gardé) et thème sombre ; thème de l’iPhone par défaut, bouton dans le Profil.
- [x] Durée saisie en deux cases heures et minutes ; vitesse en km/h pour le vélo à la place de l’allure (0.8.27).
- [x] Statistiques de l’accueil sur une carte normale, sans bandeau sombre ni relief de montagne (0.8.29).
- [ ] À vérifier sur iPhone : barre d’état en appli installée (clair et sombre), lisibilité du sombre dehors, toucher des cartes, import d’une vraie sauvegarde en fusion.

### Graphe de course (5 novembre 2026)

**Statut :** réalisé en 0.8.33 à 0.8.35 — à vérifier sur iPhone

Inspiré de LiveTrail (ravitos et sections) et des apps de trail qui colorent la pente (Footpath, Intervals.icu, Ultra-Trails).

- [x] Échelle d’altitude ajustée au relief (point haut retiré de la légende en 0.8.36).
- [x] Courbe colorée selon la pente, en tons d’orange de plus en plus foncés (vert, jaune, rouge essayés en 0.8.33, remplacés en 0.8.35 à la demande de l’utilisateur).
- [x] Ravitos en lignes verticales nommées ; section qui mène à chaque ravito (distance, D+, D−) dans sa carte et, en plein écran, sous l’axe (liste sous le profil retirée en 0.8.35, redondante avec le bloc « En course »).
- [x] Lecture au doigt : km, altitude, pente, passage estimé du scénario.
- [x] Plein écran toujours à l’horizontale (tourné si le téléphone est tenu droit), zoom à deux doigts (décision de l’utilisateur) et retour à la course entière.
- [ ] À vérifier sur iPhone : pincer pour zoomer, glisser sans gêner le défilement, plein écran en paysage (encoche), lisibilité dehors et de nuit.

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

**Statut :** onglet Stats réalisé en 0.8.28 — à vérifier sur iPhone

- [x] Graphique des 12 dernières semaines sur les sorties réalisées : distance, durée, D+ et km-effort.
- [x] Filtres Trail + course à pied, Trail, Course à pied, Vélo ; totaux de la semaine sélectionnée.
- [x] Repères du calendrier distinguant entraînement/course et prévu/réalisé sans reposer uniquement sur la couleur.
- [x] Calculs KPI extraits dans `src/domain/statistics.js` et couverts par des tests.
- [x] Onglet Stats (0.8.28) : semaine, mois ou année avec totaux et nombre de sorties, évolution par rapport à la période précédente (à la même date pour la période en cours), barres pour choisir la période, répartition par sport et records. Le graphique 12 semaines reste à l’accueil (décision du 4 novembre 2026).
- [x] Graphique de l’accueil (0.8.37 à 0.8.39) : courbe à traits droits du réalisé, prévu en tirets, moyenne en pointillés, chiffres de la semaine qui choisissent l’indicateur ; 12 dernières semaines à l’ouverture, défilement au doigt vers les 4 semaines à venir et le passé (52 semaines au plus). Barres essayées en 0.8.37–0.8.38, courbe préférée par l’utilisateur.
- [ ] À vérifier sur iPhone : lisibilité des barres et des évolutions, défilement des filtres si la police est plus large, défilement horizontal du graphique de l’accueil sans gêner le défilement de la page.

### Étape 12 — Fiabiliser la version gratuite

**Statut :** à faire

- [x] Tests unitaires `node --test` des dates, durées, séances, KPI et de la validation des sauvegardes.
- Tester les parcours principaux sur petit écran et sur iPhone/PWA.
- Tester les cas hors ligne, les erreurs de stockage, les exports invalides et les restaurations.
- Vérifier l’accessibilité clavier, les libellés et les confirmations avant suppression.

**Validation :** les fonctions des étapes précédentes sont utilisables et les données peuvent être sauvegardées/restaurées sans perte silencieuse.

### Étape 13 — Préparer et tester la migration

**Statut :** fournisseur choisi le 4 novembre 2026 (Supabase) — migration réelle à vérifier

- Stabiliser le format d’export et les identifiants des données.
- Tester la migration de données locales vers un espace de test sans écraser la sauvegarde d’origine.
- [x] Offres comparées (Supabase, Firebase) : Supabase retenu (500 Mo, comptes inclus, GPX dans les lignes ; pause après 7 jours d’inactivité, pas de sauvegarde automatique). Firebase écarté : 1 Mo par document et stockage de fichiers payant.
- [x] Première connexion : données de l’appareil fusionnées avec le compte (0.8.30 ; sans téléchargement depuis 0.8.31, sans confirmation depuis 0.8.32).
- [ ] À vérifier : migration de la vraie base sur iPhone.

**Validation :** une sauvegarde locale peut être migrée et vérifiée ; les limites et risques du fournisseur choisi sont compris.

### Étape 14 — Comptes et synchronisation multi-appareils

**Statut :** réalisée en 0.8.30 — à vérifier sur iPhone avec le vrai projet

Décisions du 4 novembre 2026 : connexion par e-mail et mot de passe ; inscription libre fermée ; adresse et clé publique Supabase dans le dépôt (la clé `service_role` jamais).

- [x] Connexion, déconnexion, changement et oubli du mot de passe dans le Profil.
- [x] Synchronisation hors ligne d’abord : file d’envoi locale, récupération des nouveautés, modification la plus récente gagnante.
- [x] Isolation des données par compte imposée par la base (RLS, `supabase/schema.sql`).
- [x] Migration des données locales à la première connexion, sans question depuis 0.8.32 (l’export de secours se fait avant, depuis le Profil : le téléchargement automatique coupait la connexion sur iPhone).
- [x] Connexion obligatoire : écran de connexion au lancement sans session, session gardée hors ligne (0.8.31, décision du 4 novembre 2026).
- [x] Suppression du compte et de ses données en ligne ; l’export reste disponible.
- [ ] Compte pour un ami, créé depuis le tableau de bord.
- [x] Connexion dans l’app installée sur iPhone (4 novembre 2026).
- [ ] À vérifier sur iPhone : synchronisation entre deux appareils, lien de mot de passe oublié.

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
