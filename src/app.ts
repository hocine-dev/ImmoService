
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
import cors from "cors";

/**
 * Construit l'application Express.
 *
 * Prisma est injecté afin de pouvoir utiliser
 * une base différente pendant les tests.
 */
export function createApp(prisma: PrismaClient) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));


  const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

  app.use(cors({
    // Seules les origines explicitement autorisées
    // peuvent lire les réponses depuis un navigateur.
    origin(origin, callback) {
      callback(
        null,
        !!origin && allowedOrigins.includes(origin)
      );
    },

    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],

    // Notre API utilise des JWT Bearer,
    // pas des cookies de session.
    credentials: false,

    maxAge: 600,
    optionsSuccessStatus: 204
  }));


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
   * Gestionnaire global des erreurs HTTP.
   *
   * - 400 : JSON mal formé
   * - 413 : corps JSON trop volumineux
   * - 500 : erreur interne inattendue
   */
  const errorHandler: ErrorRequestHandler = (
    err,
    _req,
    res,
    next
  ) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    // Les erreurs du parseur JSON portent un "type".
    const error = err as { type?: string };

    // JSON mal formé
    if (error.type === "entity.parse.failed") {
      res.status(400).json(
        apiError(
          "VALIDATION_ERROR",
          "Corps JSON mal formé",
          { body: ["Le contenu JSON est invalide"] }
        )
      );
      return;
    }

    // Taille du JSON supérieure à la limite autorisée
    if (error.type === "entity.too.large") {
      res.status(413).json(
        apiError(
          "VALIDATION_ERROR",
          "Corps de la requête trop volumineux",
          { body: ["La taille maximale autorisée est de 100 Ko"] }
        )
      );
      return;
    }

    // Toutes les autres erreurs inattendues
    console.error(err);

    res.status(500).json(
      apiError(
        "INTERNAL_ERROR",
        "Erreur interne du serveur"
      )
    );
  };


  app.use(errorHandler);

  return app;
}