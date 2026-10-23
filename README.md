# Alterra

Site statique de préparation au trail, avec calendrier et fiches de course adaptées aux écrans mobiles.

## Catalogue de courses

`races/` contient temporairement le catalogue de départ, copié dans IndexedDB au premier lancement afin de permettre un premier export autonome. Ne pas y ajouter de nouvelles données évolutives ou personnelles. Après validation d’une sauvegarde complète sur le téléphone, ces fichiers et leurs entrées de précache pourront être retirés ; les courses restaurées seront alors lues depuis la base locale.

Le modèle générique est `races/race.html` avec son script `races/race.js`. La sauvegarde embarque chaque fiche de course et son GPX, sans dépendre ensuite de fichiers de données versionnés.

Les icônes du site sont rangées dans `icon/`.

## Données personnelles sur l’appareil

La base locale comprend le catalogue complet des courses et leurs traces GPX, les plans personnels, les entraînements, activités, réglages et états de checklist. L’export est autonome : il contient les données de course de référence et privées nécessaires à la restauration, sans dépendre des JSON/GPX du dépôt. Les courses du catalogue initial y sont copiées au premier démarrage.

L’export et l’import se font depuis l’accueil. L’import remplace toutes les données Alterra de l’appareil après confirmation. Les fichiers JSON ne sont pas synchronisés automatiquement entre appareils ; conserve l’export complet dans un endroit sûr.

## Documentation du projet

- [Plan de développement](./plan.md)
- [Architecture proposée et décisions techniques](./architecture.md)