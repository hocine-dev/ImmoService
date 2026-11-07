
import type { AnnonceQuery, CreateAnnonceInput } from "./annonce.schema.js";

/**
 * Contrat attendu du Repository.
 *
 * TAnnonce représente une annonce retournée
 * avec uniquement ses champs publics.
 */
export interface AnnonceRepository<TAnnonce> {
    findPublishedPage(
        query: AnnonceQuery
    ): Promise<{
        annonces: TAnnonce[];
        total: number;
    }>;
}

/**
 * Service métier des annonces.
 */
export function createAnnonceService<TAnnonce>(
    repository: AnnonceRepository<TAnnonce>
) {
    /**
     * Récupère une page d'annonces publiées.
     */
    async function listAnnonces(query: AnnonceQuery) {

        // Récupération des données depuis le Repository
        const { annonces, total } =
            await repository.findPublishedPage(query);

        // Calcul du nombre total de pages
        const pages = Math.ceil(total / query.limit);

        // Construction de la réponse API
        return {
            data: annonces,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                pages
            }
        };
    }

    return {
        listAnnonces
    };
}


/**
 * Récupère le détail d'une annonce publiée par son ID.
 *
 * Retourne l'annonce si elle existe et est publiée,
 * sinon retourne null.
 */
export async function getAnnonceById<TAnnonce>(
    repository: {
        findPublishedById(id: string): Promise<TAnnonce | null>;
    },
    id: string
) {
    return repository.findPublishedById(id);
}

/**
 * Crée une annonce pour un agent authentifié.
 *
 * Les données ont déjà été validées par Zod.
 * L'identifiant de l'agent proviendra du JWT vérifié.
 */
export async function createAnnonce<TAnnonce>(
    repository: {
        createAnnonce(
            input: CreateAnnonceInput,
            auteurId: string
        ): Promise<TAnnonce>;
    },
    input: CreateAnnonceInput,
    auteurId: string
) {
    return repository.createAnnonce(input, auteurId);
}

