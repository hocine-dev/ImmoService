# ImmoService

API REST de gestion d'annonces immobilières développée avec Express 5,
TypeScript, PostgreSQL, Prisma et Zod.

Le modèle immobilier du TP1 est repris et adapté : retrait des tables Better
Auth, ajout de `passwordHash`, de `Photo.alt` et du modèle `Reponse`. La
migration initiale est versionnée.

## Technologies

- Node.js et Express 5
- TypeScript
- PostgreSQL avec Docker
- Prisma 7
- Zod pour la validation
- JWT pour l'authentification
- OpenAPI 3.1 et Swagger UI
- Vitest pour les tests
- SDK TypeScript généré avec OpenAPI Generator

## Installation depuis zéro

Prérequis :

- Node.js `22.12+`
- npm
- Docker et Docker Compose

Depuis un clone neuf :

```bash
npm ci
cp .env.example .env
```

Conserver un `.env` local existant au lieu de le remplacer. Les valeurs de
`.env.example` sont fictives et doivent être adaptées localement.

## Configuration `.env`

Le fichier `.env` configure le serveur, PostgreSQL, les comptes de
démonstration, JWT et CORS.

- `PORT=3001` : port du serveur de développement.
- `DATABASE_URL` : base PostgreSQL de développement.
- `DATABASE_URL_TEST` : base PostgreSQL réservée aux tests.
- `JWT_SECRET` : secret utilisé pour signer les JWT.
- `CORS_ORIGINS` : origines autorisées pour les clients web.
- Les variables `SEED_*` définissent les comptes créés par le seed.

Les mots de passe PostgreSQL doivent être encodés dans les URL PostgreSQL si
elles contiennent des caractères réservés. Les cinq comptes de seed doivent
avoir des adresses distinctes et des mots de passe d'au moins 12 caractères.

Générer un secret JWT avec :

```bash
openssl rand -hex 32
```

Puis copier la valeur dans `.env` :

```dotenv
JWT_SECRET=valeur_generee
```

Ne jamais commiter le vrai secret.

## PostgreSQL et migrations

Docker Compose démarre deux instances PostgreSQL indépendantes :

- développement : port local `5433`, base `immoservice` ;
- tests : port local `5434`, base `immoservice_test`.

Démarrer les bases :

```bash
npm run db:up
```

Générer le client Prisma et appliquer les migrations de développement :

```bash
npm run db:generate
npm run db:deploy
```

Pour créer une nouvelle migration pendant le développement :

```bash
npm run db:migrate -- --name changement
```

Le serveur Node est lancé sur la machine hôte ; Docker Compose démarre
uniquement PostgreSQL.

## Données de démonstration

Après les migrations, préparer les données de démonstration :

```bash
npm run db:seed
```

Le seed prépare 5 comptes :

- un `ADMIN` ;
- deux `AGENT` distincts ;
- deux `USER`.

Les comptes sont configurés par `SEED_ADMIN_*`, `SEED_AGENT_1_*`,
`SEED_AGENT_2_*`, `SEED_USER_1_*` et `SEED_USER_2_*` dans `.env`.

Le seed crée 14 annonces réparties entre les deux agents : 12 publiées et
deux brouillons, un par agent. Les photos sont des URL HTTP avec un texte
alternatif. Les mots de passe sont hachés avec Argon2.

Le seed est réservé au développement. Une réexécution met à jour les comptes
de démonstration, y compris leurs mots de passe, ainsi que les annonces et
leurs photos. Un compte existant avec un rôle différent provoque un refus,
sans promotion automatique.

## Démarrage

Démarrer le serveur de développement :

```bash
npm run dev
```

Le serveur est disponible sur <http://localhost:3001>. Vérifier son démarrage
avec <http://localhost:3001/health>. La route `/` n'est pas définie et
renvoie `Cannot GET /`.

Commandes utiles :

```bash
npm run typecheck
npm run build
npm start
docker compose down
```

