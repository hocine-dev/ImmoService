import { Request, Response, NextFunction } from 'express';
import { createQuestionService } from "./question.service.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { apiError } from '../../shared/api-error.js';

export function createQuestionController(prisma: PrismaClient) {
  const questionService = createQuestionService(prisma);
  return {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const auteurId = req.user?.id;
      if (!auteurId) {
        /**
         * Authentification :
         * Toutes les erreurs HTTP utilisent le format commun ImmoService.
         */
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Utilisateur non authentifié")
        );
      }

      /**
    * Sécurité des données :
    * On utilise exclusivement les données validées par Zod.
    * L'identifiant de l'auteur provient du JWT vérifié,
    * jamais du body envoyé par le client !!.
    */
      const { texte, annonceId } = req.validated.body;

      const question = await questionService.createQuestion({
        texte,
        annonceId,
        auteurId
      });

      /**
       * Cohérence avec le module annonces :
       * Si l'annonce n'existe pas ou n'est pas publiée,
       * on retourne HTTP 404 sans révéler son existence.
       * Toutes les erreurs utilisent le format commun ImmoService.
       */
      if (question === null) {
        return res.status(404).json(
          apiError("NOT_FOUND", "Annonce introuvable")
        );
      }

      return res.status(201).json({
        status: 'success',
        message: 'Question posée avec succès',
        data: question,
      });
    } catch (error) {
      // Transmettre les erreurs au gestionnaire global Express.
      // Les réponses HTTP respecteront le contrat commun ImmoService.
      next(error);
    }
  },

  async getByAnnonce(req: Request, res: Response, next: NextFunction) {
    try {
      const annonceId = req.validated.params.annonceId as string;

      if (!annonceId) {
        return res.status(400).json(
          apiError("VALIDATION_ERROR", "L'ID de l'annonce est manquant")
        );
      }
      /**
       * Autorisation :
       * L'identité provient du JWT vérifié par optionalAuthMiddleware.
       * Sans JWT, req.user est undefined (visiteur).
       * Le Service applique les règles de question.policy.ts.
       */
      const questions = await questionService.getQuestionsByAnnonce(
        annonceId,
        req.user,
        req.validated.query.page,
        req.validated.query.limit
      );

      // Annonce inexistante ou inaccessible
      if (questions === null) {
        return res.status(404).json(
          apiError("NOT_FOUND", "Annonce introuvable")
        );
      }
      return res.status(200).json({
        status: 'success',
        data: questions.data,
        pagination: questions.pagination,
      });
    } catch (error) {
      // Transmettre les erreurs au gestionnaire global Express.
      // Les réponses HTTP respecteront le contrat commun ImmoService.
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const questionId = req.params.id as string;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        /**
         * Authentification :
         * Toutes les erreurs HTTP utilisent le format commun ImmoService.
         */
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Utilisateur non authentifié")
        );
      }

      const result = await questionService.deleteQuestion(questionId, userId, userRole);

      /**
 * Gestion des erreurs métier :
 * Le Service indique le type d'erreur.
 * Le Controller retourne le statut HTTP correspondant
 * avec le format commun ImmoService.
 */
      if ("error" in result) {
        if (result.error === "NOT_FOUND") {
          return res.status(404).json(
            apiError("NOT_FOUND", "Question introuvable")
          );
        }

        return res.status(403).json(
          apiError("FORBIDDEN", "Accès refusé")
        );
      }

      return res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      // Transmettre les erreurs au gestionnaire global Express.
      // Les réponses HTTP respecteront le contrat commun ImmoService.
      next(error);
    }
  },
  };
}
