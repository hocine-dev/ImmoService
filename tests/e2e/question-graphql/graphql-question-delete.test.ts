import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql";
const LOGIN_URL = "http://127.0.0.1:3002/auth/login";

type GraphQLResult = {
    data?: {
        createQuestion?: {
            question?: {
                id: string;
            } | null;
            erreur?: {
                code: string;
                message: string;
            } | null;
        };
        deleteQuestion?: {
            supprime: boolean;
            erreur?: {
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
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query })
    });

    return response.json() as Promise<GraphQLResult>;
}

async function getToken(
    email: string,
    password: string
): Promise<string> {
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

const getUserToken = () =>
    getToken(
        process.env.SEED_USER_1_EMAIL!,
        process.env.SEED_USER_1_PASSWORD!
    );

const getAdminToken = () =>
    getToken(
        process.env.SEED_ADMIN_EMAIL!,
        process.env.SEED_ADMIN_PASSWORD!
    );

async function createQuestion(
    token: string,
    texte = `Question E2E ${Date.now()}`
): Promise<string> {
    const annonceId = "demo-immo-annonce-01";

    const query = `
        mutation {
            createQuestion(input: {
                texte: "${texte}"
                annonceId: "${annonceId}"
            }) {
                question {
                    id
                }
                erreur {
                    code
                    message
                }
            }
        }
    `;

    const result = await graphql(query, token);

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    const questionId = result.data?.createQuestion?.question?.id;

    if (!questionId) {
        throw new Error(
            result.data?.createQuestion?.erreur?.message ??
            "Impossible de créer la question de test"
        );
    }

    return questionId;
}

async function deleteQuestion(
    id: string,
    token?: string
): Promise<GraphQLResult> {
    const query = `
        mutation {
            deleteQuestion(id: "${id}") {
                supprime
                erreur {
                    code
                    message
                }
            }
        }
    `;

    return graphql(query, token);
}

describe("GraphQL - deleteQuestion", () => {

    it("supprime une question par son auteur", async () => {
        const token = await getUserToken();
        const questionId = await createQuestion(token);

        const result = await deleteQuestion(questionId, token);

        expect(result.errors).toBeUndefined();

        const payload = result.data?.deleteQuestion;

        expect(payload?.supprime).toBe(true);
        expect(payload?.erreur).toBeNull();
    });

    it("refuse la suppression sans authentification", async () => {
        const result = await deleteQuestion("question_test");

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("UNAUTHORIZED");
    });

    it("refuse la suppression par un autre utilisateur", async () => {
        const authorToken = await getUserToken();

        const otherUserToken = await getToken(
            process.env.SEED_USER_2_EMAIL!,
            process.env.SEED_USER_2_PASSWORD!
        );

        const questionId = await createQuestion(authorToken);

        const result = await deleteQuestion(
            questionId,
            otherUserToken
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");

        // Nettoyage par l'auteur
        const cleanup = await deleteQuestion(questionId, authorToken);

        expect(cleanup.data?.deleteQuestion?.supprime).toBe(true);
    });

    it("supprime une question par un administrateur", async () => {
        const authorToken = await getUserToken();
        const adminToken = await getAdminToken();

        const questionId = await createQuestion(authorToken);

        const result = await deleteQuestion(questionId, adminToken);

        expect(result.errors).toBeUndefined();
        expect(result.data?.deleteQuestion?.supprime).toBe(true);
        expect(result.data?.deleteQuestion?.erreur).toBeNull();
    });

    it("refuse la suppression d'une question inexistante", async () => {
        const token = await getUserToken();

        const result = await deleteQuestion(
            "question_inexistante",
            token
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("NOT_FOUND");
    });
});