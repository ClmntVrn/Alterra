# Alterra — spécification fonctionnelle

Alterra est une application web statique, mobile-first, de préparation au trail et à la montagne. Elle fonctionne sans compte ni synchronisation serveur ; les données personnelles restent dans le navigateur.

## Navigation

- Une barre d’onglets reste visible en bas de l’application : Accueil · Objectifs · Stats · IA · Profil. IA est grisé avec « Bientôt » tant qu’il n’est pas disponible.
- Changer d’onglet ne recharge pas la page et n’ajoute pas d’entrée d’historique ; chaque vue garde sa position (journée ou mois affiché, défilement). Toucher l’onglet affiché remonte en haut. L’adresse `index.html#profil` ouvre directement le Profil.
- Le Profil contient le compte, la sauvegarde (date de la dernière, export, restauration) et la version de l’application avec son historique. Son bouton rond en haut à droite change le thème : automatique (celui de l’iPhone, par défaut), clair, puis sombre ; le choix vaut pour toutes les pages de l’appareil. Une pastille orange sur l’onglet Profil signale une sauvegarde de plus de 7 jours ou absente, sauf si l’appareil s’est synchronisé ces 7 derniers jours.

## Compte et synchronisation

- L’accès demande un compte (décision du 4 novembre 2026) : sans session ouverte sur l’appareil, seul l’écran de connexion s’affiche, sans barre d’onglets. Une fois connecté, l’appareil le reste, y compris hors ligne : l’application s’ouvre directement, même sans réseau.
- Les données sont sur l’appareil et en ligne, et se retrouvent sur chaque appareil connecté.
- Connexion par e-mail et mot de passe ; il n’y a pas d’inscription depuis l’application (les comptes sont créés par l’administrateur). Un message distingue « Pas de connexion à Internet » de « Serveur injoignable » quand le réseau est présent.
- Connecté, le Profil affiche l’e-mail, l’état (« Synchronisé à 14:32 », « Hors ligne : 2 modifications en attente. », ou l’erreur) et les actions Synchroniser, Changer le mot de passe (8 caractères au moins), Se déconnecter et Supprimer mon compte en ligne. Se déconnecter, supprimer le compte ou une session refusée par le serveur ramène à l’écran de connexion ; les données restent sur l’appareil, masquées jusqu’à la prochaine connexion.
- La synchronisation se fait seule : à l’ouverture, au retour dans l’application, au retour du réseau et peu après chaque modification. Si une même donnée est modifiée sur deux appareils, la modification la plus récente l’emporte.
- À la première connexion d’un appareil qui a déjà des données, elles sont ajoutées au compte sans question (décision du 4 novembre 2026) ; l’export du Profil reste disponible avant.
- « Mot de passe oublié », sur l’écran de connexion, envoie un e-mail ; son lien rouvre Alterra (dans Safari) sur le choix d’un nouveau mot de passe, à utiliser ensuite pour se connecter dans l’application.
- L’en-tête d’un onglet tient sur une ligne : logo Alterra (retour à l’accueil d’un toucher), titre (« Alterra » sur l’accueil) et, s’il y a lieu, un bouton d’action rond à droite.
- Partout, le retour à l’écran précédent est un bouton rond avec une flèche, en haut à gauche (plein écran, fiche course, historique des versions).
- La fiche course est une page à part, sans barre d’onglets ; le bouton retour (flèche, en haut à gauche) ramène à l’écran d’où elle a été ouverte (Objectifs ou calendrier), ou à l’accueil si elle a été ouverte directement.

## Objectifs

