
import { createHandler } from "graphql-http/lib/use/express";
import { createUserService, DataType, Role } from "../../modules/user/user.service.js";
import { PrismaClient } from "../../generated/prisma/client.js";
import { createUserSchema, getUserByIdSchema, getUsersSchema, updateUserSchema } from "../../modules/user/user.schema.js";

import { buildSchema, GraphQLError } from "graphql";

const schema = buildSchema(`
 
# ─────────────────────────── Scalaires ───────────────────────────
 
"Date et heure au format ISO 8601."
scalar DateTime
 
"Montant décimal sérialisé en chaîne (ex. 250000.00), comme dans l'API REST."
scalar Decimal
   

# ───────────────────────────── Enums ─────────────────────────────

enum Role {
  USER
  AGENT
  ADMIN
}

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

# ───────────────────────────── Types ─────────────────────────────

"Utilisateur tel que retourné par l'inscription et la mise à jour."
type User {
  id: ID!
  name: String!
  email: String!
  role: Role!
  createdAt: DateTime!
  updatedAt: DateTime!
}

"Vue réduite d'un utilisateur, utilisée dans la liste (ADMIN uniquement)."
type UserSummary {
  id: ID!
  name: String!
  email: String!
  role: Role!
  createdAt: DateTime!
}

"Informations de pagination (calculées par le service)."
type PageInfo {
  page: Int!
  limit: Int!
  total: Int!
  pages: Int!
}

"Page d'utilisateurs."
type UserPage {
  data: [UserSummary!]!
  pagination: PageInfo!
}

"""
Annonce d'un utilisateur.
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
  createdAt: DateTime
}

"Pagination distincte pour les annonces et les favoris d'un profil."
type UserProfilePagination {
  annonces: PageInfo!
  favoris: PageInfo!
}

"""
Profil complet d'un utilisateur, avec ses annonces et ses favoris paginés.
"""
type UserProfile {
  id: ID!
  name: String!
  email: String!
  role: Role!
  createdAt: DateTime!
  updatedAt: DateTime!
  annonces: [Annonce!]!
  favoris: [Favori!]!
  pagination: UserProfilePagination!
}

# ───────────────────────────── Erreurs ────────────────────────────
type ErreurChamp {
        champ: String!
        messages: [String!]!
    }

type ErreurValidation {
        code: String!
        message: String!
        details: [ErreurChamp!]!
    }

# ───────────────────────────── Inputs ────────────────────────────

"""
Données d'inscription.
"""
input CreateUserInput {
  name: String!
  email: String!
  password: String!
}

"""
Données de modification. Tous les champs sont facultatifs.
"""
input UpdateUserInput {
  name: String
  email: String
  role: Role
}

# ───────────────────────────── Playlaod ─────────────────────────────

type CreateUserPayload {
  user: User
  erreur: ErreurValidation
}

type UpdateUserPayload {
  user: User
  erreur: ErreurValidation
}

"Résultat d'une suppression de compte."
type DeleteUserPayload {
    supprime: Boolean!
    erreur: ErreurValidation
}

type UserProfilePayload {
  user: UserProfile
  erreur: ErreurValidation
}

type UserPagePayload {
    userPage: UserPage
    erreur: ErreurValidation
}

# ───────────────────────────── Query ─────────────────────────────

type Query {
  """
  Liste paginée des utilisateurs.
  """
  users(page: Int = 1, limit: Int = 10): UserPagePayload!

  """
  Profil d'un utilisateur avec ses annonces et ses favoris.
  """
  user(id: ID!, page: Int = 1, limit: Int = 10): UserProfilePayload!
}

# ──────────────────────────── Mutation ───────────────────────────

type Mutation {
  """
  Inscription d'un nouvel utilisateur
  """
  registerUser(input: CreateUserInput!): CreateUserPayload!

  """
  Modifie un utilisateur.
  """
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!

  """
  Supprime un compte utilisateur.
  """
  deleteUser(id: ID!): DeleteUserPayload!
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
        console.error("Erreur GraphQL :", error);

        throw toGraphQLError(error);
    }
}

/**
 * Crée le gestionnaire GraphQL des utilisateurs.
 *
 * Les opérations réutilisent le service REST existant.
 * Aucune logique métier n'est dupliquée ici.
 */
export function createGraphqlUserHandler(
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
                throw new GraphQLError(
                    "Paramètres de pagination invalides",
                    {
                        extensions: {
                            code: "BAD_USER_INPUT",
                            details: validation.error.issues.map(issue => ({
                                champ: issue.path.map(String).join("."),
                                message: issue.message
                            }))
                        }
                    }
                );
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
                throw new GraphQLError(
                    "Paramètres de consultation invalides",
                    {
                        extensions: {
                            code: "BAD_USER_INPUT",
                            details: validation.error.issues.map(issue => ({
                                champ: issue.path.map(String).join("."),
                                message: issue.message
                            }))
                        }
                    }
                );
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
                    throw new GraphQLError(
                        "Vous n'êtes pas autorisé à supprimer ce compte.",
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

            // 5. Même réponse que le contrôleur REST
            return {
                supprime: true,
                erreur: null
            };
        })
    };

    return createHandler({
         schema,
        rootValue: {
            ...rootValue,
            ...mutationResolvers
        },

        // Le middleware JWT Express fournit req.user.
        context: request => ({
            viewer: request.raw.user
        })
    });
}