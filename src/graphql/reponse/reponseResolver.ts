
import { createHandler } from "graphql-http/lib/use/express";
import { buildSchema, GraphQLError } from "graphql";
import { z } from "zod";

import type { PrismaClient } from "../../generated/prisma/client.js";

import { Role } from "../../modules/user/user.service.js";
import { createReponseService } from "../../modules/reponses/reponse.service.js";

import {
    createReponseSchema,
    getReponseByQuestionSchema,
    deleteReponseSchema,
} from "../../modules/reponses/reponse.schema.js";

/**
 * Schéma GraphQL
 */
const schema = buildSchema(`
    scalar DateTime

    type ReponseAuteur {
        id: ID!
        name: String!
    }

    type Reponse {
        id: ID!
        texte: String!
        questionId: ID!
        auteurId: ID!
        createdAt: DateTime!
        auteur: ReponseAuteur
    }

    type ErreurChamp {
        champ: String!
        messages: [String!]!
    }

    type ErreurValidation {
        code: String!
        message: String!
        details: [ErreurChamp!]!
    }

    input CreateReponseInput {
        texte: String!
        questionId: ID!
    }

    type CreateReponsePayload {
        reponse: Reponse
        erreur: ErreurValidation
    }

    type ReponsePayload {
        reponse: Reponse
        erreur: ErreurValidation
    }

    type DeleteReponsePayload {
        supprime: Boolean!
        erreur: ErreurValidation
    }

    type Query {
        reponseByQuestion(questionId: ID!): ReponsePayload!
    }

    type Mutation {
        createReponse(input: CreateReponseInput!): CreateReponsePayload!
        deleteReponse(id: ID!): DeleteReponsePayload!
    }
`);

/**
 * Utilisateur authentifié par le middleware JWT.
 */
type UserViewer = {
    id: string;
    role: Role;
};

type GraphQLContext = {
    viewer?: UserViewer;
};

type CreateReponseArgs = {
    input: unknown;
};

type ReponseByQuestionArgs = {
    questionId: string;
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
            messages: [issue.message],
        })),
    };
}

/**
 * Convertit les erreurs techniques en GraphQLError.
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
            "Cette question a déjà une réponse.",
            {
                extensions: {
                    code: "CONFLICT",
                },
            }
        );
    }

    if (prismaError?.code === "P2003") {
        return new GraphQLError(
            "Référence invalide.",
            {
                extensions: {
                    code: "BAD_USER_INPUT",
                },
            }
        );
    }

    if (prismaError?.code === "P2025") {
        return new GraphQLError(
            "Réponse introuvable.",
            {
                extensions: {
                    code: "NOT_FOUND",
                },
            }
        );
    }

    return new GraphQLError(
        "Une erreur interne est survenue.",
        {
            extensions: {
                code: "INTERNAL_SERVER_ERROR",
            },
        }
    );
}

/**
 * Encapsule les opérations pour gérer les erreurs inattendues.
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
 * Gestionnaire GraphQL des réponses.
 *
 * Les opérations réutilisent le service REST existant.
 * Les règles métier restent dans le service.
 */
