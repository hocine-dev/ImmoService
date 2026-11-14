import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql/questions";

type GraphQLResult = {
    data?: {
        questionsByAnnonce?: {
            questionPage?: {
                data: {
                    id: string;
                    texte: string;
                    annonceId: string;
                    auteurId: string;
                    auteur?: {
                        id: string;
                        name: string;
                    } | null;
                }[];
                pagination: {
                    page: number;
                    limit: number;
                    total: number;
                    pages: number;
                };
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

async function graphql(query: string, token?: string): Promise<GraphQLResult> {
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

function getQuestionsQuery(
    annonceId: string,
    page?: number,
    limit?: number
) {
    return `
        query {
            questionsByAnnonce(
                annonceId: "${annonceId}"
                ${page !== undefined ? `page: ${page}` : ""}
                ${limit !== undefined ? `limit: ${limit}` : ""}
            ) {
                questionPage {
                    data {
                        id
                        texte
                        annonceId
                        auteurId
                        auteur {
                            id
                            name
                        }
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
}

const ANNONCE_ID = "demo-immo-annonce-01";

describe("GraphQL - questionsByAnnonce", () => {

    it("récupère les questions d'une annonce publiée", async () => {
        const result = await graphql(
            getQuestionsQuery(ANNONCE_ID)
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.questionsByAnnonce;

        expect(payload?.erreur).toBeNull();
        expect(payload?.questionPage).not.toBeNull();

        expect(payload?.questionPage?.data).toBeInstanceOf(Array);

        expect(payload?.questionPage?.pagination).toMatchObject({
            page: 1,
            limit: 10
        });

        payload?.questionPage?.data.forEach(question => {
            expect(question.annonceId).toBe(ANNONCE_ID);
            expect(question.id).toBeDefined();
            expect(question.texte).toBeDefined();
        });
    });

    it("respecte les paramètres de pagination", async () => {
        const result = await graphql(
            getQuestionsQuery(ANNONCE_ID, 1, 5)
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.questionsByAnnonce;

        expect(payload?.erreur).toBeNull();
        expect(payload?.questionPage?.pagination).toMatchObject({
            page: 1,
            limit: 5
        });

        expect(payload?.questionPage?.data.length).toBeLessThanOrEqual(5);
    });

    it("refuse une annonce inexistante", async () => {
        const result = await graphql(
            getQuestionsQuery("annonce_inexistante")
        );

        expect(result.errors).toBeDefined();
        expect(result.errors?.[0].extensions?.code).toBe("NOT_FOUND");
    });

    it("retourne une erreur pour une pagination invalide", async () => {
        const result = await graphql(
            getQuestionsQuery(ANNONCE_ID, 0, 10)
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.questionsByAnnonce;

        expect(payload?.questionPage).toBeNull();
        expect(payload?.erreur?.code).toBe("VALIDATION_ERROR");
    });

    it("permet la consultation sans authentification", async () => {
        const result = await graphql(
            getQuestionsQuery(ANNONCE_ID)
        );

        expect(result.errors).toBeUndefined();

        expect(
            result.data?.questionsByAnnonce?.questionPage
        ).not.toBeNull();
    });
});