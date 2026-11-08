
import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";

// Schémas de validation HTTP du module annonces
import {
    listAnnoncesRequestSchema,
    detailAnnonceRequestSchema,
    createAnnonceRequestSchema,
    updateAnnonceRequestSchema
} from "./annonce.schema.js";

// Controllers existants
import {
    createAnnonceController,
    createAnnonceDetailController,
    createAnnoncePostController,
    createAnnoncePatchController
} from "./annonce.controller.js";

// Services existants
import {
    createAnnonceService,
    getAnnonceById,
    createAnnonce,
    updateAnnonce
} from "./annonce.service.js";

// Repository existant
import { createAnnonceRepository } from "./annonce.repository.js";

// Middlewares communs du projet
import validateMiddleware from "../../middlewares/validate.middleware.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { Role } from "../user/user.service.js";

/**
 * Construit le routeur du module annonces.
 *
 * Principe :
 * - Les routes déclarent les middlewares nécessaires.
 * - validate() vérifie les données HTTP avec Zod.
 * - authMiddleware() vérifie les JWT et les rôles.
 * - Les Controllers traitent la réponse HTTP.
 * - Le Repository impose les restrictions IDOR.
 */
export function createAnnonceRouter(prisma: PrismaClient) {

    const router = Router();

    // Repository commun aux différentes opérations
    const repository = createAnnonceRepository(prisma);

    // Service de consultation des annonces
    const service = createAnnonceService(repository);

    /**
     * GET /annonces
     * Route publique : aucune authentification requise.
     */
    const listController = createAnnonceController(
        service.listAnnonces
    );

    router.get(
        "/",
        validateMiddleware(listAnnoncesRequestSchema),
        listController.list
    );

    /**
     * GET /annonces/:id
     * Consultation publique des annonces publiées.
     */
    const detailController = createAnnonceDetailController(
        id => getAnnonceById(repository, id)
    );

    router.get(
        "/:id",
        validateMiddleware(detailAnnonceRequestSchema),
        detailController.detail
    );

    /**
     * POST /annonces
     *
     * 1. Vérifier le JWT et le rôle.
     * 2. Valider les données avec Zod.
     * 3. Créer l'annonce en brouillon.
     */
    const postController = createAnnoncePostController(
        (input, auteurId) =>
            createAnnonce(repository, input, auteurId)
    );

    router.post(
        "/",
        authMiddleware([Role.AGENT, Role.ADMIN]),
        validateMiddleware(createAnnonceRequestSchema),
        postController.create
    );

    /**
     * PATCH /annonces/:id
     *
     * 1. Vérifier le JWT et le rôle.
     * 2. Valider ensemble l'ID et le body.
     * 3. Vérifier le propriétaire pendant la mise à jour.
     *
     * Un agent ne peut pas modifier l'annonce d'un autre.
     */
    const patchController = createAnnoncePatchController(
        (id, input, utilisateurId, isAdmin) =>
            updateAnnonce(
                repository,
                id,
                input,
                utilisateurId,
                isAdmin
            )
    );

    router.patch(
        "/:id",
        authMiddleware([Role.AGENT, Role.ADMIN]),
        validateMiddleware(updateAnnonceRequestSchema),
        patchController.update
    );

    return router;
}