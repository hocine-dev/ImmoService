
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
        user?: {
            user: {
                id: string;
                name: string;
                email: string;
                role: string;
                createdAt: string;
                updatedAt: string;
                annonces: {
                    id: string;
                    titre: string;
                }[];
                favoris: {
                    id: string;
                    annonceId: string;
                }[];
                pagination: {
                    annonces: {
                        page: number;
                        limit: number;
                        total: number;
                        pages: number;
                    };
                    favoris: {
                        page: number;
                        limit: number;
                        total: number;
                        pages: number;
                    };
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

function uniqueEmail() {
    return `user-get-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}@example.test`;
}

async function registerUser(email: string) {
    const query = `
        mutation {
            registerUser(input: {
                name: "Utilisateur Get E2E"
                email: "${email}"
                password: "MotDePasse123!"
            }) {
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

    const result = await graphql(query);

    expect(result.errors).toBeUndefined();
    expect(result.data?.registerUser?.erreur).toBeNull();

    const user = result.data?.registerUser?.user;

    expect(user).not.toBeNull();

    return user!;
}

function getUserQuery(id: string) {
    return `
        query {
            user(id: "${id}") {
                user {
                    id
                    name
                    email
                    role
                    createdAt
                    updatedAt
                    annonces {
                        id
                        titre
                    }
                    favoris {
                        id
                        annonceId
                    }
                    pagination {
                        annonces {
                            page
                            limit
                            total
                            pages
                        }
                        favoris {
                            page
                            limit
                            total
                            pages
                        }
                    }
                }
                erreur {
                    code
                    message
                }
            }
        }
    `;
}

describe("GraphQL User - Consultation du profil", () => {

    it("permet à un utilisateur de consulter son propre profil", async () => {
        const email = uniqueEmail();
        const password = "MotDePasse123!";

        const createdUser = await registerUser(email);
        const token = await login(email, password);

        const result = await graphql(
            getUserQuery(createdUser.id),
            token
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.user;

        expect(payload?.erreur).toBeNull();

        expect(payload?.user).toMatchObject({
            id: createdUser.id,
            email,
            role: "USER",
        });

        expect(payload?.user?.pagination.annonces).toMatchObject({
            page: 1,
            limit: 10,
        });

        expect(payload?.user?.pagination.favoris).toMatchObject({
            page: 1,
            limit: 10,
        });
    });

    it("permet à un ADMIN de consulter le profil d'un autre utilisateur", async () => {
        const email = uniqueEmail();

        const createdUser = await registerUser(email);

        const adminToken = await login(
            process.env.SEED_ADMIN_EMAIL!,
            process.env.SEED_ADMIN_PASSWORD!
        );

        const result = await graphql(
            getUserQuery(createdUser.id),
            adminToken
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.user;

        expect(payload?.erreur).toBeNull();

        expect(payload?.user).toMatchObject({
            id: createdUser.id,
            email,
            role: "USER",
        });
    });

    it("refuse à un utilisateur USER de consulter le profil d'un autre utilisateur", async () => {
        const firstEmail = uniqueEmail();
        const secondEmail = uniqueEmail();

        const firstUser = await registerUser(firstEmail);
        const secondUser = await registerUser(secondEmail);

        const firstToken = await login(
            firstEmail,
            "MotDePasse123!"
        );

        const result = await graphql(
            getUserQuery(secondUser.id),
            firstToken
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
    });

    it("refuse la consultation d'un utilisateur inexistant", async () => {
        const email = uniqueEmail();

        await registerUser(email);

        const token = await login(
            email,
            "MotDePasse123!"
        );

        const result = await graphql(
            getUserQuery("utilisateur-inexistant"),
            token
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
    });

    it("refuse la consultation sans authentification", async () => {
        const result = await graphql(
            getUserQuery("user-test")
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe(
            "UNAUTHORIZED"
        );
    });
});
