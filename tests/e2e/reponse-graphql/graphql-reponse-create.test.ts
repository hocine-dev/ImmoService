
import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql/reponses";
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

async function graphqlQuestion(
    query: string,
    token?: string
): Promise<GraphQLResult> {
    const response = await fetch("http://127.0.0.1:3002/graphql/questions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {})
        },
        body: JSON.stringify({ query })
    });

    return response.json() as Promise<GraphQLResult>;
}

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
                : {})
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

async function createQuestion(token: string) {
    const result = await graphqlQuestion(
        `mutation {
            createQuestion(input: {
                texte: "Question E2E ${Date.now()}"
                annonceId: "${ANNONCE_ID}"
            }) {
                question {
                    id
                    texte
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

    const question = result.data?.createQuestion?.question;

    if (!question) {
        throw new Error(
            result.data?.createQuestion?.erreur?.message ??
            "Impossible de créer la question E2E"
        );
    }

    return question.id as string;
}

describe("GraphQL - Create Reponse", () => {

    it("crée une réponse avec succès", async () => {
        const adminToken = await getAdminToken();
        const userToken = await getUserToken();

        const questionId = await createQuestion(userToken);

        const result = await graphql(
            `mutation {
                createReponse(input: {
                    texte: "Réponse E2E ${Date.now()}"
                    questionId: "${questionId}"
                }) {
                    reponse {
                        id
                        texte
                        questionId
                        auteurId
                        createdAt
                    }
                    erreur {
                        code
                        message
                    }
                }
            }`,
            adminToken
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.createReponse;

        expect(payload.reponse).toBeDefined();
        expect(payload.erreur).toBeNull();
        expect(payload.reponse.questionId).toBe(questionId);
        expect(payload.reponse.texte).toContain("Réponse E2E");
    });

    it("refuse une création sans authentification", async () => {
        const result = await graphql(
            `mutation {
                createReponse(input: {
                    texte: "Réponse sans authentification"
                    questionId: "clxxxxxxxxxxxxxxxxxxxxxxxx"
                }) {
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
            .toBe("UNAUTHORIZED");
    });

    it("refuse un utilisateur avec le rôle USER", async () => {
        const userToken = await getUserToken();
        const questionId = await createQuestion(userToken);

        const result = await graphql(
            `mutation {
                createReponse(input: {
                    texte: "Réponse utilisateur USER"
                    questionId: "${questionId}"
                }) {
                    reponse {
                        id
                    }
                    erreur {
                        code
                        message
                    }
                }
            }`,
            userToken
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code)
            .toBe("FORBIDDEN");
    });

    it("refuse une réponse avec un texte vide", async () => {
        const adminToken = await getAdminToken();
        const userToken = await getUserToken();

        const questionId = await createQuestion(userToken);

        const result = await graphql(
            `mutation {
                createReponse(input: {
                    texte: "   "
                    questionId: "${questionId}"
                }) {
                    reponse {
                        id
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
            }`,
            adminToken
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.createReponse;

        expect(payload.reponse).toBeNull();
        expect(payload.erreur).toBeDefined();
        expect(payload.erreur.code).toBe("VALIDATION_ERROR");
    });

    it("refuse une deuxième réponse pour la même question", async () => {
        const adminToken = await getAdminToken();
        const userToken = await getUserToken();

        const questionId = await createQuestion(userToken);

        const firstResult = await graphql(
            `mutation {
                createReponse(input: {
                    texte: "Première réponse E2E"
                    questionId: "${questionId}"
                }) {
                    reponse {
                        id
                    }
                }
            }`,
            adminToken
        );

        expect(firstResult.data?.createReponse?.reponse).toBeDefined();

        const secondResult = await graphql(
            `mutation {
                createReponse(input: {
                    texte: "Deuxième réponse E2E"
                    questionId: "${questionId}"
                }) {
                    reponse {
                        id
                    }
                }
            }`,
            adminToken
        );

        expect(secondResult.errors).toBeDefined();
        expect(secondResult.errors?.[0].extensions?.code)
            .toBe("CONFLICT");
    });
});
