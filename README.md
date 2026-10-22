# Alterra

Site statique de préparation au trail, avec calendrier et fiches de course adaptées aux écrans mobiles.

## Ajouter une course

1. Créer un JSON de course dans `races/` avec un identifiant unique, le nom, la date (`AAAA-MM-JJ`), le résumé de calendrier, le départ, la distance et le D+.
2. Ajouter dans `races/index.json` une entrée qui associe cet identifiant au chemin du JSON.
3. Ajouter les sections seulement si les données sont disponibles : `profile`, `scenarios` et `checkpoints`, `nutrition`, `reminders`, `practicalInfo`, `gear`, `sources`, `distanceNote` et `footer`. Les points de course peuvent être listés sans horaires ni scénarios ; la fiche générique masque les sections absentes.
4. Pour afficher le profil d’altitude, ranger le fichier GPX dans `races/gpx/` et renseigner son chemin dans `profile.gpx`. La fiche lit la trace, dessine le profil et place les repères en fonction des kilomètres indiqués dans les ravitos.
5. Ajouter les nouveaux fichiers de données (JSON, GPX et autres ressources) au précache `FILES` dans `sw.js`, puis incrémenter `CACHE_NAME`.

Le modèle générique est `races/race.html` avec son script `races/race.js`. Le calendrier et la fiche utilisent le même catalogue ; les détails propres à une course restent dans son fichier JSON. Les textes et conseils de course doivent être vérifiés, pas déduits automatiquement.

Les icônes du site sont rangées dans `icon/`.

## Documentation du projet

- [Plan de développement](./plan.md)
- [Architecture proposée et décisions techniques](./architecture.md)