# Alterra — spécification fonctionnelle

Alterra est une application web statique, mobile-first, de préparation au trail et à la montagne. Elle fonctionne sans compte ni synchronisation serveur ; les données personnelles restent dans le navigateur.

## Navigation

- Une barre d’onglets reste visible en bas de l’application : Accueil · Objectifs · Stats · IA · Profil. Stats et IA sont grisés avec « Bientôt » tant qu’ils ne sont pas disponibles.
- Changer d’onglet ne recharge pas la page et n’ajoute pas d’entrée d’historique ; chaque vue garde sa position (journée ou mois affiché, défilement). Toucher l’onglet affiché remonte en haut. L’adresse `index.html#profil` ouvre directement le Profil.
- Le Profil contient la sauvegarde (date de la dernière, export, restauration) et la version de l’application avec son historique. Une pastille orange sur l’onglet Profil signale une sauvegarde de plus de 7 jours ou absente.
- L’en-tête d’un onglet tient sur une ligne : logo Alterra (retour à l’accueil d’un toucher), titre (« Alterra » sur l’accueil) et, s’il y a lieu, un bouton d’action rond à droite.
- Partout, le retour à l’écran précédent est un bouton rond avec une flèche, en haut à gauche (plein écran, fiche course, historique des versions).
- La fiche course est une page à part, sans barre d’onglets ; le bouton retour (flèche, en haut à gauche) ramène à l’écran d’où elle a été ouverte (Objectifs ou calendrier), ou à l’accueil si elle a été ouverte directement.

## Objectifs

- L’onglet Objectifs liste les courses de référence et les courses personnelles. La prochaine est mise en avant : nom et compte à rebours en grand (« J-23 », « Jour J », « En cours » pendant une course sur plusieurs jours), puis date, distance et D+ s’ils sont connus. Les autres courses à venir suivent, de la plus proche à la plus lointaine, en cartes d’une ligne : pastille de date, nom (avec la période d’une course sur plusieurs jours, distance et D+ connus) et compte à rebours.
- Une course reste à venir jusqu’à son dernier jour inclus ; les courses passées sont repliées en bas, de la plus récente à la plus ancienne.
- Toucher une course de référence ouvre sa fiche ; toucher une course personnelle ouvre sa modification en plein écran, qui permet aussi de la supprimer. Le bouton ＋ de l’en-tête crée une course personnelle, à la date du jour par défaut.
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
- Sous la mesure, le formulaire affiche en direct la durée, l’allure moyenne et l’heure de fin (avec la date si elle change de jour).
- Saisie rapide : l’heure accepte 9, 930, 9h30 ou 09:30 ; la durée accepte 45 (minutes), 90 ou 90min (1:30), 130, 1h30 ou 1:30 (1 h 30) et 1020 (10 h 20). Les champs sont remis au format h:mm à la sortie du champ. La durée est conservée en minutes entières, jusqu’à 9 999 h 59.
- La distance accepte le point ou la virgule décimale, de 0,1 à 1 000 km, avec deux décimales au maximum.
- Cocher « Séance réalisée » affiche le ressenti (1 à 10, un toucher sur la valeur choisie la désélectionne), la FC moyenne et la FC max (30 à 250 bpm, max ≥ moyenne) et la météo. Ces champs ne sont conservés que pour une sortie réalisée.
- Une sortie réalisée porte les valeurs réellement effectuées : ses champs sont modifiés directement et l’objectif prévu n’est pas conservé. Les sorties peuvent être modifiées ; les sorties prévues peuvent être supprimées.
- Une sortie prévue dont la dernière journée est passée est affichée « à vérifier ». Au calendrier, une sortie prévue a un repère creux, une sortie à vérifier un repère ambré et une sortie réalisée un repère plein.
- Une course personnelle comprend un nom et des dates de début et de fin inclusives (la fin doit être égale ou postérieure au début) ; elle peut être modifiée ou supprimée.
- Les courses de référence importées apparaissent aussi au calendrier et ouvrent leur fiche. Elles sont gérées dans la sauvegarde locale ; le bouton d’ajout depuis le calendrier crée une course personnelle, pas une fiche de référence détaillée.
- Les périodes de sorties et courses sont des dates de présence, pas un découpage quotidien de la distance, du temps ou du D+. Pour les statistiques, une sortie réalisée est comptabilisée une seule fois dans la semaine de sa date de début.