## Authentification et autorisation

L'API utilise une authentification par JWT.

La route `POST /auth/login` permet de récupérer un jeton d'authentification.

Trois rôles sont utilisés :

- `USER` : utilisateur standard ;
- `AGENT` : gestion de ses propres annonces ;
- `ADMIN` : administration des annonces.

Les routes protégées vérifient le JWT et les rôles.

Les contrôles de propriété empêchent un agent de modifier, supprimer ou
publier une annonce appartenant à un autre agent.

Les brouillons sont accessibles uniquement à leur auteur et aux
administrateurs. Les brouillons non accessibles retournent volontairement
`404` afin de ne pas révéler leur existence.

## Choix techniques

Express 5 a été choisi pour sa simplicité, son écosystème mature et son
intégration directe avec les middlewares HTTP nécessaires à l'API : parsing
JSON, authentification JWT, validation, gestion des erreurs, CORS et
limitation de débit.

Zod centralise la validation et la transformation des paramètres de requête,
des corps JSON et des paramètres de route. Les schémas sont réutilisables par
les middlewares et permettent de rejeter les données invalides avant
l'exécution de la logique métier, avec des erreurs HTTP standardisées.

## API REST — Annonces

Routes disponibles :

- `GET /annonces`
- `GET /annonces/:id`
- `GET /annonces/miennes`
- `POST /annonces`
- `PATCH /annonces/:id`
- `DELETE /annonces/:id`
- `PATCH /annonces/:id/statut`

La liste publique propose une pagination et des filtres par ville, type de
transaction et prix maximal.

Les routes privées utilisent des JWT et des contrôles d'autorisation.

Le cache HTTP utilise `Cache-Control` et `ETag`. La liste publique et le détail
d'une annonce publiée prennent en charge la revalidation et les réponses
`304`. Les brouillons, les données personnelles et les opérations d'écriture
utilisent des politiques empêchant leur stockage.

## Contrat OpenAPI et SDK

Le contrat est documenté dans `openapi.yaml`.

L'approche repose sur une spécification OpenAPI maintenue avec
l'implémentation TypeScript et les validations Zod.

Régénérer le SDK TypeScript depuis le contrat :

```bash
npm run sdk:generate
```

Documentation interactive :

<http://localhost:3001/docs>

Les tests E2E utilisent le SDK généré pour vérifier la cohérence entre le
contrat et l'implémentation. `fetch` est conservé uniquement pour certains
tests HTTP spécifiques, comme les en-têtes de cache, les réponses `304`,
CORS et les requêtes volontairement malformées.

## Tests

Les tests sont réalisés avec Vitest.

- Tests unitaires : validation Zod, services, repository et politiques
  d'autorisation.
- Tests E2E : authentification, CRUD, autorisations, codes HTTP, protection
  IDOR, cache HTTP et cohérence du SDK OpenAPI.

La base E2E est séparée de la base de développement et configurée avec
`DATABASE_URL_TEST`. Elle doit être préparée avec les migrations et les
comptes de démonstration avant l'exécution. La configuration E2E vérifie la
base et démarre automatiquement un serveur de test sur le port interne
`3002`.

Préparer les bases et les variables d'environnement, puis lancer :

```bash
npm run test:unit
npm run test:e2e
npm test
```

`npm test` régénère d'abord le SDK via le script `pretest`, puis exécute les
tests unitaires et E2E.

Les tests E2E nécessitent une base de test préparée avec les migrations et les
comptes de démonstration.

## Commandes récapitulatives

```bash
npm ci
cp .env.example .env
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

## GitLab

Dépôt : [web-services](https://www-apps.univ-lehavre.fr/forge/hh243545/web-services).
La branche commune est `main` ; le développement des annonces se fait sur
`feat/annonces`, avec intégration par merge request.

`.env`, `node_modules/`, `dist/` et le client Prisma généré sont exclus de Git.
Seul `.env.example`, avec ses valeurs fictives, doit être versionné.
