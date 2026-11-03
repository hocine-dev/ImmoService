
import express from "express";
import type { PrismaClient } from "./generated/prisma/client.js";

import { createAnnonceRouter } from "./modules/annonces/annonce.routes.js";

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

  return app;
}
