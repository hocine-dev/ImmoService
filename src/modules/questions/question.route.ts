import { Router } from 'express';
import { createQuestionController } from "./question.controller.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import validate from '../../middlewares/validate.middleware.js';
import rateLimitMiddleware from '../../middlewares/rateLimit.middleware.js';
import authMiddleware, {
  optionalAuthMiddleware
} from '../../middlewares/auth.middleware.js';
import { createQuestionSchema, getQuestionsByAnnonceSchema } from "./question.schema.js";


export function createQuestionRouter(prisma: PrismaClient) {
  const routerQuest = Router();
  const questionController = createQuestionController(prisma);

// GET /api/questions/annonce/:annonceId - Lire les questions d'une annonce (Public)
/**
 * Consultation des questions :
 * - Annonce publiée : accès public.
 * - Brouillon : accès réservé à l'ADMIN ou à l'AGENT propriétaire.
 *
 * Le middleware vérifie le JWT s'il est fourni.
 * Le Service vérifiera les droits sur l'annonce.
 */
routerQuest.get(
  '/annonce/:annonceId',
  optionalAuthMiddleware,
  validate(getQuestionsByAnnonceSchema),
  questionController.getByAnnonce
);
// POST /api/questions - Poser une question (Privé - nécessite d'être connecté)
/**
 * Sécurité des questions :
 * L'utilisateur doit être authentifié par JWT.
 * Les données sont ensuite validées avec Zod avant
 * d'être transmises au Controller.
 */
routerQuest.post(
  '/create',
  authMiddleware(),
  rateLimitMiddleware.questionLimiter,
  validate(createQuestionSchema),
  questionController.create
);

// DELETE /api/questions/:id - Supprimer une question (Privé - IDOR protégé)
routerQuest.delete('/:id', authMiddleware(), questionController.delete);

return routerQuest;
}
