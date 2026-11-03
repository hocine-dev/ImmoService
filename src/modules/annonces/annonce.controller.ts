
import type { RequestHandler } from "express";
import type { AnnonceQuery } from "./annonce.schema.js";

/**
 * Format des résultats paginés.
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

/**
 * Contrôleur des annonces.
 *
 * Le service est injecté pour éviter
 * un couplage direct avec son implémentation.
 */
export function createAnnonceController<T>(
    listAnnonces: (
        query: AnnonceQuery
    ) => Promise<PaginatedResponse<T>>
) {
    const list: RequestHandler = async (
        _req,
        res,
        next
    ) => {
        try {
            // Paramètres déjà validés par Zod
            const query = res.locals.annonceQuery as AnnonceQuery | undefined;

            if (!query) {
                throw new Error(
                    "Validation des annonces non exécutée"
                );
            }

            // Appel du service métier
            const result = await listAnnonces(query);

            // Réponse HTTP
            res.status(200).json(result);

        } catch (error) {
            // Transmission au gestionnaire d'erreurs
            next(error);
        }
    };

    return { list };
}
