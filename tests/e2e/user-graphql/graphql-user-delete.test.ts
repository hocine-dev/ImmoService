
import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql";
const AUTH_URL = "http://127.0.0.1:3002/auth/login";

type GraphQLResult = {
    data?: {
        registerUser?: {
            user: {
                id: string;
                email: string;
            } | null;
            erreur: {
                code: string;
                message: string;
            } | null;
        };
        deleteUser?: {
            supprime: boolean;
            erreur: {
                code: string;
                message: string;
            } | null;
        };
    };
    errors?: {
        message: string;
        extensions?: {
            code?: string;
        };
    }[];
};

async function graphql(
    query: string,
    variables?: Record<string, unknown>,
    token?: string
): Promise<GraphQLResult> {
    const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
        },
        body: JSON.stringify({ query, variables }),
    });

    return response.json() as Promise<GraphQLResult>;
}

function uniqueEmail() {
    return `user-delete-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}@example.test`;
}

async function registerUser(email: string) {
    const query = `
        mutation RegisterUser($input: CreateUserInput!) {
            registerUser(input: $input) {
                user {
                    id
                    email
                }
                erreur {
                    code
                    message
                }
            }
        }
    `;

    const result = await graphql(query, {
        input: {
            name: "Utilisateur Delete E2E",
            email,
            password: "MotDePasse123!",
        },
    });
    expect(result.data?.registerUser?.erreur).toBeNull();

    const user = result.data?.registerUser?.user;

    expect(user).not.toBeNull();

    return user!;
}

async function login(email: string, password: string) {
    const response = await fetch(AUTH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error("Échec de l'authentification E2E");
    }

    const token =
        result.token ??
        result.data?.token ??
        result.accessToken ??
        result.data?.accessToken;

    if (!token) {
        throw new Error(
            "Token JWT introuvable dans la réponse de connexion."
        );
    }

    return token as string;
}

const DELETE_USER_MUTATION = `
    mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) {
            supprime
            erreur {
                code
                message
            }
        }
    }
`;

describe("GraphQL User - Suppression", () => {

    it("supprime le compte de l'utilisateur authentifié", async () => {
        const email = uniqueEmail();
        const password = "MotDePasse123!";

        const createdUser = await registerUser(email);
        const token = await login(email, password);

        const result = await graphql(
            DELETE_USER_MUTATION,
            { id: createdUser.id },
            token
        );
       
        expect(result.errors).toBeUndefined();

        const payload = result.data?.deleteUser;

        expect(payload?.supprime).toBe(true);
        expect(payload?.erreur).toBeNull();
    });

    it("refuse la suppression d'un utilisateur inexistant", async () => {
        const email = uniqueEmail();
        const password = "MotDePasse123!";

        const createdUser = await registerUser(email);
        const token = await login(email, password);

        const result = await graphql(
            DELETE_USER_MUTATION,
            { id: "utilisateur-inexistant" },
            token
        );
        expect(result.data?.deleteUser?.supprime).toBe(false);
        expect(result.data?.deleteUser?.erreur?.code).toBe("VALIDATION_ERROR");

        // Le compte utilisé pour le test reste disponible.
        expect(createdUser.id).toBeDefined();

        await graphql(
            DELETE_USER_MUTATION,
            { id: createdUser.id },
            token
        );
    });

    it("refuse la suppression sans authentification", async () => {
        const result = await graphql(
            DELETE_USER_MUTATION,
            { id: "user-test" }
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe(
            "UNAUTHORIZED"
        );
    });

    it("refuse de supprimer le compte d'un autre utilisateur", async () => {
        const firstEmail = uniqueEmail();
        const secondEmail = uniqueEmail();
        const password = "MotDePasse123!";

        const firstUser = await registerUser(firstEmail);
        const secondUser = await registerUser(secondEmail);

        const firstToken = await login(firstEmail, password);

        const result = await graphql(
            DELETE_USER_MUTATION,
            { id: secondUser.id },
            firstToken
        );

        expect(result.data?.deleteUser?.supprime).toBe(false);
        expect(result.data?.deleteUser?.erreur?.code).toBe(
            "FORBIDDEN"
        );

        // Nettoyage des deux comptes avec leurs propres tokens.
        const secondToken = await login(secondEmail, password);

        await graphql(
            DELETE_USER_MUTATION,
            { id: firstUser.id },
            firstToken
        );

        await graphql(
            DELETE_USER_MUTATION,
            { id: secondUser.id },
            secondToken
        );
    });
});
