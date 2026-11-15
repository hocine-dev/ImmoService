
import type { Request, Response, NextFunction } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createFavoriService } from "./favori.service.js";
import { apiError } from "../../shared/api-error.js";

export function createFavoriController(prisma: PrismaClient) {
  const favoriService = createFavoriService(prisma);

  return {
    // POST : Ajouter une annonce aux favoris
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.id;
        const data = req.validated.body;

        const favori = await favoriService.createFavori(userId, data);

        if ("error" in favori) {
          if (favori.error === "CONFLICT") {
            return res.status(409).json(
              apiError("CONFLICT", "Cette annonce est déjà dans vos favoris")
            );
          }

          return res.status(404).json(
            apiError("NOT_FOUND", "Annonce introuvable")
          );
        }

        return res.status(201).json({
          success: true,
          message: "Annonce ajoutée aux favoris",
          data: favori,
        });
      } catch (error) {
        next(error);
      }
    },

    // DELETE : Retirer une annonce des favoris
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.user!.id;
        const { annonceId } = req.validated.params;

        const result = await favoriService.deleteFavori(userId, annonceId);

        if ("error" in result) {
          return res.status(404).json(
            apiError("NOT_FOUND", "Favori introuvable")
          );
        }

        return res.status(200).json({
          success: true,
          message: "Annonce retirée des favoris",
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
