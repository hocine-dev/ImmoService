
import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql/users";
const AUTH_URL = "http://127.0.0.1:3002/auth/login";

type GraphQLResult = {
    data?: {
        users?: {
            userPage: {
                data: {
                    id: string;
                    name: string;
                    email: string;
                    role: string;
                    createdAt: string;
                }[];
                pagination: {
                    page: number;
                    limit: number;
                    total: number;
                    pages: number;
                };
            } | null;
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
        body: JSON.stringify({ query }),
    });

    return response.json() as Promise<GraphQLResult>;
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

const USERS_QUERY = `
    query {
        users {
            userPage {
                data {
                    id
                    name
                    email
                    role
                    createdAt
                }
                pagination {
                    page
                    limit
                    total
                    pages
                }
            }
            erreur {
                code
                message
            }
        }
    }
`;

describe("GraphQL User - Liste des utilisateurs", () => {

    it("permet à un ADMIN de récupérer la liste des utilisateurs", async () => {
        const token = await login(
            process.env.SEED_ADMIN_EMAIL!,
            process.env.SEED_ADMIN_PASSWORD!
        );

        const result = await graphql(USERS_QUERY, token);

        expect(result.errors).toBeUndefined();

        const payload = result.data?.users;

        expect(payload).toBeDefined();
        expect(payload?.erreur).toBeNull();

        expect(payload?.userPage).not.toBeNull();
        expect(Array.isArray(payload?.userPage?.data)).toBe(true);

        expect(payload?.userPage?.pagination).toMatchObject({
            page: 1,
            limit: 10,
        });
    });

    it("permet à un ADMIN de récupérer une page précise", async () => {
        const token = await login(
            process.env.SEED_ADMIN_EMAIL!,
            process.env.SEED_ADMIN_PASSWORD!
        );

        const query = `
            query {
                users(page: 1, limit: 5) {
                    userPage {
                        data {
                            id
                            name
                            email
                            role
                        }
                        pagination {
                            page
                            limit
                            total
                            pages
                        }
                    }
                    erreur {
                        code
                        message
                    }
                }
            }
        `;

        const result = await graphql(query, token);

        expect(result.errors).toBeUndefined();

        const payload = result.data?.users;

        expect(payload?.erreur).toBeNull();
        expect(payload?.userPage?.pagination).toMatchObject({
            page: 1,
            limit: 5,
        });

        expect(payload?.userPage?.data.length).toBeLessThanOrEqual(5);
    });

    it("refuse l'accès à un utilisateur USER", async () => {
        const token = await login(
            process.env.SEED_USER_1_EMAIL!,
            process.env.SEED_USER_1_PASSWORD!
        );

        const result = await graphql(USERS_QUERY, token);

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
    });

    it("refuse l'accès sans authentification", async () => {
        const result = await graphql(USERS_QUERY);

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("UNAUTHORIZED");
    });

    it("refuse une pagination invalide", async () => {
        const token = await login(
            process.env.SEED_ADMIN_EMAIL!,
            process.env.SEED_ADMIN_PASSWORD!
        );

        const query = `
            query {
                users(page: 0, limit: 10) {
                    userPage {
                        data {
                            id
                        }
                        pagination {
                            page
                            limit
                            total
                            pages
                        }
                    }
                    erreur {
                        code
                        message
                    }
                }
            }
        `;

        const result = await graphql(query, token);

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe(
            "BAD_USER_INPUT"
        );
    });
});
