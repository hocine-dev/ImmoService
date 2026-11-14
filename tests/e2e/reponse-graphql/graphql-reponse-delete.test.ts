
import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql";
const QUESTIONS_GRAPHQL_URL = "http://127.0.0.1:3002/graphql";
const LOGIN_URL = "http://127.0.0.1:3002/auth/login";

const ANNONCE_ID = "demo-immo-annonce-01";

type GraphQLResult = {
    data?: any;
    errors?: {
        message: string;
        extensions?: {
            code?: string;
        };
    }[];
};

async function graphql(
    url: string,
    query: string,
    token?: string
): Promise<GraphQLResult> {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query })
    });

    return response.json() as Promise<GraphQLResult>;
}

async function getToken(email: string, password: string) {
    const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    });

    const result = await response.json() as any;

    const token =
        result.token ??
        result.data?.token ??
        result.accessToken ??
        result.data?.accessToken;

    if (!token) {
        throw new Error("Impossible de récupérer le token");
    }

    return token;
}

const getAdminToken = () =>
    getToken(
        process.env.SEED_ADMIN_EMAIL!,
        process.env.SEED_ADMIN_PASSWORD!
    );

const getUserToken = () =>
    getToken(
        process.env.SEED_USER_1_EMAIL!,
        process.env.SEED_USER_1_PASSWORD!
    );

const getUser2Token = () =>
    getToken(
        process.env.SEED_USER_2_EMAIL!,
        process.env.SEED_USER_2_PASSWORD!
    );

// Création de la question via le resolver questions.
async function createQuestion(token: string) {
    const result = await graphql(
        QUESTIONS_GRAPHQL_URL,
        `mutation {
            createQuestion(input: {
                texte: "Question DELETE E2E ${Date.now()}"
                annonceId: "${ANNONCE_ID}"
            }) {
                question {
                    id
                }
                erreur {
                    code
                    message
                }
            }
        }`,
        token
    );

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    const questionId = result.data?.createQuestion?.question?.id;

    if (!questionId) {
        throw new Error(
            result.data?.createQuestion?.erreur?.message ??
            "Impossible de créer la question E2E"
        );
    }

    return questionId as string;
}

// Création de la réponse via le resolver reponses.
async function createReponse(questionId: string, token: string) {
    const result = await graphql(
        GRAPHQL_URL,
        `mutation {
            createReponse(input: {
                texte: "Réponse DELETE E2E ${Date.now()}"
                questionId: "${questionId}"
            }) {
                reponse {
                    id
                }
            }
        }`,
        token
    );

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    const reponseId = result.data?.createReponse?.reponse?.id;

    if (!reponseId) {
        throw new Error(
            result.data?.createReponse?.erreur?.message ??
            "Impossible de créer la réponse E2E"
        );
    }

    return reponseId as string;
}

async function createTestReponse(token: string) {
    const questionId = await createQuestion(token);
    return createReponse(questionId, token);
}

describe("GraphQL - Delete Reponse", () => {

    it("supprime une réponse par son auteur", async () => {
        const adminToken = await getAdminToken();

        const reponseId = await createTestReponse(adminToken);

        const result = await graphql(
            GRAPHQL_URL,
            `mutation {
                deleteReponse(id: "${reponseId}") {
                    supprime
                    erreur {
                        code
                        message
                    }
                }
            }`,
            adminToken
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.deleteReponse;

        expect(payload.supprime).toBe(true);
        expect(payload.erreur).toBeNull();
    });

    it("supprime une réponse en tant qu'administrateur", async () => {
        const adminToken = await getAdminToken();

        const reponseId = await createTestReponse(adminToken);

        const result = await graphql(
            GRAPHQL_URL,
            `mutation {
                deleteReponse(id: "${reponseId}") {
                    supprime
                    erreur {
                        code
                        message
                    }
                }
            }`,
            adminToken
        );

        expect(result.errors).toBeUndefined();
        expect(result.data?.deleteReponse?.supprime).toBe(true);
        expect(result.data?.deleteReponse?.erreur).toBeNull();
    });

    it("refuse la suppression par un autre utilisateur", async () => {
        const adminToken = await getAdminToken();
        const user2Token = await getUser2Token();

        const reponseId = await createTestReponse(adminToken);

        const result = await graphql(
            GRAPHQL_URL,
            `mutation {
                deleteReponse(id: "${reponseId}") {
                    supprime
                    erreur {
                        code
                        message
                    }
                }
            }`,
            user2Token
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
    });

    it("retourne NOT_FOUND pour une réponse inexistante", async () => {
        const adminToken = await getAdminToken();

        const result = await graphql(
            GRAPHQL_URL,
            `mutation {
                deleteReponse(id: "clxxxxxxxxxxxxxxxxxxxxxxxx") {
                    supprime
                    erreur {
                        code
                        message
                    }
                }
            }`,
            adminToken
        );

        expect(result.errors).toBeDefined();

        expect(result.errors?.[0].extensions?.code).toBe("NOT_FOUND");
    });

    it("refuse la suppression sans authentification", async () => {
        const result = await graphql(
            GRAPHQL_URL,
            `mutation {
                deleteReponse(id: "clxxxxxxxxxxxxxxxxxxxxxxxx") {
                    supprime
                    erreur {
                        code
                        message
                    }
                }
            }`
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("UNAUTHORIZED");
    });
});
