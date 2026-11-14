
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
        updateUser?: {
            user: {
                id: string;
                name: string;
                email: string;
                role: string;
            } | null;
            erreur: {
                code: string;
                message: string;
                details: {
                    champ: string;
                    messages: string[];
                }[];
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
    return `user-update-${Date.now()}-${Math.random()
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
            name: "Utilisateur Update",
            email,
            password: "MotDePasse123!",
        },
    });

    expect(result.errors).toBeUndefined();
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

const UPDATE_USER_MUTATION = `
    mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) {
            user {
                id
                name
                email
                role
            }
            erreur {
                code
                message
                details {
                    champ
                    messages
                }
            }
        }
    }
`;

describe("GraphQL User - Modification", () => {

    it("modifie le profil de l'utilisateur authentifié", async () => {
        const email = uniqueEmail();
        const password = "MotDePasse123!";

        const createdUser = await registerUser(email);
        const token = await login(email, password);

        const result = await graphql(
            UPDATE_USER_MUTATION,
            {
                id: createdUser.id,
                input: {
                    name: "Nom Modifié E2E",
                    email: uniqueEmail(),
                },
            },
            token
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.updateUser;

        expect(payload?.erreur).toBeNull();

        expect(payload?.user).toMatchObject({
            id: createdUser.id,
            name: "Nom Modifié E2E",
            role: "USER",
        });
    });

    it("refuse la modification avec des données invalides", async () => {
        const email = uniqueEmail();
        const password = "MotDePasse123!";

        const createdUser = await registerUser(email);
        const token = await login(email, password);

        const result = await graphql(
            UPDATE_USER_MUTATION,
            {
                id: createdUser.id,
                input: {
                    email: "email-invalide",
                },
            },
            token
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.updateUser;

        expect(payload?.user).toBeNull();
        expect(payload?.erreur?.code).toBe("VALIDATION_ERROR");
        expect(payload?.erreur?.details.length).toBeGreaterThan(0);
    });

    it("refuse la modification d'un utilisateur inexistant", async () => {
        const email = uniqueEmail();
        const password = "MotDePasse123!";

        await registerUser(email);
        const token = await login(email, password);

        const result = await graphql(
            UPDATE_USER_MUTATION,
            {
                id: "utilisateur-inexistant",
                input: {
                    name: "Nouveau nom",
                },
            },
            token
        );
       
        expect(result?.data?.updateUser?.erreur?.code).toBe("VALIDATION_ERROR");
    });

    it("refuse la modification sans authentification", async () => {
        const result = await graphql(
            UPDATE_USER_MUTATION,
            {
                id: "user-test",
                input: {
                    name: "Nom modifié",
                },
            }
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe(
            "UNAUTHORIZED"
        );
    });
});
