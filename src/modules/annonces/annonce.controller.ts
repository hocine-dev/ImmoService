
import type { RequestHandler } from "express";
import { apiError } from "../../shared/api-error.js";
import type { AnnonceQuery, AnnonceIdParams, CreateAnnonceInput, UpdateAnnonceInput, ChangeStatutAnnonceRequest } from "./annonce.schema.js";

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
            const query = (
                _req.validated as { query: AnnonceQuery } | undefined
            )?.query;

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

            // Récupérer l'identifiant validé par le middleware Zod.
            const id = (
                _req.validated as { params: AnnonceIdParams } | undefined
            )?.params.id;

            // Vérification de sécurité : le middleware doit avoir
            // fourni un identifiant valide avant le Controller.
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


/**
 * Contrôleur de POST /annonces.
 * Permet à un agent authentifié de créer une annonce.
 */
export function createAnnoncePostController<T>(
    createAnnonce: (
        input: CreateAnnonceInput,
        auteurId: string
    ) => Promise<T>
) {
    const create: RequestHandler = async (_req, res, next) => {
        try {
            // Utilisateur fourni par le middleware d'authentification
            const user = _req.user;

            // Aucun utilisateur authentifié
            if (!user?.id) {
                res.status(401).json(
                    apiError("UNAUTHORIZED", "Authentification requise")
                );
                return;
            }

            // Seuls les agents peuvent créer des annonces
            if (user.role !== "AGENT" && user.role !== "ADMIN") {
                res.status(403).json(
                    apiError("FORBIDDEN", "Accès réservé aux agents et administrateurs")
                );
                return;
            }

            const input = (
                _req.validated as { body: CreateAnnonceInput } | undefined
            )?.body;

            if (!input) {
                throw new Error("Validation de l'annonce non exécutée");
            }

            // Création avec l'identifiant de l'agent authentifié
            const annonce = await createAnnonce(input, user.id);

            // Annonce créée avec succès
            res.status(201).json(annonce);

        } catch (error) {
            next(error);
        }
    };

    return { create };
}


/**
 * Controller de PATCH /annonces/:id.
 *
 * Gère la requête HTTP et les codes de réponse.
 * La logique d'accès à PostgreSQL reste dans le Repository.
 */
export function createAnnoncePatchController<T>(
    updateAnnonce: (
        id: string,
        input: UpdateAnnonceInput,
        utilisateurId: string,
        isAdmin: boolean
    ) => Promise<T | null>
) {
    const update: RequestHandler = async (req, res, next) => {
        try {
            // Utilisateur authentifié par le JWT.
            const user = req.user;

            if (!user?.id) {
                res.status(401).json(
                    apiError("UNAUTHORIZED", "Authentification requise")
                );
                return;
            }

            // Seuls AGENT et ADMIN peuvent modifier une annonce.
            if (user.role !== "AGENT" && user.role !== "ADMIN") {
                res.status(403).json(
                    apiError("FORBIDDEN", "Accès interdit")
                );
                return;
            }



            const validated = req.validated as {
                params: AnnonceIdParams;
                body: UpdateAnnonceInput;
            } | undefined;

            if (!validated?.params?.id || !validated.body) {
                throw new Error("Validation PATCH non exécutée");
            }

            const id = validated.params.id;
            const input = validated.body;

            // Appel du Service avec les informations du JWT.
            const annonce = await updateAnnonce(
                id,
                input,
                user.id,
                user.role === "ADMIN"
            );

            // Annonce inexistante ou non accessible.
            if (!annonce) {
                res.status(404).json(
                    apiError("NOT_FOUND", "Annonce introuvable")
                );
                return;
            }

            // Modification réussie.
            res.status(200).json(annonce);

        } catch (error) {
            next(error);
        }
    };

    return { update };
}


/**
 * Controller de DELETE /annonces/:id.
 *
 * Supprime une annonce si l'utilisateur possède
 * les droits nécessaires.
 *
 * La vérification du propriétaire sera effectuée
 * par le Repository.
 */
export function createAnnonceDeleteController(
    deleteAnnonce: (
        id: string,
        utilisateurId: string,
        isAdmin: boolean
    ) => Promise<boolean>
) {
    const remove: RequestHandler = async (req, res, next) => {
        try {
            // Utilisateur authentifié par le JWT.
            const user = req.user;

            if (!user?.id) {
                res.status(401).json(
                    apiError("UNAUTHORIZED", "Authentification requise")
                );
                return;
            }

            // Seuls AGENT et ADMIN peuvent supprimer.
            if (user.role !== "AGENT" && user.role !== "ADMIN") {
                res.status(403).json(
                    apiError("FORBIDDEN", "Accès interdit")
                );
                return;
            }

            // Identifiant validé par le middleware Zod.
            const id = req.validated?.params?.id;
            if (!id) {
                throw new Error(
                    "Validation de l'identifiant non exécutée"
                );
            }

            // Demander la suppression au Service.
            const deleted = await deleteAnnonce(
                id,
                user.id,
                user.role === "ADMIN"
            );

            // Annonce inexistante ou inaccessible.
            if (!deleted) {
                res.status(404).json(
                    apiError("NOT_FOUND", "Annonce introuvable")
                );
                return;
            }

            // Suppression réussie : aucun corps JSON.
            res.status(204).send();

        } catch (error) {
            next(error);
        }
    };

    return { remove };
}


/**
 * Controller de PATCH /annonces/:id/statut.
 *
 * Permet de publier ou dépublier une annonce :
 * - PUBLIE    : rend l'annonce publique.
 * - BROUILLON : retire l'annonce de la liste publique.
 *
 * Les droits du propriétaire sont vérifiés
 * directement par le Repository.
 */
export function createAnnonceStatutController<T>(
    changeStatutAnnonce: (
        id: string,
        statut: ChangeStatutAnnonceRequest["body"]["statut"],
        utilisateurId: string,
        isAdmin: boolean
    ) => Promise<T | null>
) {
    const changeStatut: RequestHandler = async (req, res, next) => {
        try {
            // Utilisateur authentifié grâce au JWT.
            const user = req.user;

            if (!user?.id) {
                res.status(401).json(
                    apiError("UNAUTHORIZED", "Authentification requise")
                );
                return;
            }

            // Seuls AGENT et ADMIN peuvent changer le statut.
            if (user.role !== "AGENT" && user.role !== "ADMIN") {
                res.status(403).json(
                    apiError("FORBIDDEN", "Accès interdit")
                );
                return;
            }

            // Données validées par le middleware Zod commun.
            const validated = req.validated as
                ChangeStatutAnnonceRequest | undefined;

            if (!validated) {
                throw new Error(
                    "Validation du statut non exécutée"
                );
            }

            const { id } = validated.params;
            const { statut } = validated.body;

            // Appel du Service avec les informations du JWT.
            const annonce = await changeStatutAnnonce(
                id,
                statut,
                user.id,
                user.role === "ADMIN"
            );

            // Annonce inexistante ou inaccessible à cet agent.
            if (!annonce) {
                res.status(404).json(
                    apiError("NOT_FOUND", "Annonce introuvable")
                );
                return;
            }

            // Publication ou dépublication réussie.
            res.status(200).json(annonce);

        } catch (error) {
            // Transmettre les erreurs au middleware global.
            next(error);
        }
    };

    return { changeStatut };
}
