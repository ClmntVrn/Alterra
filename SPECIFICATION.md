# Alterra — spécification fonctionnelle

Alterra est une application web statique, mobile-first, de préparation au trail et à la montagne. Elle fonctionne sans compte ni synchronisation serveur ; les données personnelles restent dans le navigateur.

## Accueil et calendrier

- L’accueil réunit les statistiques d’activité, le calendrier et les commandes de sauvegarde.
- Le calendrier utilise les dates locales de l’appareil. Les flèches changent de mois ou de jour ; le titre du mois ouvre un sélecteur de mois et d’année.
- Toucher une date ouvre sa journée et ses événements.
- Depuis une journée, on peut créer une sortie/entraînement ou une course personnelle. Chaque événement a une date de début et une date de fin inclusives ; il apparaît chaque jour couvert, y compris lors d’un changement de mois ou d’année.
- Les plages sont contrôlées : la fin doit être égale ou postérieure au début.
- Une sortie comprend un nom, un type (trail, course à pied, renforcement ou vélo), une heure facultative, une distance facultative, une durée facultative, un D+, une météo et des notes. Elle peut être marquée comme réalisée. Les sorties peuvent être modifiées ; les sorties prévues peuvent être supprimées.
- Une sortie réalisée porte les valeurs réellement effectuées : ses champs sont modifiés directement et l’objectif prévu n’est pas conservé.
- La distance accepte le point ou la virgule décimale, de 0,1 à 1 000 km, avec deux décimales au maximum. La durée est saisie en heures et minutes (jusqu’à 9 999 h et 59,9 min) et conservée comme un nombre de minutes. L’allure moyenne est calculée lorsque distance et durée sont valides.
- Une course personnelle comprend un nom et des dates ; elle peut être modifiée ou supprimée.
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
- Le profil d’altitude est calculé depuis le GPX associé à la course. Les repères peuvent synchroniser la progression avec les ravitaillements.
- Les cases de progression et listes de matériel sont conservées localement sur l’appareil.
- Les contenus détaillés des courses et les fichiers GPX ne sont pas livrés dans le dépôt. Une installation neuve démarre sans catalogue de courses de référence ; une sauvegarde peut les restaurer.

## Données, sauvegarde et disponibilité

- IndexedDB stocke les sorties (prévues ou réalisées), courses personnelles et de référence, plans de course et réglages ; les collections de produits de nutrition et de matériel sont prévues. La collection `activities` reste dans le format de sauvegarde pour compatibilité mais n’est pas utilisée.
- L’export produit un JSON autonome incluant les données de référence et les états locaux Alterra. L’import, après confirmation, remplace toutes les données de l’appareil. Le format courant est la version 2 ; le format 1 reste accepté.
- Les données ne sont pas synchronisées entre appareils. La sauvegarde doit être transférée manuellement et conservée en lieu sûr.
- L’accueil indique la date de la dernière sauvegarde exportée ; le rappel est mis en avant lorsqu’aucune sauvegarde n’existe ou qu’elle date de 7 jours ou plus. La date est incluse dans l’export, si bien qu’une restauration reprend celle du fichier importé.
- Au démarrage, l’application demande au navigateur un stockage persistant pour limiter le risque d’effacement automatique de la base locale.
- Le manifeste permet l’installation comme application. Le service worker précache les ressources de l’application pour un usage hors ligne ; chaque changement de ressources livrées hors ligne nécessite une nouvelle version de cache.

## Règles d’interface et de contenu

- Priorité à l’usage mobile, aux libellés français lisibles, à la navigation clavier et aux attributs d’accessibilité.
- Les composants de calendrier et de statistiques sont génériques : les données propres à une course ne sont pas codées dans le rendu partagé.
- Les données de course doivent être vérifiées ; ne pas inventer d’horaires, distances, dénivelés ou conseils sportifs.
