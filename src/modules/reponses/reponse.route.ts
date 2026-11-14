import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import { Role } from "../user/user.service.js";
import { createReponseController } from "./reponse.controller.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  createReponseSchema,
  deleteReponseSchema,
  getReponseByQuestionSchema,
} from "./reponse.schema.js";

export function createReponseRouter(prisma: PrismaClient) {
  const router = Router();
  const reponseController = createReponseController(prisma);

  // ==========================================
  // ROUTES RÉPONSES
  // ==========================================

  // POST /reponses/create - Répondre à une question
  // Réservé aux AGENTS et ADMINS ; le Service vérifie ensuite que l'agent
  // est bien le propriétaire de l'annonce (sauf ADMIN).
  router.post(
    "/create",
    authMiddleware([Role.AGENT, Role.ADMIN]),
    validate(createReponseSchema),
    reponseController.create
  );

  // GET /reponses/question/:questionId - Réponse d'une question
  // Annonce publiée : accessible à tous. Brouillon : ADMIN ou agent propriétaire.
  //
  // authMiddleware() exige ici un JWT. Pour un accès public comme
  // GET /questions/annonce/:annonceId, remplace-le par le middleware
  // d'authentification facultative utilisé dans question.routes.ts.
  router.get(
    "/question/:questionId",
    authMiddleware(),
    validate(getReponseByQuestionSchema),
    reponseController.getByQuestion
  );

  // DELETE /reponses/:id - Supprimer une réponse (auteur de la réponse ou ADMIN)
  // Déclarée après les routes statiques ci-dessus.
  router.delete(
    "/:id",
    authMiddleware(),
    validate(deleteReponseSchema),
    reponseController.remove
  );

  return router;
}