export function createGraphqlReponseHandler(
    prisma: PrismaClient
) {
    const reponseService = createReponseService(prisma);

    const rootValue = {

        // ───────────────────────── QUERY ─────────────────────────

        /**
         * Query.reponseByQuestion
         *
         * Consultation publique si l'annonce est publiée.
         * Pour une annonce en brouillon, la policy autorise
         * uniquement l'ADMIN ou l'AGENT propriétaire.
         */
        reponseByQuestion: async (
            args: ReponseByQuestionArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {

            // 1. Validation de l'identifiant de la question
            const validation = getReponseByQuestionSchema.safeParse({
                params: {
                    questionId: args.questionId,
                },
            });

            if (!validation.success) {
                return {
                    reponse: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    ),
                };
            }

            // 2. Récupération de l'utilisateur authentifié.
            // Si aucun JWT n'est fourni, viewer reste undefined.
            const viewer = context.viewer;

            // 3. Réutilisation du service REST.
            const reponse = await reponseService.getReponseByQuestion(
                validation.data.params.questionId,
                viewer
            );

            // 4. Question, annonce ou réponse inexistante
            // ou accès refusé : même erreur NOT_FOUND.
            if (!reponse) {
                throw new GraphQLError(
                    "Réponse introuvable.",
                    {
                        extensions: {
                            code: "NOT_FOUND",
                        },
                    }
                );
            }

            return {
                reponse,
                erreur: null,
            };
        }),

        // ─────────────────────── MUTATIONS ───────────────────────

        /**
         * Mutation.createReponse
         *
         * Seul un ADMIN ou l'AGENT propriétaire de l'annonce
         * peut répondre à une question.
         */
        createReponse: async (
            { input }: CreateReponseArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {

            // 1. Authentification
            const viewer = context.viewer;

            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise.",
                    {
                        extensions: {
                            code: "UNAUTHORIZED",
                        },
                    }
                );
            }

            // 2. Vérification du rôle
            if (
                viewer.role !== Role.ADMIN &&
                viewer.role !== Role.AGENT
            ) {
                throw new GraphQLError(
                    "Accès réservé aux agents et administrateurs.",
                    {
                        extensions: {
                            code: "FORBIDDEN",
                        },
                    }
                );
            }

            // 3. Validation Zod
            const validation = createReponseSchema.safeParse({
                body: input,
            });

            if (!validation.success) {
                return {
                    reponse: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    ),
                };
            }

            // 4. Création via le service REST.
            // L'auteur vient exclusivement du JWT.
            const result = await reponseService.createReponse(
                validation.data.body,
                {
                    id: viewer.id,
                    role: viewer.role,
                }
            );

            // 5. Gestion des erreurs métier
            if ("error" in result) {

                if (result.error === "FORBIDDEN") {
                    throw new GraphQLError(
                        "Accès refusé.",
                        {
                            extensions: {
                                code: "FORBIDDEN",
                            },
                        }
                    );
                }

                if (result.error === "NOT_FOUND") {
                    throw new GraphQLError(
                        "Question introuvable.",
                        {
                            extensions: {
                                code: "NOT_FOUND",
                            },
                        }
                    );
                }

                if (result.error === "CONFLICT") {
                    throw new GraphQLError(
                        "Cette question a déjà une réponse.",
                        {
                            extensions: {
                                code: "CONFLICT",
                            },
                        }
                    );
                }
            }

            return {
                reponse: result,
                erreur: null,
            };
        }),

        /**
         * Mutation.deleteReponse
         *
         * Seul l'auteur de la réponse ou un ADMIN peut la supprimer.
         */
        deleteReponse: async (
            { id }: { id: string },
            context: GraphQLContext
        ) => executeSafely(async () => {

            // 1. Authentification
            const viewer = context.viewer;

            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise.",
                    {
                        extensions: {
                            code: "UNAUTHORIZED",
                        },
                    }
                );
            }

            // 2. Validation de l'identifiant
            const validation = deleteReponseSchema.safeParse({
                params: { id },
            });

            if (!validation.success) {
                return {
                    supprime: false,
                    erreur: formatValidationError(
                        validation.error.issues
                    ),
                };
            }

            // 3. Suppression via le service REST
            const result = await reponseService.deleteReponse(
                validation.data.params.id,
                viewer.id,
                viewer.role
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {

                if (result.error === "FORBIDDEN") {
                    throw new GraphQLError(
                        "Vous n'êtes pas autorisé à supprimer cette réponse.",
                        {
                            extensions: {
                                code: "FORBIDDEN",
                            },
                        }
                    );
                }

                throw new GraphQLError(
                    "Réponse introuvable.",
                    {
                        extensions: {
                            code: "NOT_FOUND",
                        },
                    }
                );
            }

            return {
                supprime: true,
                erreur: null,
            };
        }),
    };

    return createHandler({
        schema,
        rootValue,

        // Le middleware JWT Express fournit req.user.
        // Le middleware d'authentification facultative laisse
        // viewer undefined lorsqu'aucun token n'est fourni.
        context: request => ({
            viewer: request.raw.user,
        }),
    });
}
