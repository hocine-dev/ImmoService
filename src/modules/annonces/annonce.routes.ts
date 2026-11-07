
import { Router } from "express";
import type { RequestHandler } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";

import { annonceQuerySchema, annonceIdSchema, createAnnonceSchema } from "./annonce.schema.js";
import { createAnnonceController, createAnnonceDetailController, createAnnoncePostController } from "./annonce.controller.js";
import { createAnnonceService, getAnnonceById, createAnnonce } from "./annonce.service.js";
import { createAnnonceRepository } from "./annonce.repository.js";

import { apiError } from "../../shared/api-error.js";
import { Role } from "../user/user.service.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

/**
 * Middleware de validation des paramètres.
 */
const validateAnnonceQuery: RequestHandler = (
    req,
    res,
    next
) => {
    const result = annonceQuerySchema.safeParse(req.query);

    if (!result.success) {
        const details: Record<string, string[]> = {};

        for (const issue of result.error.issues) {
            const field = String(issue.path[0] ?? "query");
            (details[field] ??= []).push(issue.message);
        }

        res.status(400).json(
            apiError(
                "VALIDATION_ERROR",
                "Paramètres de requête invalides",
                details
            )
        );
        return;
    }

    // Paramètres validés pour le Controller
    res.locals.annonceQuery = result.data;

    next();
};


/**
 * Vérifie l'identifiant reçu dans GET /annonces/:id.
 * Si l'identifiant est invalide, retourne HTTP 400.
 */
const validateAnnonceId: RequestHandler = (req, res, next) => {
    const result = annonceIdSchema.safeParse(req.params);

    if (!result.success) {
        const details: Record<string, string[]> = {};

        for (const issue of result.error.issues) {
            const field = String(issue.path[0] ?? "id");
            (details[field] ??= []).push(issue.message);
        }

        res.status(400).json(
            apiError(
                "VALIDATION_ERROR",
                "Identifiant d'annonce invalide",
                details
            )
        );
        return;
    }

    // Identifiant validé, transmis au Controller
    res.locals.annonceId = result.data.id;

    next();
};



/**
 * Valide les données reçues pour POST /annonces.
 * Les champs inconnus ou invalides sont refusés.
 */
const validateCreateAnnonce: RequestHandler = (req, res, next) => {
    const result = createAnnonceSchema.safeParse(req.body);

    if (!result.success) {
        const details: Record<string, string[]> = {};

        for (const issue of result.error.issues) {
            const field = String(issue.path[0] ?? "body");
            (details[field] ??= []).push(issue.message);
        }

        res.status(400).json(
            apiError(
                "VALIDATION_ERROR",
                "Données de l'annonce invalides",
                details
            )
        );
        return;
    }

    // Données validées transmises au Controller
    res.locals.createAnnonceInput = result.data;
    next();
};



/**
 * Fabrique du routeur des annonces.
 */
export function createAnnonceRouter(prisma: PrismaClient) {
    const router = Router();

    // 1. Initialiser le Repository
    const repository = createAnnonceRepository(prisma);

    // 2. Initialiser le Service
    const service = createAnnonceService(repository);

    // 3. Initialiser le Controller
    const controller = createAnnonceController(
        service.listAnnonces
    );

    // 4. Déclarer la route GET /annonces
    router.get(
        "/",
        validateAnnonceQuery,
        controller.list
    );


    // Controller du détail : le Service utilise le même Repository.
    const detailController = createAnnonceDetailController(
        (id) => getAnnonceById(repository, id)
    );

    // GET /annonces/:id - Consultation d'une annonce publiée
    router.get(
        "/:id",
        validateAnnonceId,
        detailController.detail
    );

    // Controller de création : réutilise le Repository existant.
    const postController = createAnnoncePostController(
        (input, auteurId) => createAnnonce(repository, input, auteurId)
    );

    // POST /annonces - Création d'une annonce par un agent
    router.post(
        "/",
        authMiddleware([Role.AGENT, Role.ADMIN]),
        validateCreateAnnonce,
        postController.create
    );


    return router;
}
