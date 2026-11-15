
import {
    buildSchema,
    GraphQLError,
    GraphQLObjectType
} from "graphql";
import { createHandler } from "graphql-http/lib/use/express";

import type { PrismaClient } from "../generated/prisma/client.js";

import { createAuteurLoader } from "./auteur.loader.js";
import { createGraphqlQuestionResolvers } from "./question/questionResolver.js";
import { createGraphqlFavoriResolvers } from "./favoris/favoriResolver.js";
import { createGraphqlReponseResolvers } from "./reponse/reponseResolver.js";
import { createGraphqlUserResolvers } from "./user/userResolver.js";

import {
    getAnnonceWriteScope
} from "../modules/annonces/annonce.policy.js";

import type {
    AnnonceViewer
} from "../modules/annonces/annonce.policy.js";

import { createAnnonceRepository } from "../modules/annonces/annonce.repository.js";
import {
    createAnnonceService,
    getAnnonceById,
    createAnnonce,
    updateAnnonce,
    deleteAnnonce,
    changeStatutAnnonce
} from "../modules/annonces/annonce.service.js";

import {
    annonceQuerySchema,
    annonceIdSchema,
    createAnnonceSchema,
    updateAnnonceSchema,
    changeStatutAnnonceRequestSchema
} from "../modules/annonces/annonce.schema.js";

/**
 * API GraphQL des annonces.
 *
 * Queries et mutations réutilisant les services REST.
 * Authentification JWT et autorisations communes.
 */
const schema = buildSchema(`
    type Annonce {
        id: ID!
        titre: String!
        auteur: Auteur!
        description: String
        type: String!
        typePropriete: String!
        etat: String
        prix: String!
        ville: String!
        surface: Int!
        chambres: Int!
        statut: String
        auteurId: ID
        createdAt: String!
        updatedAt: String
    }

    type Pagination {
        page: Int!
        limit: Int!
        total: Int!
        pages: Int!
    }

    type AnnoncesPage {
        data: [Annonce!]!
        pagination: Pagination
        erreur: ErreurValidation
    }

    type AnnonceQueryPayload {
        annonce: Annonce
        erreur: ErreurValidation
    }

    type Query {
        annonces(
            page: Int
            limit: Int
            ville: String
            type: String
            prixMax: String
        ): AnnoncesPage!

        annonce(id: ID!): AnnonceQueryPayload!

        questionsByAnnonce(
            annonceId: ID!
            page: Int = 1
            limit: Int = 10
        ): QuestionPagePayload!

        reponseByQuestion(questionId: ID!): ReponsePayload!

        users(page: Int = 1, limit: Int = 10): UserPagePayload!

        user(
            id: ID!
            page: Int = 1
            limit: Int = 10
        ): UserProfilePayload!
    }

    enum TypeTransaction {
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

    input CreerAnnonceInput {
        titre: String!
        description: String!
        type: TypeTransaction!
        typePropriete: TypePropriete!
        prix: String!
        ville: String!
        surface: Int!
        chambres: Int!
        etat: EtatAnnonce
        dateDisponibilite: String
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

    type CreerAnnoncePayload {
        annonce: Annonce
        erreur: ErreurValidation
    }

    input ModifierAnnonceInput {
        titre: String
        description: String
        type: TypeTransaction
        typePropriete: TypePropriete
        prix: String
        ville: String
        surface: Int
        chambres: Int
        etat: EtatAnnonce
        dateDisponibilite: String
    }

    type ModifierAnnoncePayload {
        annonce: Annonce
        erreur: ErreurValidation
    }

    type SupprimerAnnoncePayload {
        supprime: Boolean!
        erreur: ErreurValidation
    }

    enum StatutAnnonce {
        BROUILLON
        PUBLIE
    }

    type ChangerStatutAnnoncePayload {
        annonce: Annonce
        erreur: ErreurValidation
    }

    type Mutation {
        creerAnnonce(input: CreerAnnonceInput!): CreerAnnoncePayload!
        modifierAnnonce(
            id: ID!
            input: ModifierAnnonceInput!
        ): ModifierAnnoncePayload!
        supprimerAnnonce(id: ID!): SupprimerAnnoncePayload!
        changerStatutAnnonce(
            id: ID!
            statut: StatutAnnonce!
        ): ChangerStatutAnnoncePayload!
        createQuestion(input: CreateQuestionInput!): CreateQuestionPayload!
        deleteQuestion(id: ID!): DeleteQuestionPayload!
        createFavori(input: CreateFavoriInput!): CreateFavoriPayload!
        deleteFavori(annonceId: ID!): DeleteFavoriPayload!
        createReponse(input: CreateReponseInput!): CreateReponsePayload!
        deleteReponse(id: ID!): DeleteReponsePayload!
        registerUser(input: CreateUserInput!): CreateUserPayload!
        updateUser(
            id: ID!
            input: UpdateUserInput!
        ): UpdateUserPayload!
        deleteUser(id: ID!): DeleteUserPayload!
    }

    scalar DateTime

    type QuestionAuteur {
        id: ID!
        name: String!
    }

    type Question {
        id: ID!
        texte: String!
        annonceId: ID!
        auteurId: ID!
        createdAt: DateTime!
        auteur: QuestionAuteur
    }

    type QuestionPage {
        data: [Question!]!
        pagination: Pagination!
    }

    input CreateQuestionInput {
        texte: String!
        annonceId: ID!
    }

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

    type Favori {
        id: ID!
        userId: ID!
        annonceId: ID!
        annonce: Annonce
    }

    input CreateFavoriInput {
        annonceId: ID!
    }

    type CreateFavoriPayload {
        favori: Favori
        erreur: ErreurValidation
    }

    type DeleteFavoriPayload {
        supprime: Boolean!
        erreur: ErreurValidation
    }

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

    enum Role {
        USER
        AGENT
        ADMIN
    }

    type User {
        id: ID!
        name: String!
        email: String!
        role: Role!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type UserSummary {
        id: ID!
        name: String!
        email: String!
        role: Role!
        createdAt: DateTime!
    }

    type UserPage {
        data: [UserSummary!]!
        pagination: Pagination!
    }

    type UserProfilePagination {
        annonces: Pagination!
        favoris: Pagination!
    }

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

    input CreateUserInput {
        name: String!
        email: String!
        password: String!
    }

    input UpdateUserInput {
        name: String
        email: String
        role: Role
    }

    type CreateUserPayload {
        user: User
        erreur: ErreurValidation
    }

    type UpdateUserPayload {
        user: User
        erreur: ErreurValidation
    }

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

    type Auteur {
        id: ID!
        name: String!
    }
`);

