
import { createHandler } from "graphql-http/lib/use/express";
import { buildSchema, GraphQLError } from "graphql";

import type { PrismaClient } from "../../generated/prisma/client.js";

import { Role } from "../../modules/user/user.service.js";


/**
 * Schéma GraphQL
 */
const schema = buildSchema(`

# ───────────────────────────── Scalaires ─────────────────────────────

scalar DateTime

# ───────────────────────────── Types ──────────────────────────────────

"""
Auteur d'une question.
"""
type QuestionAuteur {
    id: ID!
    name: String!
}

"""
Question posée sur une annonce.
"""
type Question {
    id: ID!
    texte: String!
    annonceId: ID!
    auteurId: ID!
    createdAt: DateTime!
    auteur: QuestionAuteur
}

"""
Informations de pagination.
"""
type PageInfo {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
}

"""
Liste paginée des questions.
"""
type QuestionPage {
    data: [Question!]!
    pagination: PageInfo!
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
Données nécessaires pour poser une question.
"""
input CreateQuestionInput {
    texte: String!
    annonceId: ID!
}

# ───────────────────────────── Payloads ───────────────────────────────

type CreateQuestionPayload {
    question: Question
    erreur: ErreurValidation
}

type QuestionPagePayload {
    questionPage: QuestionPage
    erreur: ErreurValidation
}

type DeleteQuestionPayload {
    supprime: Boolean!
    erreur: ErreurValidation
}

# ───────────────────────────── Query ──────────────────────────────────

type Query {
    """
    Récupère les questions d'une annonce avec pagination.
    Consultation publique si l'annonce est publiée.
    """
    questionsByAnnonce(
        annonceId: ID!
        page: Int = 1
        limit: Int = 10
    ): QuestionPagePayload!
}

# ───────────────────────────── Mutation ──────────────────────────────

type Mutation {
    """
    Pose une question sur une annonce publiée.
    Authentification obligatoire.
    """
    createQuestion(input: CreateQuestionInput!): CreateQuestionPayload!

    """
    Supprime une question.
    Réservé à son auteur ou à un ADMIN.
    """
    deleteQuestion(id: ID!): DeleteQuestionPayload!
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

type PaginationArgs = {
    annonceId: string;
    page?: number;
    limit?: number;
};

type CreateQuestionArgs = {
    input: unknown;
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
 * Convertit les erreurs techniques en GraphQLError.
 */
function toGraphQLError(error: unknown): GraphQLError {
    if (error instanceof GraphQLError) {
        return error;
    }

    const prismaError = error as {
        code?: string;
    };

    if (prismaError?.code === "P2003") {
        return new GraphQLError(
            "Référence invalide.",
            {
                extensions: {
                    code: "BAD_USER_INPUT"
                }
            }
        );
    }

    if (prismaError?.code === "P2025") {
        return new GraphQLError(
            "Question introuvable.",
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
 * Gestionnaire GraphQL des questions.
 *
 * Les opérations réutilisent le service REST existant.
 * Les règles métier restent dans le service et la policy.
 */
export function createGraphqlQuestionHandler(
    prisma: PrismaClient
) {
    const questionService = createQuestionService(prisma);

    const rootValue = {

        // ───────────────────────── QUERY ─────────────────────────

        /**
         * Query.questionsByAnnonce
         *
         * Consultation publique des questions d'une annonce publiée.
         * Pour une annonce en brouillon, la policy autorise uniquement
         * l'ADMIN ou l'AGENT propriétaire.
         */
        questionsByAnnonce: async (
            args: PaginationArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {

            // 1. Validation de l'ID et de la pagination
            const validation = getQuestionsByAnnonceSchema.safeParse({
                params: {
                    annonceId: args.annonceId
                },
                query: {
                    page: args.page,
                    limit: args.limit
                }
            });

            if (!validation.success) {
                return {
                    questionPage: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 2. Récupération de l'utilisateur authentifié.
            // Si aucun JWT n'est fourni, viewer reste undefined.
            const viewer = context.viewer;

            // 3. Réutilisation du service REST.
            // Le service applique canViewQuestions().
            const result = await questionService.getQuestionsByAnnonce(
                validation.data.params.annonceId,
                viewer,
                validation.data.query.page,
                validation.data.query.limit
            );

            // 4. Annonce inexistante ou inaccessible
            if (result === null) {
                throw new GraphQLError(
                    "Annonce introuvable ou accès refusé.",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

            return {
                questionPage: result,
                erreur: null
            };
        }),

        // ─────────────────────── MUTATIONS ───────────────────────

        /**
         * Mutation.createQuestion
         *
         * Seul un utilisateur connecté peut poser une question.
         * L'auteur est récupéré depuis le JWT.
         */
        createQuestion: async (
            { input }: CreateQuestionArgs,
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

            // 2. Validation Zod
            const validation = createQuestionSchema.safeParse({
                body: input
            });

            if (!validation.success) {
                return {
                    question: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 3. Création via le service REST.
            // auteurId vient exclusivement du JWT.
            const question = await questionService.createQuestion({
                ...validation.data.body,
                auteurId: viewer.id
            });

            // 4. Annonce inexistante ou non publiée
            if (question === null) {
                throw new GraphQLError(
                    "Annonce introuvable.",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

            return {
                question,
                erreur: null
            };
        }),

        /**
         * Mutation.deleteQuestion
         *
         * L'auteur de la question ou un ADMIN peut la supprimer.
         */
        deleteQuestion: async (
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
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Validation de l'identifiant
            const validation = zQuestionId.safeParse(id);

            if (!validation.success) {
                return {
                    supprime: false,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 3. Suppression via le service REST
            const result = await questionService.deleteQuestion(
                validation.data,
                viewer.id,
                viewer.role
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {

                if (result.error === "FORBIDDEN") {
                    throw new GraphQLError(
                        "Vous n'êtes pas autorisé à supprimer cette question.",
                        {
                            extensions: {
                                code: "FORBIDDEN"
                            }
                        }
                    );
                }

                throw new GraphQLError(
                    "Question introuvable.",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

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
        // optionalAuthMiddleware laisse viewer undefined
        // lorsqu'aucun token n'est fourni.
        context: request => ({
            viewer: request.raw.user
        })
    });
}

/**
 * Validation simple de l'identifiant d'une question.
 */
import { z } from "zod";
import { createQuestionService } from "../../modules/questions/question.service.js";
import { createQuestionSchema, getQuestionsByAnnonceSchema } from "../../modules/questions/question.schema.js";

const zQuestionId = z.string()
    .trim()
    .min(1, "L'identifiant de la question est requis");
