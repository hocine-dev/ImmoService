
import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql";

/**
 * Résultat des requêtes GraphQL Favoris.
 */
type GraphQLResult = {
    data?: {
        createFavori?: {
            favori?: {
                id: string;
                userId: string;
                annonceId: string;
                annonce: {
                    id: string;
                    titre: string;
                };
            } | null;
            erreur?: {
                code: string;
                message: string;
            } | null;
        };
        deleteFavori?: {
            supprime: boolean;
            erreur?: {
                code: string;
                message: string;
            } | null;
        };
        user?: {
            user?: {
                favoris: {
                    id: string;
                    annonceId: string;
                    annonce: {
                        id: string;
                        titre: string;
                        auteur: {
                            id: string;
                            name: string;
                        } | null;
                    } | null;
                }[];
            } | null;
            erreur?: {
                code: string;
                message: string;
            } | null;
        };
    } | null;
    errors?: Array<{ message: string }>;
};

/**
 * Envoie une requête GraphQL au serveur E2E.
 */
async function graphql(
    query: string,
    token?: string
): Promise<GraphQLResult> {
    const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? {
                Authorization: `Bearer ${token}`
            } : {})
        },
        body: JSON.stringify({ query })
    });

    return (await response.json()) as GraphQLResult;
}

/**
 * Récupère un véritable JWT auprès de l'API REST.
 * Réutilise les comptes du seed E2E.
 */
async function login(
    email: string | undefined,
    password: string | undefined
): Promise<string> {
    if (!email || !password) {
        throw new Error("Identifiants du seed manquants");
    }

    const response = await fetch(
        "http://127.0.0.1:3002/auth/login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        }
    );

    expect(response.status).toBe(200);

    const body = await response.json() as {
        data?: { token?: string };
    };

    if (!body.data?.token) {
        throw new Error("JWT absent de la réponse");
    }

    return body.data.token;
}


describe("GraphQL favoris - Tests E2E", () => {

    it("ajoute une annonce aux favoris", async () => {
        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const result = await graphql(`
            mutation {
                createFavori(input: {
                    annonceId: "demo-immo-annonce-12"
                }) {
                    favori {
                        id
                        userId
                        annonceId
                        annonce {
                            id
                            titre
                        }
                    }
                    erreur {
                        code
                        message
                    }
                }
            }
        `, user);

        expect(result.errors).toBeUndefined();
        expect(result.data?.createFavori?.erreur).toBeNull();

        const favori = result.data?.createFavori?.favori;

        expect(favori).toBeDefined();
        expect(favori?.annonceId).toBe("demo-immo-annonce-12");
        expect(favori?.annonce.id).toBe("demo-immo-annonce-12");

        // Vérifie que le profil utilisateur résout aussi
        // l'annonce associée à un favori.
        const profil = await graphql(`
            query {
                user(id: "${favori?.userId}") {
                    user {
                        favoris {
                            id
                            annonceId
                            annonce {
                                id
                                titre
                                auteur {
                                    id
                                    name
                                }
                            }
                        }
                    }
                    erreur {
                        code
                        message
                    }
                }
            }
        `, user);

        expect(profil.errors).toBeUndefined();
        expect(profil.data?.user?.erreur).toBeNull();

        const favoriProfil = profil.data?.user?.user?.favoris.find(
            f => f.id === favori?.id
        );

        expect(favoriProfil).toBeDefined();
        expect(favoriProfil?.annonce?.id)
            .toBe("demo-immo-annonce-12");
        expect(favoriProfil?.annonce?.titre).toBeTruthy();
        expect(favoriProfil?.annonce?.auteur?.id).toBeTruthy();

        // Nettoyage du favori créé.
        await graphql(`
            mutation {
                deleteFavori(annonceId: "demo-immo-annonce-12") {
                    supprime
                }
            }
        `, user);
    });

    it("refuse un favori en double", async () => {
        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const query = `
            mutation {
                createFavori(input: {
                    annonceId: "demo-immo-annonce-12"
                }) {
                    favori { id }
                    erreur { code message }
                }
            }
        `;

        const premier = await graphql(query, user);

        expect(premier.errors).toBeUndefined();
        expect(premier.data?.createFavori?.favori).toBeDefined();

        try {
            const second = await graphql(query, user);

            expect(second.errors).toBeUndefined();
            expect(second.data?.createFavori?.favori).toBeNull();
            expect(second.data?.createFavori?.erreur?.code)
                .toBe("CONFLICT");

        } finally {
            // Nettoyage de la base E2E.
            await graphql(`
                mutation {
                    deleteFavori(annonceId: "demo-immo-annonce-12") {
                        supprime
                    }
                }
            `, user);
        }
    });

    it("refuse un identifiant d'annonce inexistant", async () => {
        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const result = await graphql(`
            mutation {
                createFavori(input: {
                    annonceId: "annonce-inexistante"
                }) {
                    favori { id }
                    erreur { code message }
                }
            }
        `, user);

        expect(result.errors).toBeUndefined();
        expect(result.data?.createFavori?.favori).toBeNull();
        expect(result.data?.createFavori?.erreur?.code)
            .toBe("NOT_FOUND");
    });

    it("supprime un favori existant", async () => {
        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const creation = await graphql(`
            mutation {
                createFavori(input: {
                    annonceId: "demo-immo-annonce-12"
                }) {
                    favori { id annonceId }
                    erreur { code message }
                }
            }
        `, user);

        expect(creation.errors).toBeUndefined();

        const favori = creation.data?.createFavori?.favori;
        expect(favori).toBeDefined();

        const suppression = await graphql(`
            mutation {
                deleteFavori(annonceId: "${favori?.annonceId}") {
                    supprime
                    erreur { code message }
                }
            }
        `, user);

        expect(suppression.errors).toBeUndefined();
        expect(suppression.data?.deleteFavori?.supprime).toBe(true);
        expect(suppression.data?.deleteFavori?.erreur).toBeNull();
    });

    it("refuse la suppression d'un favori inexistant", async () => {
        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const result = await graphql(`
            mutation {
                deleteFavori(annonceId: "annonce-inexistante") {
                    supprime
                    erreur { code message }
                }
            }
        `, user);

        expect(result.errors).toBeUndefined();
        expect(result.data?.deleteFavori?.supprime).toBe(false);
        expect(result.data?.deleteFavori?.erreur?.code)
            .toBe("NOT_FOUND");
    });
});


