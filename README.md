# Alterra

Site statique de préparation au trail, avec calendrier et fiches de course adaptées aux écrans mobiles.

## Fiches de course

`races/` contient le modèle générique des fiches, pas de données de course. Une installation neuve démarre avec un calendrier vide ; importe une sauvegarde complète pour restaurer tes courses et leurs traces GPX.

Le modèle générique est `races/race.html` avec son script `races/race.js`. Chaque fiche de course et son GPX sont conservés dans la base locale et inclus dans la sauvegarde autonome.

Les icônes du site sont rangées dans `icon/`.

## Données personnelles sur l’appareil

La base locale comprend les fiches de course et leurs traces GPX, les plans personnels, les entraînements, activités, réglages et états de checklist. L’export est autonome : il contient les données de course de référence et privées nécessaires à la restauration, sans dépendre de fichiers de données de course dans le dépôt.

L’export et l’import se font depuis l’accueil. L’import remplace toutes les données Alterra de l’appareil après confirmation. Les fichiers JSON ne sont pas synchronisés automatiquement entre appareils ; conserve l’export complet dans un endroit sûr.

## Documentation du projet

- [Spécification fonctionnelle et règles de gestion](./SPECIFICATION.md)
- [Plan de développement](./plan.md)
- [Architecture proposée et décisions techniques](./architecture.md)