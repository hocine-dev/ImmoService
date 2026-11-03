# ImmoService

API du projet Web Services : Express 5, TypeScript strict, PostgreSQL 17 avec Docker, Prisma 7 et validation Zod.

Le modèle immobilier du TP1 est repris et adapté : retrait des tables Better Auth, ajout de `passwordHash`, de `Photo.alt` et du modèle `Reponse`. La migration initiale est versionnée.

Les routes actuellement disponibles sont `GET /health` et `GET /annonces`. L'authentification, les autres opérations métier, OpenAPI et les tests restent à développer.

## Démarrage depuis un clone neuf

Prérequis : Node.js **22.12+** (Node 22 recommandé, `.nvmrc` fourni), npm et Docker Compose.

```bash
npm ci
cp .env.example .env
```

Conserver un `.env` local existant au lieu de le remplacer. Dans `.env` :

- Choisir les mots de passe PostgreSQL et mettre à jour les deux URL correspondantes. Encoder les caractères réservés des mots de passe dans les URL PostgreSQL.
- Renseigner les cinq comptes `SEED_*` avec des adresses distinctes et des mots de passe d'au moins **12 caractères**. Toutes les valeurs fournies dans `.env.example` sont fictives et doivent être adaptées localement.

```bash
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Serveur : http://localhost:3001. Vérifier le démarrage avec http://localhost:3001/health. La route `/` n'est pas définie et renvoie `Cannot GET /`.

PostgreSQL utilise les ports locaux `5433` pour le développement et `5434` pour les tests, avec des bases et volumes distincts. Adapter les ports et les URL dans `.env` si nécessaire. Le serveur Node est lancé sur la machine hôte ; Docker Compose démarre uniquement PostgreSQL.

## Données de démonstration

`npm run db:seed` prépare **5 comptes** : un ADMIN, deux AGENT distincts et deux USER. Les adresses et mots de passe sont définis par `SEED_ADMIN_*`, `SEED_AGENT_1_*`, `SEED_AGENT_2_*`, `SEED_USER_1_*` et `SEED_USER_2_*` dans `.env`.

Le seed crée **14 annonces** réparties entre les deux agents : 12 publiées et deux brouillons, un par agent. Les photos sont des URL HTTP avec un texte alternatif. Les mots de passe sont hachés avec Argon2.

Le seed est réservé au développement. Une réexécution met à jour les comptes de démonstration, y compris leurs mots de passe, ainsi que les annonces et leurs photos. Un compte existant avec un rôle différent provoque un refus, sans promotion automatique.


## Commandes

```bash
npm run typecheck                        # Vérification TypeScript
npm run build                            # Génération Prisma et compilation
npm start                                # Démarrage après compilation
npm test                                 # Vitest ; aucun test écrit à ce stade
npm run db:seed                          # Données de démonstration
npm run db:migrate -- --name changement   # Future évolution du schéma
docker compose down                      # Arrêt en conservant les données
```

Vitest exige une `DATABASE_URL_TEST` distincte et utilise cette connexion pour les futurs tests. `npm test` peut actuellement terminer sans erreur même sans fichier de test ; cela ne valide pas le comportement métier.

`db:deploy` applique les migrations uniquement à `DATABASE_URL`. Avant de futurs tests SQL, appliquer également les migrations avec `DATABASE_URL` pointant temporairement vers la base définie par `DATABASE_URL_TEST`, sans remplacer durablement la configuration de développement.

## GitLab

Dépôt : [web-services](https://www-apps.univ-lehavre.fr/forge/hh243545/web-services). La branche commune est `main` ; le développement des annonces se fait sur `feat/annonces`, avec intégration par merge request.

`.env`, `node_modules/`, `dist/` et le client Prisma généré sont exclus de Git. Seul `.env.example`, avec ses valeurs fictives, doit être versionné.
