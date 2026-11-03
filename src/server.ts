
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { createApp } from "./app.js";

// Vérifier les variables d'environnement
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire");
}

// Initialiser Prisma 7 avec PostgreSQL
const adapter = new PrismaPg({
  connectionString: databaseUrl
});

const prisma = new PrismaClient({ adapter });

// Construire l'application Express
const app = createApp(prisma);

const port = Number(process.env.PORT ?? 3001);

const server = app.listen(port, () => {
  console.log(`ImmoService : http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error(`Démarrage impossible : ${error.message}`);
  process.exitCode = 1;
});

// Arrêt propre du serveur
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      void prisma.$disconnect().catch(console.error);
    });
  });
}
