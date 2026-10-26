# Alterra

Site statique de préparation au trail, avec calendrier et fiches de course adaptées aux écrans mobiles.

## Fiches de course

Le dépôt contient le modèle générique des fiches, pas de données de course. Une installation neuve démarre avec un calendrier vide ; importe une sauvegarde complète pour restaurer tes courses et leurs traces GPX.

Le modèle générique est `race.html` avec son script `src/pages/race.js`. Chaque fiche de course et son GPX sont conservés dans la base locale et inclus dans la sauvegarde autonome.

Le code est dans `src/`, la feuille de styles dans `styles/` et les icônes dans `assets/icons/`.

## Données personnelles sur l’appareil

La base locale comprend les fiches de course et leurs traces GPX, les plans personnels, les sorties (prévues ou réalisées), réglages et états de checklist. L’export est autonome : il contient les données de course de référence et privées nécessaires à la restauration, sans dépendre de fichiers de données de course dans le dépôt.

L’export et l’import se font depuis l’accueil. L’import remplace toutes les données Alterra de l’appareil après confirmation. Les fichiers JSON ne sont pas synchronisés automatiquement entre appareils ; conserve l’export complet dans un endroit sûr.

## Développement

Node.js ne sert qu’aux outils de développement : le site n’a pas d’étape de build.

- `npm run check` : formatage, lint et tests unitaires.
- `npm run test:browser` : parcours dans Chrome ou Edge sans interface, sur données fictives.
- `npm run release -- 0.8.17 "Ligne d’historique."` : nouvelle version (numéro, historique, cache hors ligne).

À chaque push, GitHub relance ces vérifications (onglet Actions) ; elles ne bloquent pas la publication du site.

## Documentation du projet

- [Spécification fonctionnelle et règles de gestion](./docs/specification.md)
- [Plan de développement](./docs/roadmap.md)
- [Architecture et décisions techniques](./docs/architecture.md)
