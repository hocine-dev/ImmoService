
import express from "express";
import type { PrismaClient } from "./generated/prisma/client.js";

import { createAnnonceRouter } from "./modules/annonces/annonce.routes.js";
import { readFileSync } from "node:fs";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import type { ErrorRequestHandler } from "express";
import { apiError } from "./shared/api-error.js";
import rateLimitMiddleware from "./middlewares/rateLimit.middleware.js";
import { createUserRouter } from "./modules/user/user.route.js";
import { createAuthRouter } from "./modules/auth/auth.route.js";
import { createQuestionRouter } from "./modules/questions/question.route.js";

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
  // Protection générale de l'API contre les abus.
  // Désactivée uniquement pendant les tests E2E.
  if (process.env.NODE_ENV !== "test") {
    app.use(
      ["/annonces", "/users", "/auth", "/questions"],
      rateLimitMiddleware.generalLimiter,
      rateLimitMiddleware.speedLimiter
    );
  }


  app.use("/annonces", createAnnonceRouter(prisma));
  app.use("/users", createUserRouter(prisma));
  app.use("/auth", createAuthRouter(prisma));
  app.use("/questions", createQuestionRouter(prisma));

  // Lecture de la documentation OpenAPI.
  const openapi = YAML.parse(
    readFileSync("openapi.yaml", "utf8")
  );

  // Affichage de la documentation Swagger sur /docs.
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  /**
 * Gère les erreurs techniques non prises en charge
 * par les contrôleurs et retourne une réponse JSON uniforme.
 */
  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    console.error(err);

    res.status(500).json(
      apiError("INTERNAL_ERROR", "Erreur interne du serveur")
    );
  };

  app.use(errorHandler);

  return app;
}