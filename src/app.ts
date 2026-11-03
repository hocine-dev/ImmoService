
import express from "express";
import type { PrismaClient } from "./generated/prisma/client.js";

import { createAnnonceRouter } from "./modules/annonces/annonce.routes.js";
import { readFileSync } from "node:fs";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

/**
 * Construit l'application Express.
 *
 * Prisma est injecté afin de pouvoir utiliser
 * une base différente pendant les tests.
 */
export function createApp(prisma: PrismaClient) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  // Route de vérification
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Module des annonces
  app.use("/annonces", createAnnonceRouter(prisma));

  // Lecture de la documentation OpenAPI.
  const openapi = YAML.parse(
    readFileSync("openapi.yaml", "utf8")
  );

  // Affichage de la documentation Swagger sur /docs.
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  return app;
}