## Statistiques d’activité

- Le graphique couvre les 12 semaines commençant le lundi, semaine actuelle incluse.
- Seules les sorties marquées « réalisées » sont comptées. Les filtres sont Trail + course à pied (par défaut), Trail, Course à pied et Vélo.
- L’indicateur sélectionnable est la distance, la durée, le D+ ou le km-effort. Le km-effort vaut distance en km + D+ en mètres / 100.
- Sélectionner une semaine affiche ses totaux de distance, temps et D+. Le graphique indique à droite les valeurs de son échelle verticale.
- Les statistiques sont calculées depuis les sorties enregistrées dans Alterra ; aucune connexion à Strava ou autre service n’est intégrée.

## Fiche de course

- Le moteur générique affiche les informations de référence disponibles : dates, départ, distance, D+, objectif et informations pratiques.
- Les blocs facultatifs sont propres à chaque fiche : profil GPX et repères, ravitaillements/scénarios horaires, nutrition, rappels, matériel, informations pratiques et sources.
- La fiche est pensée pour être lue en course, sans mode à activer. Ordre : en-tête, bloc « En course », profil, ravitos, nutrition, rappels ; matériel, informations pratiques et sources sont repliés en bas.
- Le bloc « En course » montre le prochain ravito : distance jusqu’à lui (depuis les km des ravitos), D+ et D− (calculés sur le GPX en ignorant les variations de moins de 5 m), heure de passage du scénario choisi, distance jusqu’à l’arrivée. Un grand bouton coche le ravito ; « Annuler » décoche le dernier atteint. Aucune avance ni aucun retard n’est calculé.
- Le profil d’altitude est calculé depuis le GPX associé à la course et dessiné à la largeur de l’écran. La partie parcourue, jusqu’au dernier ravito coché sans interruption depuis le départ, est remplie en orange ; une ligne marque la position. Toucher un repère coche ou décoche son ravito. La position GPS en direct n’est pas utilisée.
- Toute la carte d’un ravito le coche ; le prochain est encadré en orange, les ravitos passés sont réduits.
- Les cases de progression et listes de matériel sont conservées localement sur l’appareil.
- Les contenus détaillés des courses et les fichiers GPX ne sont pas livrés dans le dépôt. Une installation neuve démarre sans catalogue de courses de référence ; une sauvegarde peut les restaurer.

## Données, sauvegarde et disponibilité

- IndexedDB stocke les sorties (prévues ou réalisées), courses personnelles et de référence, plans de course et réglages ; les collections de produits de nutrition et de matériel sont prévues. La collection `activities` reste dans le format de sauvegarde pour compatibilité mais n’est pas utilisée.
- L’export produit un JSON autonome incluant les données de référence et les états locaux Alterra. L’import, après confirmation, remplace toutes les données de l’appareil. Le format courant est la version 3 ; les formats 1 et 2 restent acceptés et sont convertis à l’import. Une sauvegarde au format 3 ne peut pas être importée dans une version d’Alterra antérieure à 0.8.15.
- Les données ne sont pas synchronisées entre appareils. La sauvegarde doit être transférée manuellement et conservée en lieu sûr.
- Le Profil indique la date de la dernière sauvegarde exportée ; le rappel est mis en avant, avec une pastille sur l’onglet Profil, lorsqu’aucune sauvegarde n’existe ou qu’elle date de 7 jours ou plus. La date est incluse dans l’export, si bien qu’une restauration reprend celle du fichier importé.
- Au démarrage, l’application demande au navigateur un stockage persistant pour limiter le risque d’effacement automatique de la base locale.
- Le manifeste permet l’installation comme application. Le service worker précache les ressources de l’application pour un usage hors ligne ; chaque changement de ressources livrées hors ligne nécessite une nouvelle version de cache.

## Règles d’interface et de contenu

- Priorité à l’usage mobile, aux libellés français lisibles, à la navigation clavier et aux attributs d’accessibilité.
- Les composants de calendrier et de statistiques sont génériques : les données propres à une course ne sont pas codées dans le rendu partagé.
- Les données de course doivent être vérifiées ; ne pas inventer d’horaires, distances, dénivelés ou conseils sportifs.
