import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql";
const LOGIN_URL = "http://127.0.0.1:3002/auth/login";

type GraphQLResult = {
    data?: {
        createQuestion?: {
            question?: {
                id: string;
                texte: string;
                annonceId: string;
                auteurId: string;
            } | null;
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

// À remplacer par l'ID d'une annonce publiée présente dans la base de test.
const ANNONCE_ID = "demo-immo-annonce-01";

describe("GraphQL - createQuestion", () => {

    it("crée une question avec un utilisateur authentifié", async () => {
        const token = await getUserToken();

        const texte = `Question E2E ${Date.now()}`;

        const query = `
            mutation {
                createQuestion(input: {
                    texte: "${texte}"
                    annonceId: "${ANNONCE_ID}"
                }) {
                    question {
                        id
                        texte
                        annonceId
                        auteurId
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

        const payload = result.data?.createQuestion;

        expect(payload?.erreur).toBeNull();
        expect(payload?.question).not.toBeNull();
        expect(payload?.question?.id).toBeDefined();
        expect(payload?.question?.texte).toBe(texte);
        expect(payload?.question?.annonceId).toBe(ANNONCE_ID);
        expect(payload?.question?.auteurId).toBeDefined();
    });

    it("crée une question avec un utilisateur avec mauvais id annonce ", async () => {
        const token = await getUserToken();

        const texte = `Question E2E ${Date.now()}`;

        const query = `
            mutation {
                createQuestion(input: {
                    texte: "${texte}"
                    annonceId: "annonce"
                }) {
                    question {
                        id
                        texte
                        annonceId
                        auteurId
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
    });

    it("refuse la création sans authentification", async () => {
        const query = `
            mutation {
                createQuestion(input: {
                    texte: "Question sans authentification"
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
            }
        `;

        const result = await graphql(query);

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("UNAUTHORIZED");
    });

    it("refuse les données invalides", async () => {
        const token = await getUserToken();

        const query = `
            mutation {
                createQuestion(input: {
                    texte: ""
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
            }
        `;

        const result = await graphql(query, token);

        expect(result.errors).toBeUndefined();

        const payload = result.data?.createQuestion;

        expect(payload?.question).toBeNull();
        expect(payload?.erreur?.code).toBe("VALIDATION_ERROR");
    });

    it("refuse une annonce inexistante", async () => {
        const token = await getUserToken();

        const query = `
            mutation {
                createQuestion(input: {
                    texte: "Question sur une annonce inexistante"
                    annonceId: "annonce_inexistante"
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

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("NOT_FOUND");
    });
});