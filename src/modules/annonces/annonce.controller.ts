
import type { RequestHandler } from "express";
import type { AnnonceQuery } from "./annonce.schema.js";
import { apiError } from "../../shared/api-error.js";

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


/**
 * Contrôleur de GET /annonces/:id.
 * Récupère une annonce publiée ou retourne une erreur 404.
 */
export function createAnnonceDetailController<T>(
    getAnnonceById: (id: string) => Promise<T | null>
) {
    const detail: RequestHandler = async (_req, res, next) => {
        try {
            // Identifiant préalablement validé par Zod
            const id = res.locals.annonceId as string | undefined;

            if (!id) {
                throw new Error("Validation de l'identifiant non exécutée");
            }

            // Recherche de l'annonce via le Service
            const annonce = await getAnnonceById(id);

            // Annonce inexistante ou en brouillon
            if (!annonce) {
                res.status(404).json(
                    apiError("NOT_FOUND", "Annonce introuvable")
                );
                return;
            }

            // Annonce publiée trouvée
            res.status(200).json(annonce);

        } catch (error) {
            next(error);
        }
    };

    return { detail };
}