describe("GraphQL favoris - Sécurité JWT", () => {

    it("refuse la création sans authentification", async () => {
        const result = await graphql(`
            mutation {
                createFavori(input: {
                    annonceId: "demo-immo-annonce-12"
                }) {
                    favori { id }
                    erreur { code message }
                }
            }
        `);

        expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("refuse la suppression sans authentification", async () => {
        const result = await graphql(`
            mutation {
                deleteFavori(annonceId: "demo-immo-annonce-12") {
                    supprime
                    erreur { code message }
                }
            }
        `);

        expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("isole les favoris entre deux utilisateurs", async () => {
        const user1 = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const user2 = await login(
            process.env.SEED_USER_2_EMAIL,
            process.env.SEED_USER_2_PASSWORD
        );

        // User 1 ajoute l'annonce à ses favoris.
        const creation = await graphql(`
            mutation {
                createFavori(input: {
                    annonceId: "demo-immo-annonce-12"
                }) {
                    favori { id annonceId }
                    erreur { code message }
                }
            }
        `, user1);

        expect(creation.errors).toBeUndefined();
        expect(creation.data?.createFavori?.favori).toBeDefined();

        try {
            // User 2 tente de supprimer le favori de User 1.
            const suppression = await graphql(`
                mutation {
                    deleteFavori(annonceId: "demo-immo-annonce-12") {
                        supprime
                        erreur { code message }
                    }
                }
            `, user2);

            // Le favori n'appartient pas à User 2.
            expect(suppression.errors).toBeUndefined();
            expect(suppression.data?.deleteFavori?.supprime).toBe(false);
            expect(suppression.data?.deleteFavori?.erreur?.code)
                .toBe("NOT_FOUND");

        } finally {
            // Nettoyage par le propriétaire du favori.
            await graphql(`
                mutation {
                    deleteFavori(annonceId: "demo-immo-annonce-12") {
                        supprime
                    }
                }
            `, user1);
        }
    });

    it("refuse un JWT invalide avec HTTP 401", async () => {
        const response = await fetch(
            GRAPHQL_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer token-invalide"
                },
                body: JSON.stringify({
                    query: `
                        mutation {
                            createFavori(input: {
                                annonceId: "demo-immo-annonce-12"
                            }) {
                                favori { id }
                            }
                        }
                    `
                })
            }
        );

        expect(response.status).toBe(401);

        const body = await response.json() as {
            error: { code: string };
        };

        expect(body.error.code).toBe("UNAUTHORIZED");
    });
});
