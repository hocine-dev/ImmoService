import type { Request, Response, NextFunction } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { apiError } from "../../shared/api-error.js";
import { createReponseService } from "./reponse.service.js";

// Conversion des refus métier du Service en réponses HTTP.
const ERREURS_CREATION = {
  NOT_FOUND: { status: 404, message: "Question introuvable" },
  FORBIDDEN: { status: 403, message: "Accès refusé" },
  CONFLICT: { status: 409, message: "Cette question a déjà une réponse" },
} as const;

const ERREURS_SUPPRESSION = {
  NOT_FOUND: { status: 404, message: "Réponse introuvable" },
  FORBIDDEN: { status: 403, message: "Accès refusé" },
} as const;

export function createReponseController(prisma: PrismaClient) {
  const reponseService = createReponseService(prisma);

  return {
    // POST : Répondre à une question (AGENT propriétaire de l'annonce ou ADMIN)
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        /**
         * Sécurité :
         * L'identité provient du middleware JWT, jamais du body.
         */
        if (!req.user) {
          return res.status(401).json(
            apiError("UNAUTHORIZED", "Authentification requise")
          );
        }

        const result = await reponseService.createReponse(req.validated.body, {
          id: req.user.id,
          role: req.user.role,
        });

        if ("error" in result) {
          const { status, message } = ERREURS_CREATION[result.error];
          return res.status(status).json(apiError(result.error, message));
        }

        return res.status(201).json({
          status: "success",
          message: "Réponse ajoutée avec succès",
          data: result,
        });
      } catch (error) {
        // Transmettre l'erreur au gestionnaire global Express
        // pour respecter le statut HTTP et le format API commun.
        next(error);
      }
    },

    // GET : Récupérer la réponse d'une question
    async getByQuestion(req: Request, res: Response, next: NextFunction) {
      try {
        // L'authentification est facultative : elle sert aux brouillons.
        const user = req.user
          ? { id: req.user.id, role: req.user.role }
          : undefined;

        const reponse = await reponseService.getReponseByQuestion(
          req.validated.params.questionId,
          user
        );

        // Question, annonce ou réponse inexistante, ou accès refusé : même 404.
        if (!reponse) {
          return res.status(404).json(
            apiError("NOT_FOUND", "Réponse introuvable")
          );
        }

        return res.status(200).json({
          status: "success",
          data: reponse,
        });
      } catch (error) {
        next(error);
      }
    },

    // DELETE : Supprimer une réponse (auteur de la réponse ou ADMIN)
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        if (!req.user) {
          return res.status(401).json(
            apiError("UNAUTHORIZED", "Authentification requise")
          );
        }

        const result = await reponseService.deleteReponse(
          req.validated.params.id,
          req.user.id,
          req.user.role
        );

        // Ne pas annoncer une suppression si elle a été refusée.
        if (result.error !== undefined) {
            const { status, message } = ERREURS_SUPPRESSION[result.error];
            return res.status(status).json(apiError(result.error, message));
        }

        return res.status(200).json({
          status: "success",
          message: result.message,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}