/**
 * Resolver de la relation Annonce.auteur.
 *
 * Le modèle de liste REST ne contient pas auteurId.
 * Nous utilisons donc id, déjà disponible, pour
 * charger l'auteur via DataLoader.
 */
const annonceType = schema.getType("Annonce");

if (!(annonceType instanceof GraphQLObjectType)) {
    throw new Error("Type GraphQL Annonce introuvable");
}

annonceType.getFields().auteur.resolve = (
    annonce: { id: string },
    _args: unknown,
    context: {
        auteurLoader: ReturnType<typeof createAuteurLoader>;
    }
) => {
    return context.auteurLoader.load(annonce.id);
};

/**
 * Résout la relation Favori.annonce.
 *
 * Réutilise la consultation d'annonce existante,
 * avec les mêmes règles d'autorisation.
 */
const favoriType = schema.getType("Favori");

if (!(favoriType instanceof GraphQLObjectType)) {
    throw new Error("Type GraphQL Favori introuvable");
}

favoriType.getFields().annonce.resolve = (
    favori: { annonceId: string },
    _args: unknown,
    context: {
        chargerAnnonceFavori: (
            id: string
        ) => ReturnType<typeof getAnnonceById>;
    }
) => {
    return context.chargerAnnonceFavori(favori.annonceId);
};

type ListeArgs = {
    page?: number;
    limit?: number;
    ville?: string;
    type?: string;
    prixMax?: string;
};

/**
 * Crée le gestionnaire GraphQL en réutilisant
 * les services REST et le même client Prisma.
 */