- L’onglet Objectifs liste les courses de référence et les courses personnelles. La prochaine est mise en avant : nom et compte à rebours en grand (« J-23 », « Jour J », « En cours » pendant une course sur plusieurs jours), puis date, distance et D+ s’ils sont connus. Les autres courses à venir suivent, de la plus proche à la plus lointaine, en cartes d’une ligne : pastille de date, nom (avec la période d’une course sur plusieurs jours, distance et D+ connus) et compte à rebours.
- Une course reste à venir jusqu’à son dernier jour inclus ; les courses passées sont repliées en bas, de la plus récente à la plus ancienne.
- Toucher une course de référence ouvre sa fiche ; toucher une course personnelle ouvre sa modification en plein écran, qui permet aussi de la supprimer. Toute la carte réagit au toucher, sans sélectionner le texte. Le bouton ＋ de l’en-tête crée une course personnelle, à la date du jour par défaut.
- Une course passée, ou la prochaine dès son jour de départ, se valide (« Valider ») avec les mêmes champs qu’une sortie réalisée : type (trail ou course), distance et durée (obligatoires), D+, ressenti, FC moyenne et max, météo et notes. Elle affiche alors « ✓ Terminée » et ses chiffres réels ; toucher ce bouton les modifie ou les retire.
- Le compte à rebours suit la date du jour au retour au premier plan.

## Accueil et calendrier

- L’accueil réunit les statistiques d’activité et le calendrier.
- Le calendrier utilise les dates locales de l’appareil. Les flèches changent de mois ou de jour ; le titre du mois ouvre le sélecteur de mois et d’année natif du système (roues sur iPhone). Sur un navigateur sans sélecteur de mois natif, seules les flèches changent de mois.
- Toucher une date ouvre sa journée et ses événements.
- Dans la journée, une sortie est une carte résumée : type et état, nom, puis les chiffres clés selon le type (trail et vélo : distance, D+, durée ; course à pied : distance, allure, durée ; renforcement : durée). Une case ronde la marque réalisée d’un toucher.
- Toucher la carte ouvre le détail en plein écran : date et heure, tous les chiffres renseignés (dont ressenti, FC et météo d’une sortie réalisée), notes, puis « Réalisée », « Modifier » et « Supprimer » (sortie prévue seulement). Après une modification, on revient au détail. Les formulaires d’ajout et de modification s’ouvrent aussi en plein écran.
- Toucher une course de référence ouvre sa fiche ; toucher une course personnelle ouvre sa modification, qui permet aussi de la supprimer.
- Depuis une journée, on peut créer une sortie/entraînement ou une course personnelle. Un événement sur plusieurs jours apparaît chaque jour couvert, y compris lors d’un changement de mois ou d’année.
- Une sortie comprend un type (trail, course, renfo ou vélo, choisi d’un toucher), un nom facultatif (à défaut, le nom du type), une date, une heure facultative, une distance, une durée, un D+ et des notes. Elle n’a pas de date de fin à saisir : la fin est déduite de l’heure de début (minuit si absente) et de la durée, et une sortie qui dépasse minuit couvre les jours suivants.
- Sous la mesure, le formulaire affiche en direct la durée, l’allure moyenne (la vitesse moyenne en km/h pour le vélo, rien pour le renfo) et l’heure de fin (avec la date si elle change de jour). Le détail d’une sortie affiche de même l’allure, ou la vitesse à vélo.
- Saisie rapide : l’heure accepte 9, 930, 9h30 ou 09:30, remise au format hh:mm à la sortie du champ. La durée se saisit en deux cases, heures et minutes (pavé numérique) ; une case vide compte pour 0 et des minutes au-delà de 59 sont reportées en heures à la sortie de la case (90 min → 1 h 30). Elle est conservée en minutes entières, jusqu’à 9 999 h 59.
- La distance accepte le point ou la virgule décimale, de 0,1 à 1 000 km, avec deux décimales au maximum.
- Cocher « Séance réalisée » affiche le ressenti (1 à 10, un toucher sur la valeur choisie la désélectionne), la FC moyenne et la FC max (30 à 250 bpm, max ≥ moyenne) et la météo. Ces champs ne sont conservés que pour une sortie réalisée.
- Une sortie réalisée porte les valeurs réellement effectuées : ses champs sont modifiés directement et l’objectif prévu n’est pas conservé. Les sorties peuvent être modifiées ; les sorties prévues peuvent être supprimées.
- Une sortie prévue dont la dernière journée est passée est affichée « à vérifier ». Au calendrier, une sortie prévue a un repère creux, une sortie à vérifier un repère ambré et une sortie réalisée un repère plein.
- Une course personnelle comprend un nom et des dates de début et de fin inclusives (la fin doit être égale ou postérieure au début) ; elle peut être modifiée ou supprimée. Changer la date de début reporte la date de fin, sauf si une fin plus tardive avait été choisie.
- Les courses de référence importées apparaissent aussi au calendrier et ouvrent leur fiche. Elles sont gérées dans la sauvegarde locale ; le bouton d’ajout depuis le calendrier crée une course personnelle, pas une fiche de référence détaillée.
- Les périodes de sorties et courses sont des dates de présence, pas un découpage quotidien de la distance, du temps ou du D+. Pour les statistiques, une sortie réalisée est comptabilisée une seule fois dans la semaine de sa date de début.

