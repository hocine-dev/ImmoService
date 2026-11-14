
import { describe, it, expect } from "vitest";

const REPONSES_GRAPHQL_URL = "http://127.0.0.1:3002/graphql/reponses";
const QUESTIONS_GRAPHQL_URL = "http://127.0.0.1:3002/graphql/questions";
const LOGIN_URL = "http://127.0.0.1:3002/auth/login";

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

const ANNONCE_ID = "demo-immo-annonce-01";

// Création de la question via le resolver questions.
async function createQuestion(token: string) {
    const result = await graphql(
        QUESTIONS_GRAPHQL_URL,
        `mutation {
            createQuestion(input: {
                texte: "Question E2E ${Date.now()}"
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
        REPONSES_GRAPHQL_URL,
        `mutation {
            createReponse(input: {
                texte: "Réponse E2E ${Date.now()}"
                questionId: "${questionId}"
            }) {
                reponse {
                    id
                    texte
                }
            }
        }`,
        token
    );

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    const reponse = result.data?.createReponse?.reponse;

    if (!reponse) {
        throw new Error("Impossible de créer la réponse E2E");
    }

    return reponse;
}

describe("GraphQL - Get Reponse By Question", () => {

    it("récupère une réponse par question", async () => {
        const adminToken = await getAdminToken();
        const userToken = await getUserToken();

        const questionId = await createQuestion(userToken);
        const createdReponse = await createReponse(
            questionId,
            adminToken
        );

        const result = await graphql(
            REPONSES_GRAPHQL_URL,
            `query {
                reponseByQuestion(questionId: "${questionId}") {
                    reponse {
                        id
                        texte
                        questionId
                        auteurId
                        createdAt
                        auteur {
                            id
                            name
                        }
                    }
                    erreur {
                        code
                        message
                    }
                }
            }`
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.reponseByQuestion;

        expect(payload.reponse).toBeDefined();
        expect(payload.erreur).toBeNull();
        expect(payload.reponse.id).toBe(createdReponse.id);
        expect(payload.reponse.questionId).toBe(questionId);
        expect(payload.reponse.auteur).toBeDefined();
    });

    it("permet la récupération sans authentification pour une annonce publiée", async () => {
        const adminToken = await getAdminToken();
        const userToken = await getUserToken();

        const questionId = await createQuestion(userToken);
        await createReponse(questionId, adminToken);

        const result = await graphql(
            REPONSES_GRAPHQL_URL,
            `query {
                reponseByQuestion(questionId: "${questionId}") {
                    reponse {
                        id
                        texte
                        questionId
                    }
                    erreur {
                        code
                        message
                    }
                }
            }`
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.reponseByQuestion;

        expect(payload.reponse).toBeDefined();
        expect(payload.erreur).toBeNull();
        expect(payload.reponse.questionId).toBe(questionId);
    });

    it("retourne NOT_FOUND pour une question inexistante", async () => {
        const result = await graphql(
            REPONSES_GRAPHQL_URL,
            `query {
                reponseByQuestion(
                    questionId: "clxxxxxxxxxxxxxxxxxxxxxxxx"
                ) {
                    reponse {
                        id
                    }
                    erreur {
                        code
                        message
                    }
                }
            }`
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code)
            .toBe("NOT_FOUND");
    });

    it("retourne NOT_FOUND lorsqu'une question ne possède aucune réponse", async () => {
        const userToken = await getUserToken();
        const questionId = await createQuestion(userToken);

        const result = await graphql(
            REPONSES_GRAPHQL_URL,
            `query {
                reponseByQuestion(questionId: "${questionId}") {
                    reponse {
                        id
                    }
                    erreur {
                        code
                        message
                    }
                }
            }`
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code)
            .toBe("NOT_FOUND");
    });
});
