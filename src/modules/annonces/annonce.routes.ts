
import { Router } from "express";
import type { RequestHandler } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";

import { annonceQuerySchema } from "./annonce.schema.js";
import { createAnnonceController } from "./annonce.controller.js";
import { createAnnonceService } from "./annonce.service.js";
import { createAnnonceRepository } from "./annonce.repository.js";

import { apiError } from "../../shared/api-error.js";

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

    return router;
}
