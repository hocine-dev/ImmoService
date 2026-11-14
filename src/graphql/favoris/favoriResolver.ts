
import { createHandler } from "graphql-http/lib/use/express";
import { buildSchema, GraphQLError } from "graphql";
import { z } from "zod";

import type { PrismaClient } from "../../generated/prisma/client.js";
import { createFavoriService } from "../../modules/favoris/favori.service.js";
import { createFavoriSchema, deleteFavoriSchema } from "../../modules/favoris/favori.schema.js";



/**
 * Schéma GraphQL des favoris.
 */
const schema = buildSchema(`

# ───────────────────────────── Scalaires ─────────────────────────────

scalar DateTime
scalar Decimal

# ───────────────────────────── Enums ─────────────────────────────────

enum AnnonceType {
    VENTE
    LOCATION
}

enum TypePropriete {
    APPARTEMENT
    MAISON
    VILLA
    STUDIO
    LOFT
}

enum EtatAnnonce {
    DISPONIBLE
    LOUE
    VENDU
}

enum StatutAnnonce {
    BROUILLON
    PUBLIE
}

# ───────────────────────────── Types ──────────────────────────────────

"""
Annonce associée au favori.
"""
type Annonce {
    id: ID!
    titre: String!
    description: String
    type: AnnonceType!
    typePropriete: TypePropriete!
    etat: EtatAnnonce!
    statut: StatutAnnonce!
    prix: Decimal!
    ville: String!
    surface: Int
    chambres: Int
    dateDisponibilite: DateTime
    auteurId: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
}

"""
Favori d'un utilisateur.
"""
type Favori {
    id: ID!
    userId: ID!
    annonceId: ID!
    annonce: Annonce!
}

# ───────────────────────────── Erreurs ────────────────────────────────

type ErreurChamp {
    champ: String!
    messages: [String!]!
}

type ErreurValidation {
    code: String!
    message: String!
    details: [ErreurChamp!]!
}

# ───────────────────────────── Inputs ─────────────────────────────────

"""
Données nécessaires pour ajouter une annonce aux favoris.
"""
input CreateFavoriInput {
    annonceId: ID!
}

# ───────────────────────────── Payloads ───────────────────────────────

type CreateFavoriPayload {
    favori: Favori
    erreur: ErreurValidation
}

type DeleteFavoriPayload {
    supprime: Boolean!
    erreur: ErreurValidation
}

# ───────────────────────────── Query ──────────────────────────────────

type Query {
    _empty: Boolean
}

# ───────────────────────────── Mutation ───────────────────────────────

type Mutation {

    """
    Ajouter une annonce aux favoris.
    Authentification obligatoire.
    """
    createFavori(input: CreateFavoriInput!): CreateFavoriPayload!

    """
    Retirer une annonce des favoris.
    Authentification obligatoire.
    """
    deleteFavori(annonceId: ID!): DeleteFavoriPayload!
}

`);

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
        console.error("Erreur GraphQL :", error);
        throw toGraphQLError(error);
    }
}

/**
 * Gestionnaire GraphQL des favoris.
 *
 * Les opérations réutilisent le service REST existant.
 * Aucune logique métier n'est dupliquée.
 */
export function createGraphqlFavoriHandler(
    prisma: PrismaClient
) {
    const favoriService = createFavoriService(prisma);

    const rootValue = {

        // ───────────────────────── QUERY ─────────────────────────

        /**
         * Query._empty
         *
         * Champ technique : ce module expose uniquement
         * des mutations pour le moment.
         */
        _empty: () => true,

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

    return createHandler({
        schema,
        rootValue,

        // Le middleware JWT Express fournit req.user.
        context: request => ({
            viewer: request.raw.user
        })
    });
}