## Statistiques d’activité

- Le graphique a un point par semaine (du lundi au dimanche). Il s’ouvre sur les 12 dernières semaines, semaine en cours à droite ; il défile au doigt vers les 4 semaines à venir et vers le passé jusqu’à la plus ancienne sortie enregistrée (52 semaines au plus).
- Seules les sorties marquées « réalisées » et les courses validées sont comptées ; une course validée compte comme une sortie de son type, dans la semaine de son départ. Les filtres sont Trail + course à pied (par défaut), Trail, Course à pied et Vélo.
- La semaine choisie affiche ses totaux de distance, temps, D+ et km-effort ; toucher l’un d’eux en fait l’indicateur du graphique. Le km-effort vaut distance en km + D+ en mètres / 100.
- Le réalisé est une courbe à traits droits jusqu’à la semaine en cours. Le prévu, c’est-à-dire toutes les sorties de la semaine, réalisées ou non, est un point vide quand il dépasse le réalisé, relié en tirets de la semaine en cours aux semaines à venir ; son total s’affiche à côté des dates. Une ligne en pointillés donne la moyenne des 11 dernières semaines terminées ; l’échelle est la même sur toute la période.
- On choisit une semaine en touchant sa barre ou au clavier (flèches gauche et droite).
- Les statistiques sont calculées depuis les sorties enregistrées dans Alterra ; aucune connexion à Strava ou autre service n’est intégrée.

## Onglet Stats

- Mêmes règles de comptage que l’accueil : sorties réalisées et courses validées, chacune dans la période de sa date de début.
- Le choix Semaine · Mois (par défaut) · Année et un filtre de sport : Trail + course (par défaut), Trail, Course, Vélo ou Tout.
- La période choisie affiche sa distance, son temps, son D+, ses km-effort et son nombre de sorties, chacun avec son évolution par rapport à la période précédente (▲ ou ▼ en %, « = 0 % », « — » sans sortie dans la période précédente). Pour la période en cours, la comparaison s’arrête au même jour de la période précédente (« à la même date ») : du 1er au 4 novembre contre du 1er au 4 octobre.
- Un graphique en barres montre les 12 dernières semaines, les 12 derniers mois ou les 6 dernières années sur la distance, le temps, le D+ ou les km-effort ; toucher une barre choisit sa période.
- La répartition par sport couvre tous les sports de la période choisie, quel que soit le filtre : temps et part du temps total, nombre de sorties, distance et D+.
- Les records portent sur toutes les sorties du filtre : plus longue sortie, plus gros D+, plus longue durée, meilleure semaine et meilleur mois en distance.

## Fiche de course

