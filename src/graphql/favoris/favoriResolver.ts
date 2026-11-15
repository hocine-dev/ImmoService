
import { GraphQLError } from "graphql";
import { z } from "zod";

import type { PrismaClient } from "../../generated/prisma/client.js";
import { createFavoriService } from "../../modules/favoris/favori.service.js";
import { createFavoriSchema, deleteFavoriSchema } from "../../modules/favoris/favori.schema.js";



/**
 * Utilisateur authentifié par le middleware JWT.
 */
type UserViewer = {
    id: string;
};

type GraphQLContext = {
    viewer?: UserViewer;
};

type CreateFavoriArgs = {
    input: unknown;
};

type DeleteFavoriArgs = {
    annonceId: string;
};

/**
 * Convertit les erreurs Zod au format GraphQL.
 */
function formatValidationError(
    issues: {
        path: PropertyKey[];
        message: string;
    }[]
) {
    return {
        code: "VALIDATION_ERROR",
        message: "Données invalides",
        details: issues.map(issue => ({
            champ: issue.path.map(String).join(".") || "input",
            messages: [issue.message]
        }))
    };
}

/**
 * Convertit les erreurs métier au format commun.
 */
function formatServiceError(
    code: string,
    message: string
) {
    return {
        code,
        message,
        details: []
    };
}

/**
 * Convertit les erreurs Prisma en GraphQLError.
 */
function toGraphQLError(error: unknown): GraphQLError {
    if (error instanceof GraphQLError) {
        return error;
    }

    const prismaError = error as {
        code?: string;
    };

    if (prismaError?.code === "P2002") {
        return new GraphQLError(
            "Cette annonce est déjà dans vos favoris.",
            {
                extensions: {
                    code: "CONFLICT"
                }
            }
        );
    }

    if (prismaError?.code === "P2025") {
        return new GraphQLError(
            "Favori introuvable.",
            {
                extensions: {
                    code: "NOT_FOUND"
                }
            }
        );
    }

    return new GraphQLError(
        "Une erreur interne est survenue.",
        {
            extensions: {
                code: "INTERNAL_SERVER_ERROR"
            }
        }
    );
}

/**
 * Encapsule les opérations pour gérer
 * les erreurs inattendues.
 */
async function executeSafely<T>(
    operation: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        // Les erreurs GraphQL prévues (401, 403, 404, validation...)
        // ne nécessitent pas de stack trace.
        if (!(error instanceof GraphQLError)) {

            if (process.env.NODE_ENV === "development") {
                // Diagnostic détaillé uniquement en développement local.
                console.error("Erreur GraphQL inattendue :", error);
            } else {
                // En test/CI et en production, aucun chemin interne.
                console.error("Erreur GraphQL inattendue");
            }
        }

        throw toGraphQLError(error);
    }
}

/**
 * Gestionnaire GraphQL des favoris.
 *
 * Les opérations réutilisent le service REST existant.
 * Aucune logique métier n'est dupliquée.
 */
export function createGraphqlFavoriResolvers(
    prisma: PrismaClient
) {
    const favoriService = createFavoriService(prisma);

    const rootValue = {

        // ─────────────────────── MUTATIONS ───────────────────────

        /**
         * Mutation.createFavori
         *
         * Ajouter une annonce aux favoris.
         */
        createFavori: async (
            { input }: CreateFavoriArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {

            // 1. Authentification
            const viewer = context.viewer;

            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise.",
                    {
                        extensions: {
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Validation des données avec Zod
            const validation = createFavoriSchema.safeParse({
                body: input
            });

            if (!validation.success) {
                return {
                    favori: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 3. Création via le service REST
            // userId provient exclusivement du JWT.
            const result = await favoriService.createFavori(
                viewer.id,
                validation.data.body
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {

                if (result.error === "CONFLICT") {
                    return {
                        favori: null,
                        erreur: formatServiceError(
                            "CONFLICT",
                            "Cette annonce est déjà dans vos favoris."
                        )
                    };
                }

                return {
                    favori: null,
                    erreur: formatServiceError(
                        "NOT_FOUND",
                        "Annonce introuvable."
                    )
                };
            }

            // 5. Succès
            return {
                favori: result,
                erreur: null
            };
        }),

        /**
         * Mutation.deleteFavori
         *
         * Retirer une annonce des favoris.
         */
        deleteFavori: async (
            { annonceId }: DeleteFavoriArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {

            // 1. Authentification
            const viewer = context.viewer;

            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise.",
                    {
                        extensions: {
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Validation de l'identifiant
            const validation = deleteFavoriSchema.safeParse({
                params: {
                    annonceId
                }
            });

            if (!validation.success) {
                return {
                    supprime: false,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 3. Suppression via le service REST
            const result = await favoriService.deleteFavori(
                viewer.id,
                validation.data.params.annonceId
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {
                return {
                    supprime: false,
                    erreur: formatServiceError(
                        "NOT_FOUND",
                        "Favori introuvable."
                    )
                };
            }

            // 5. Succès
            return {
                supprime: true,
                erreur: null
            };
        })
    };

    return rootValue;
}
