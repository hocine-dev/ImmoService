
import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import { createFavoriController } from "./favori.controller.js";
import {
  createFavoriSchema,
  deleteFavoriSchema,
} from "./favori.schema.js";

export function createFavoriRouter(prisma: PrismaClient) {
  const router = Router();
  const favoriController = createFavoriController(prisma);

  // POST /api/favoris
  // Ajouter une annonce aux favoris
  router.post(
    "/",
    authMiddleware(),
    validate(createFavoriSchema),
    favoriController.create
  );

  // DELETE /api/favoris/:annonceId
  // Retirer une annonce des favoris
  router.delete(
    "/:annonceId",
    authMiddleware(),
    validate(deleteFavoriSchema),
    favoriController.remove
  );

  return router;
}
