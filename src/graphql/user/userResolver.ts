
import { createUserService, DataType, Role } from "../../modules/user/user.service.js";
import { PrismaClient } from "../../generated/prisma/client.js";
import { createUserSchema, getUserByIdSchema, getUsersSchema, updateUserSchema } from "../../modules/user/user.schema.js";

import { GraphQLError } from "graphql";




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
    page?: number;
    limit?: number;
};

type UserIdArgs = PaginationArgs & {
    id: string;
};

type CreateUserArgs = {
    input: unknown;
};

type UpdateUserArgs = {
    id: string;
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
 * Convertit les erreurs métier du service.
 */
function formatServiceError(
    code: string,
    message: string,
    details: {
        champ: string;
        messages: string[];
    }[] = []
) {
    return {
        code,
        message,
        details
    };
}

/**
 * Évite de renvoyer les erreurs internes de Prisma
 * ou les détails techniques au client GraphQL.
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
            "Cette donnée existe déjà.",
            {
                extensions: {
                    code: "CONFLICT"
                }
            }
        );
    }

    if (prismaError?.code === "P2025") {
        return new GraphQLError(
            "Utilisateur introuvable.",
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
 * Crée le gestionnaire GraphQL des utilisateurs.
 *
 * Les opérations réutilisent le service REST existant.
 * Aucune logique métier n'est dupliquée ici.
 */
export function createGraphqlUserResolvers(
    prisma: PrismaClient
) {
    const userService = createUserService(prisma);

    /**
     * Queries
     */
    const rootValue = {
        /**
         * Query.users
         *
         * Liste des utilisateurs réservée aux ADMIN.
         */
        users: async (
            args: PaginationArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {
            const user = context.viewer;

            // 1. Authentification
            if (!user?.id) {
                throw new GraphQLError(
                    "Authentification requise",
                    {
                        extensions: {
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Autorisation
            if (user.role !== Role.ADMIN) {
                throw new GraphQLError(
                    "Accès réservé aux administrateurs",
                    {
                        extensions: {
                            code: "FORBIDDEN"
                        }
                    }
                );
            }

            // 3. Validation de la pagination
            const validation = getUsersSchema.safeParse({
                query: {
                    page: args.page,
                    limit: args.limit
                }
            });

            if (!validation.success) {
                return {
                    userPage: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 4. Réutilisation du service REST
            const result = await userService.getAllUsers(
                user.role,
                validation.data.query.page,
                validation.data.query.limit
            );

            if (result === null) {
                throw new GraphQLError(
                    "Accès interdit",
                    {
                        extensions: {
                            code: "FORBIDDEN"
                        }
                    }
                );
            }

            return {
                userPage: result,
                erreur: null
            };
        }),

        /**
         * Query.user
         *
         * Un utilisateur peut consulter son profil.
         * Un ADMIN peut consulter tous les profils.
         */
        user: async (
            args: UserIdArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {
            const viewer = context.viewer;

            // 1. Authentification
            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise",
                    {
                        extensions: {
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Validation de l'ID et de la pagination
            const validation = getUserByIdSchema.safeParse({
                params: {
                    id: args.id
                },
                query: {
                    page: args.page,
                    limit: args.limit
                }
            });

            if (!validation.success) {
                return {
                    user: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 3. Réutilisation du service REST.
            // Le service vérifie les droits d'accès au profil.
            const result = await userService.getUserById(
                validation.data.params.id,
                viewer.id,
                viewer.role,
                validation.data.query.page,
                validation.data.query.limit
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {
                if (result.error === "FORBIDDEN") {
                    throw new GraphQLError(
                        "Vous n'êtes pas autorisé à consulter ce profil.",
                        {
                            extensions: {
                                code: "FORBIDDEN"
                            }
                        }
                    );
                }

                throw new GraphQLError(
                    "Utilisateur introuvable.",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

            return {
                user: result,
                erreur: null
            };
        })
    };

    /**
     * Mutations
     */
    const mutationResolvers = {
        /**
         * Mutation.registerUser
         *
         * Inscription publique.
         */
        registerUser: async (
            { input }: CreateUserArgs
        ) => executeSafely(async () => {
            // 1. Validation avec le schéma REST
            const validation = createUserSchema.safeParse({
                body: input
            });

            if (!validation.success) {
                return {
                    user: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 2. Création via le service REST
            const result = await userService.createUser(
                validation.data.body
            );

            // 3. Gestion du conflit email
            if ("error" in result) {
                const details = Object.entries(
                    result.details
                ).map(([champ, messages]) => ({
                    champ,
                    messages
                }));

                return {
                    user: null,
                    erreur: formatServiceError(
                        "CONFLICT",
                        "Cet email est déjà utilisé.",
                        details
                    )
                };
            }

            return {
                user: result,
                erreur: null
            };
        }),

        /**
         * Mutation.updateUser
         *
         * Un utilisateur peut modifier son profil.
         * Un ADMIN peut modifier les autres profils.
         */
        updateUser: async (
            args: UpdateUserArgs,
            context: GraphQLContext
        ) => executeSafely(async () => {
            const viewer = context.viewer;

            // 1. Authentification
            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise",
                    {
                        extensions: {
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Validation de l'ID et des données
            const validation = updateUserSchema.safeParse({
                params: {
                    id: args.id
                },
                body: args.input
            });

            if (!validation.success) {
                return {
                    user: null,
                    erreur: formatValidationError(
                        validation.error.issues
                    )
                };
            }

            // 3. Réutilisation du service REST.
            // Le service vérifie les droits et applique
            // le rôle uniquement si l'utilisateur est ADMIN.
            const result = await userService.updateUser(
                validation.data.params.id,
                viewer.id,
                viewer.role,
                validation.data.body as DataType
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {
                if (result.error === "FORBIDDEN") {
                    throw new GraphQLError(
                        "Vous n'êtes pas autorisé à modifier ce profil.",
                        {
                            extensions: {
                                code: "FORBIDDEN"
                            }
                        }
                    );
                }

                throw new GraphQLError(
                    "Utilisateur introuvable.",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

            return {
                user: result,
                erreur: null
            };
        }),

        /**
         * Mutation.deleteUser
         *
         * Un utilisateur peut supprimer son compte.
         * Un ADMIN peut supprimer un autre compte.
         */
        deleteUser: async (
            { id }: { id: string },
            context: GraphQLContext
        ) => executeSafely(async () => {
            const viewer = context.viewer;

            // 1. Authentification
            if (!viewer?.id) {
                throw new GraphQLError(
                    "Authentification requise",
                    {
                        extensions: {
                            code: "UNAUTHORIZED"
                        }
                    }
                );
            }

            // 2. Validation de l'identifiant
            const validation = getUserByIdSchema.safeParse({
                params: { id },
                query: {
                    page: 1,
                    limit: 10
                }
            });

            if (!validation.success) {
                return {
                    supprime: false,
                    erreur: formatValidationError(validation.error.issues)
                };
            }

            // 3. Suppression via le service REST
            const result = await userService.deleteUser(
                validation.data.params.id,
                viewer.id,
                viewer.role
            );

            // 4. Gestion des erreurs métier
            if ("error" in result) {
                if (result.error === "FORBIDDEN") {
                    return {
                        supprime: false,
                        erreur: {
                            code:"FORBIDDEN",
                            message:"Vous n'êtes pas autorisé à supprimer ce compte.",
                            details:{}
                        }
                    };
                }
                if (result.error === "NOT_FOUND"){
                    return {
                        supprime: false,
                        erreur: {
                            code:"NOT_FOUND",
                            message:"Utilisateur introuvable.",
                            details:{}
                        }
                    };
                }
            }

            // 5. Même réponse que le contrôleur REST
            return {
                supprime: true,
                erreur: null
            };
        })
    };

    return {
        ...rootValue,
        ...mutationResolvers
    };
}