- Le moteur générique affiche les informations de référence disponibles : dates, départ, distance, D+, objectif et informations pratiques.
- Les blocs facultatifs sont propres à chaque fiche : profil GPX et repères, ravitaillements/scénarios horaires, nutrition, rappels, matériel, informations pratiques et sources.
- La fiche est pensée pour être lue en course, sans mode à activer. Ordre : en-tête, bloc « En course », profil, ravitos, nutrition, rappels ; matériel, informations pratiques et sources sont repliés en bas.
- Le bloc « En course » montre le prochain ravito : distance jusqu’à lui (depuis les km des ravitos), D+ et D− (calculés sur le GPX en ignorant les variations de moins de 5 m), heure de passage du scénario choisi, distance jusqu’à l’arrivée. Un grand bouton coche le ravito ; « Annuler » décoche le dernier atteint. Aucune avance ni aucun retard n’est calculé.
- Le profil d’altitude est calculé depuis le GPX associé à la course et dessiné à la largeur de l’écran, avec une échelle d’altitude ajustée au relief. La courbe est colorée selon la pente, en montée comme en descente, en tons d’orange de plus en plus foncés : clair sous 5 %, orange de 5 à 10 %, foncé à 10 % et plus ; une légende les rappelle.
- Chaque ravito a une ligne verticale et son nom au-dessus du profil ; les sections entre deux ravitos sont marquées par des fonds alternés. La carte de chaque ravito indique la section qui y mène (distance, D+, D−), calculée sur la trace.
- La partie parcourue, jusqu’au dernier ravito coché sans interruption depuis le départ, est voilée et grisée ; un trait et un point foncés marquent la position. Toucher un repère coche ou décoche son ravito. La position GPS en direct n’est pas utilisée.
- Toucher ou glisser sur le profil affiche le km, l’altitude, la pente et l’heure de passage estimée du scénario choisi (interpolée entre les temps des ravitos au prorata de la distance).
- Le bouton rond en haut à droite du bloc ouvre le profil en plein écran, toujours à l’horizontale : téléphone tenu droit, le graphe est tourné d’un quart de tour (l’orientation ne peut pas être verrouillée sur iPhone). Les chiffres de chaque section sont sous l’axe. On y zoome en pinçant (à la molette sur ordinateur) ; deux doigts déplacent la partie affichée et « Course entière » revient à tout le parcours. Le bouton retour (flèche) ferme le plein écran.
- Toute la carte d’un ravito le coche ; le prochain est encadré en orange, les ravitos passés sont réduits.
- Les cases de progression et listes de matériel sont conservées localement sur l’appareil. En tête de la liste du matériel, une case « Tout » décoche tout dès qu’un élément est coché (sinon coche tout) ; elle est partiellement cochée quand une partie seulement l’est.
- Les contenus détaillés des courses et les fichiers GPX ne sont pas livrés dans le dépôt. Une installation neuve démarre sans catalogue de courses de référence ; une sauvegarde peut les restaurer.

## Données, sauvegarde et disponibilité

- IndexedDB stocke les sorties (prévues ou réalisées), courses personnelles et de référence, plans de course et réglages ; les collections de produits de nutrition et de matériel sont prévues. La collection `activities` reste dans le format de sauvegarde pour compatibilité mais n’est pas utilisée.
- L’export produit un JSON autonome incluant les données de référence et les états locaux Alterra. À l’import, on choisit « Fusionner » ou « Remplacer tout ». La fusion ajoute ce qui manque sans rien supprimer ; pour un même identifiant ou un même état local, la donnée de l’appareil est conservée. Le remplacement efface d’abord toutes les données de l’appareil. Le format courant est la version 3 ; les formats 1 et 2 restent acceptés et sont convertis à l’import. Une sauvegarde au format 3 ne peut pas être importée dans une version d’Alterra antérieure à 0.8.15.
- Les données ne sont pas synchronisées entre appareils. La sauvegarde doit être transférée manuellement et conservée en lieu sûr.
- Le Profil indique la date de la dernière sauvegarde exportée ; le rappel est mis en avant, avec une pastille sur l’onglet Profil, lorsqu’aucune sauvegarde n’existe ou qu’elle date de 7 jours ou plus. La date est incluse dans l’export, si bien qu’une restauration reprend celle du fichier importé.
- Au démarrage, l’application demande au navigateur un stockage persistant pour limiter le risque d’effacement automatique de la base locale.
- Le manifeste permet l’installation comme application. Le service worker précache les ressources de l’application pour un usage hors ligne ; chaque changement de ressources livrées hors ligne nécessite une nouvelle version de cache.

## Règles d’interface et de contenu

- Priorité à l’usage mobile, aux libellés français lisibles, à la navigation clavier et aux attributs d’accessibilité.
- Style sobre façon apple.com : police système, cartes à plat, orange comme seul accent ; thèmes clair et sombre.
- Les composants de calendrier et de statistiques sont génériques : les données propres à une course ne sont pas codées dans le rendu partagé.
- Les données de course doivent être vérifiées ; ne pas inventer d’horaires, distances, dénivelés ou conseils sportifs.
