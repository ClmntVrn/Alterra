# Alterra

Application web (PWA) de préparation au trail et à la montagne, pensée pour l’iPhone : calendrier des sorties, statistiques, objectifs avec compte à rebours et fiches de course utilisables pendant la course.

## Utiliser l’application

1. Ouvrir **https://clmntvrn.github.io/Alterra/** dans Safari.
2. L’installer : bouton Partager, puis « Sur l’écran d’accueil ». Elle s’ouvre alors en plein écran, comme une app.
3. Se connecter avec son e-mail et son mot de passe. Les comptes sont créés par l’administrateur : il n’y a pas d’inscription dans l’application.

Ensuite :

- **Accueil** : graphique des dernières semaines et calendrier. Toucher un jour pour voir, ajouter ou valider une sortie ou une course.
- **Objectifs** : prochaine course et compte à rebours, puis les autres courses. Une course de référence ouvre sa fiche : profil, ravitos, scénarios de temps, nutrition, matériel.
- **Stats** : totaux par semaine, mois ou année, répartition par sport et records.
- **Profil** : compte et synchronisation, sauvegarde (export et restauration d’un fichier JSON), thème clair ou sombre, historique des versions.

Les données sont enregistrées sur l’appareil et envoyées au compte dès qu’il y a du réseau. L’application fonctionne donc hors ligne, et un autre appareil connecté au même compte retrouve les mêmes données.

## Lancer en local

Il faut [Node.js](https://nodejs.org/) (version 24 conseillée). Il ne sert qu’aux outils de développement : le site n’a pas d’étape de build.

```sh
npm install
npm start
```

Puis ouvrir l’adresse affichée (http://127.0.0.1:8000/). La connexion se fait sur le vrai compte. Les données locales de ce navigateur sont distinctes de celles de l’iPhone jusqu’à la synchronisation.

## Organisation du dépôt

```text
index.html          Application : barre d’onglets et une vue par onglet
pages/              Autres pages : fiche course (race.html), historique des versions
sw.js               Service worker : cache hors ligne (doit rester à la racine)
manifest.json       Nom, icônes et couleurs de l’app installée
assets/icons/       Icônes de l’application
styles/             CSS : variables (tokens.css), base, mise en page, composants, fonctionnalités
src/
  pages/            Point d’entrée de chaque page (home.js, race.js…)
  features/         Une fonctionnalité par dossier : calendrier, séances, courses, objectifs…
  domain/           Règles pures (dates, statistiques, format de sauvegarde), sans écran ni stockage
  storage/          Base locale IndexedDB, synchronisation Supabase, sauvegarde
  ui/               Utilitaires d’affichage partagés (formats français, onglets, thème)
tests/              Tests unitaires ; tests/browser/ : parcours dans un vrai navigateur
tools/              Outils de développement : serveur local, nouvelle version, données en ligne
supabase/           Schéma de la base en ligne (table records, accès limité à son compte)
docs/               Spécification, feuille de route, architecture, historique
```

À la racine restent aussi les fichiers que les outils n’y cherchent qu’à cet endroit : `package.json` (scripts, dépendances de développement et réglages Prettier), `eslint.config.js`, `.editorconfig`, `.gitignore`, `.gitattributes` et `.git-blame-ignore-revs`.

## Gestion du dépôt

### Commandes

| Commande                                       | Rôle                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `npm start`                                    | Lance l’application en local.                                            |
| `npm run check`                                | Formatage (Prettier), lint (ESLint) et tests unitaires.                  |
| `npm run format`                               | Reformate le code.                                                       |
| `npm run test:browser`                         | Parcours dans Chrome ou Edge sans interface, sur données fictives.       |
| `npm run release -- 0.8.42 "Ligne."`           | Prépare une version : numéros, historique, cache hors ligne, puis check. |
| `npm run data -- list \| get \| put \| delete` | Lit ou modifie les données réelles du compte (voir plus bas).            |

### Livrer une version

1. Faire la modification, puis lancer `npm run check` et, pour un changement d’écran ou de stockage, `npm run test:browser`.
2. Ajouter tout nouveau fichier livré à la liste `FILES` de `sw.js` (un test le vérifie).
3. `npm run release -- <version> "Ligne d’historique."` : met le numéro à jour dans `package.json`, le Profil, `pages/versions.html` et le nom du cache de `sw.js`. Il ne commite pas.
4. Commiter et pousser sur `main`. GitHub Pages publie le site. GitHub Actions relance les vérifications (onglet Actions) sans bloquer la publication.

À la réouverture de l’app, l’iPhone télécharge la nouvelle version.

### Données réelles du compte

`npm run data` se connecte au compte avec les identifiants de `.env.local` :

```sh
ALTERRA_EMAIL=...
ALTERRA_PASSWORD=...
```

`get` enregistre un enregistrement dans `.local/<collection>/<id>.json`. `put` renvoie ce fichier, une fois modifié. Ces deux emplacements ne sont jamais versionnés et `.local/` peut être vidé à tout moment.

### Confidentialité

Le dépôt est public. Il ne contient ni donnée personnelle, ni donnée de course, ni trace GPX, ni sauvegarde, ni secret. Les fiches de course et leurs GPX vivent dans la base de l’appareil et du compte. Seules l’adresse et la clé publique du projet Supabase sont dans le code (`src/storage/supabase-config.js`), car elles sont faites pour l’être.

## Documentation

- [Spécification fonctionnelle et règles de gestion](./docs/specification.md)
- [Feuille de route](./docs/roadmap.md)
- [Architecture et décisions techniques](./docs/architecture.md)
- [Historique des étapes terminées](./docs/historique.md)
- [Consignes pour Claude](./CLAUDE.md)