export function createGraphqlAnnonceHandler(
    prisma: PrismaClient
) {
    const repository = createAnnonceRepository(prisma);
    const service = createAnnonceService(repository);

    const rootValue = {
        /**
         * Query.annonces
         * Liste publique avec pagination et filtres.
         */
        annonces: async (args: ListeArgs) => {
            // Zod attend page et limit sous forme
            // de chaînes, comme dans les requêtes REST.
            const result = annonceQuerySchema.safeParse({
                page: args.page === undefined
                    ? undefined
                    : String(args.page),

                limit: args.limit === undefined
                    ? undefined
                    : String(args.limit),

                ville: args.ville,
                type: args.type,
                prixMax: args.prixMax
            });

            if (!result.success) {
                return {
                    data: [],
                    pagination: null,
                    erreur: {
                        code: "VALIDATION_ERROR",
                        message: "Paramètres d'annonces invalides",
                        details: result.error.issues.map(issue => ({
                            champ: issue.path.join(".") || "query",
                            messages: [issue.message]
                        }))
                    }
                };
            }

            return {
                ...(await service.listAnnonces(result.data)),
                erreur: null
            };
        },


        annonce: async (
            { id }: { id: string },
            context: { viewer?: AnnonceViewer }
        ) => {
            // Valider l'identifiant reçu.
            const result = annonceIdSchema.safeParse({ id });

            if (!result.success) {
                return {
                    annonce: null,
                    erreur: {
                        code: "VALIDATION_ERROR",
                        message: "Identifiant d'annonce invalide",
                        details: result.error.issues.map(issue => ({
                            champ: issue.path.join(".") || "id",
                            messages: [issue.message]
                        }))
                    }
                };
            }

            // Réutiliser la politique d'accès REST.
            // Le Repository décide si le demandeur
            // peut consulter cette annonce.
            return {
                annonce: await getAnnonceById(
                    repository,
                    result.data.id,
                    context.viewer
                ),
                erreur: null
            };
        }

    };

    /**
     * Mutation.creerAnnonce
     *
     * Réutilise les règles métier REST :
     * - Authentification par JWT
     * - Autorisation AGENT / ADMIN
     * - Validation Zod
     * - Création en BROUILLON
     */
    const mutationResolvers = {
        creerAnnonce: async (
            { input }: { input: unknown },
            context: { viewer?: AnnonceViewer }
        ) => {
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
            // Même politique que les opérations REST.
            if (getAnnonceWriteScope(user) === null) {
                throw new GraphQLError(
                    "Accès réservé aux agents et administrateurs",
                    {
                        extensions: {
                            code: "FORBIDDEN"
                        }
                    }
                );
            }

            // 3. Validation des données avec le schéma REST
            const validation = createAnnonceSchema.safeParse(input);

            if (!validation.success) {
                return {
                    annonce: null,
                    erreur: {
                        code: "VALIDATION_ERROR",
                        message: "Données de création invalides",
                        details: validation.error.issues.map(issue => ({
                            champ: issue.path.join(".") || "input",
                            messages: [issue.message]
                        }))
                    }
                };
            }

            // 4. Création via le service métier existant.
            // L'identifiant auteurId vient du JWT.
            const annonce = await createAnnonce(
                repository,
                validation.data,
                user.id
            );

            return {
                annonce,
                erreur: null
            };
        },

        modifierAnnonce: async (
            {
                id,
                input
            }: {
                id: string;
                input: unknown;
            },
            context: { viewer?: AnnonceViewer }
        ) => {
            const user = context.viewer;

            // 1. Authentification
            if (!user?.id) {
                throw new GraphQLError(
                    "Authentification requise",
                    {
                        extensions: { code: "UNAUTHORIZED" }
                    }
                );
            }

            // 2. Autorisation
            // Même politique que REST :
            // seuls AGENT et ADMIN peuvent modifier.
            if (getAnnonceWriteScope(user) === null) {
                throw new GraphQLError(
                    "Accès interdit",
                    {
                        extensions: { code: "FORBIDDEN" }
                    }
                );
            }

            // 3. Validation de l'identifiant et des données
            const idResult = annonceIdSchema.safeParse({ id });
            const inputResult = updateAnnonceSchema.safeParse(input);

            if (!idResult.success || !inputResult.success) {
                const details = [
                    ...(!idResult.success
                        ? idResult.error.issues.map(issue => ({
                            champ: "id",
                            messages: [issue.message]
                        }))
                        : []),

                    ...(!inputResult.success
                        ? inputResult.error.issues.map(issue => ({
                            champ: issue.path.join(".") || "input",
                            messages: [issue.message]
                        }))
                        : [])
                ];

                return {
                    annonce: null,
                    erreur: {
                        code: "VALIDATION_ERROR",
                        message: "Données de modification invalides",
                        details
                    }
                };
            }

            // 4. Modification avec la même logique métier REST.
            // Le Repository vérifie le propriétaire.
            const annonce = await updateAnnonce(
                repository,
                idResult.data.id,
                inputResult.data,
                user.id,
                user.role === "ADMIN"
            );

            // 5. Annonce inexistante ou inaccessible.
            // On ne révèle pas son existence à un autre agent.
            if (!annonce) {
                throw new GraphQLError(
                    "Annonce introuvable",
                    {
                        extensions: { code: "NOT_FOUND" }
                    }
                );
            }

            return {
                annonce,
                erreur: null
            };
        },

        /**
         * Mutation.supprimerAnnonce
         *
         * Supprime une annonce en réutilisant le service REST.
         *
         * Sécurité :
         * - JWT obligatoire
         * - AGENT propriétaire ou ADMIN
         * - Protection IDOR dans le Repository
         */
        supprimerAnnonce: async (
            { id }: { id: string },
            context: { viewer?: AnnonceViewer }
        ) => {
            const user = context.viewer;

            // 1. Authentification : JWT obligatoire.
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

            // 2. Autorisation : seuls AGENT et ADMIN.
            if (getAnnonceWriteScope(user) === null) {
                throw new GraphQLError(
                    "Accès interdit",
                    {
                        extensions: {
                            code: "FORBIDDEN"
                        }
                    }
                );
            }

            // 3. Validation de l'identifiant avec Zod.
            const validation = annonceIdSchema.safeParse({ id });

            if (!validation.success) {
                return {
                    supprime: false,
                    erreur: {
                        code: "VALIDATION_ERROR",
                        message: "Identifiant d'annonce invalide",
                        details: validation.error.issues.map(
                            issue => ({
                                champ: issue.path.join(".") || "id",
                                messages: [issue.message]
                            })
                        )
                    }
                };
            }

            // 4. Suppression via le service REST existant.
            // Le Repository vérifie les droits directement
            // lors de l'opération PostgreSQL.
            const supprime = await deleteAnnonce(
                repository,
                validation.data.id,
                user.id,
                user.role === "ADMIN"
            );

            // 5. Annonce inexistante ou non accessible.
            // On ne révèle pas son existence à un autre agent.
            if (!supprime) {
                throw new GraphQLError(
                    "Annonce introuvable",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

            // 6. Suppression réussie.
            return {
                supprime: true,
                erreur: null
            };
        },

        /**
         * Mutation.changerStatutAnnonce
         *
         * Publie ou dépublie une annonce.
         *
         * Réutilise :
         * - l'authentification JWT REST ;
         * - la politique d'autorisation ;
         * - la validation Zod REST ;
         * - le service métier existant ;
         * - la protection IDOR du Repository.
         */
        changerStatutAnnonce: async (
            {
                id,
                statut
            }: {
                id: string;
                statut: string;
            },
            context: { viewer?: AnnonceViewer }
        ) => {
            const user = context.viewer;

            // 1. Authentification obligatoire.
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

            // 2. Autorisation : AGENT ou ADMIN.
            if (getAnnonceWriteScope(user) === null) {
                throw new GraphQLError(
                    "Accès interdit",
                    {
                        extensions: {
                            code: "FORBIDDEN"
                        }
                    }
                );
            }

            // 3. Validation avec le schéma REST existant.
            // On valide simultanément l'ID et le statut.
            const validation =
                changeStatutAnnonceRequestSchema.safeParse({
                    params: { id },
                    body: { statut }
                });

            if (!validation.success) {
                return {
                    annonce: null,
                    erreur: {
                        code: "VALIDATION_ERROR",
                        message: "Changement de statut invalide",
                        details: validation.error.issues.map(
                            issue => ({
                                champ: issue.path.join(".") || "input",
                                messages: [issue.message]
                            })
                        )
                    }
                };
            }

            // 4. Réutiliser le service REST.
            // Le Repository vérifie le propriétaire
            // pendant l'opération PostgreSQL.
            const annonce = await changeStatutAnnonce(
                repository,
                validation.data.params.id,
                validation.data.body.statut,
                user.id,
                user.role === "ADMIN"
            );

            // 5. Annonce inexistante ou inaccessible.
            if (!annonce) {
                throw new GraphQLError(
                    "Annonce introuvable",
                    {
                        extensions: {
                            code: "NOT_FOUND"
                        }
                    }
                );
            }

            // 6. Retourner le résultat.
            return {
                annonce,
                erreur: null
            };
        }
    };

    return createHandler({
        schema,
        rootValue: {
            ...rootValue,
            ...mutationResolvers,
            ...createGraphqlQuestionResolvers(prisma),
            ...createGraphqlFavoriResolvers(prisma),
            ...createGraphqlReponseResolvers(prisma),
            ...createGraphqlUserResolvers(prisma)
        },

        // Le middleware JWT Express a déjà
        // authentifié l'utilisateur.
        context: (request) => ({
            viewer: request.raw.user,

            // Nouvelle instance pour chaque requête HTTP.
            // Aucun cache partagé entre utilisateurs.
            auteurLoader: createAuteurLoader(prisma),

            chargerAnnonceFavori: (id: string) =>
                getAnnonceById(
                    repository,
                    id,
                    request.raw.user
                )
        })
    });
}
