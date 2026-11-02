# ImmoService

Configuration initiale du projet Web Services : Express 5, TypeScript strict, PostgreSQL 17 avec Docker, Prisma 7 et Vitest.

Le schéma reprend le modèle immobilier du TP1, adapté pour le service : retrait des tables Better Auth, ajout de `passwordHash`, de `Photo.alt` et du modèle `Reponse`. La migration initiale est versionnée. Les routes métier restent à développer par le binôme.

## Démarrage

Prérequis : Node.js 22.12+ (`.nvmrc` fourni), npm et Docker Compose.

```bash
npm ci
cp .env.example .env
```

Choisir les mots de passe PostgreSQL dans `.env` et mettre à jour les deux URL correspondantes. Conserver un `.env` local existant au lieu de le remplacer.

```bash
npm run db:up
npm run db:generate
npm run db:deploy
npm run dev
```

Le serveur écoute sur http://localhost:3001 ; `GET /health` permet de vérifier son démarrage. PostgreSQL utilise les ports locaux 5433 (développement) et 5434 (tests). Les bases et leurs volumes sont distincts.

## Commandes

```bash
npm run typecheck                        # Vérification TypeScript
npm run build                            # Génération Prisma et compilation
npm start                                # Démarrage après compilation
npm test                                 # Vitest ; aucun test métier écrit à ce stade
npm run db:migrate -- --name changement   # Future évolution du schéma
docker compose down                      # Arrêt en conservant les données
```

Vitest exige une `DATABASE_URL_TEST` distincte et utilise cette connexion pour les futurs tests. Sur une base de test vierge, appliquer également les migrations avec `DATABASE_URL` pointant temporairement vers cette base, sans changer l'URL du développement dans `.env`.

Le seed, l'authentification, les routes métier, OpenAPI et les tests seront développés ensuite. Aucun secret réel n'est versionné : `.env`, `node_modules/`, `dist/` et le client Prisma généré sont exclus de Git.

## GitLab

La branche commune est `main`. Les deux membres créeront leurs branches depuis le commit initial commun. Le dépôt GitLab doit être privé. Son URL pourra être ajoutée une fois le dépôt créé.
