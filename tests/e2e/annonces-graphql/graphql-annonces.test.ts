
import { describe, it, expect } from "vitest";
import { AnnoncesApi, Configuration } from "../../../sdk/index.js";

// Le serveur E2E démarre automatiquement sur le port 3002.
const GRAPHQL_URL = "http://127.0.0.1:3002/graphql";

type GraphQLResult = {
    data?: {
        annonces?: {
            data: Array<{
                id: string;
                ville: string;
                prix: string;
            }>;
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            } | null;
            erreur?: {
                code: string;
                message: string;
            } | null;
        };
        annonce?: {
            annonce: {
                id: string;
                titre: string;
                ville: string;
                prix: string;
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


describe("GraphQL annonces - Tests E2E", () => {

    it("retourne les annonces avec pagination", async () => {
        const result = await graphql(`
            {
                annonces(page: 1, limit: 2) {
                    data { id ville prix }
                    pagination { page limit total pages }
                }
            }
        `);

        expect(result.errors).toBeUndefined();
        expect(result.data?.annonces?.data).toHaveLength(2);
        expect(result.data?.annonces?.pagination?.page).toBe(1);
        expect(result.data?.annonces?.pagination?.limit).toBe(2);
    });

    it("filtre les annonces par ville", async () => {
        const result = await graphql(`
            {
                annonces(ville: "Paris", limit: 100) {
                    data { id ville prix }
                    pagination { total }
                }
            }
        `);

        const annonces = result.data?.annonces?.data ?? [];

        expect(result.errors).toBeUndefined();
        expect(annonces.length).toBeGreaterThan(0);

        for (const annonce of annonces) {
            expect(annonce.ville.toLowerCase()).toBe("paris");
        }
    });

    it("retourne le détail d'une annonce publiée", async () => {
        const result = await graphql(`
            {
                annonce(id: "demo-immo-annonce-12") {
                    annonce { id titre ville prix }
                }
            }
        `);

        expect(result.errors).toBeUndefined();
        expect(result.data?.annonce?.annonce?.id)
            .toBe("demo-immo-annonce-12");
    });

    it("ne rend pas un brouillon public", async () => {
        const result = await graphql(`
            {
                annonce(id: "demo-immo-annonce-13") {
                    annonce { id titre }
                }
            }
        `);

        expect(result.errors).toBeUndefined();
        expect(result.data?.annonce?.annonce).toBeNull();
    });

    it("refuse une pagination invalide", async () => {
        const result = await graphql(`
            {
                annonces(limit: 101) {
                    data { id }
                    pagination { total }
                    erreur { code message }
                }
            }
        `);

        expect(result.errors).toBeUndefined();
        expect(result.data?.annonces?.data).toEqual([]);
        expect(result.data?.annonces?.pagination).toBeNull();
        expect(result.data?.annonces?.erreur?.message)
            .toBe("Paramètres d'annonces invalides");
    });
});


describe("GraphQL annonces - Sécurité JWT", () => {

    it("respecte les droits d'accès aux brouillons", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const agent2 = await login(
            process.env.SEED_AGENT_2_EMAIL,
            process.env.SEED_AGENT_2_PASSWORD
        );

        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const admin = await login(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        const api = new AnnoncesApi(new Configuration({
            basePath: "http://127.0.0.1:3002",
            accessToken: agent1
        }));

        // Créer un brouillon appartenant à l'agent 1.
        const annonce = await api.createAnnonce({
            createAnnonceInput: {
                titre: "Brouillon sécurité GraphQL",
                description: "Test des autorisations GraphQL",
                type: "VENTE",
                typePropriete: "APPARTEMENT",
                prix: "850.00",
                ville: "Le Havre",
                surface: 45,
                chambres: 2
            }
        });

        try {
            const query = `
                {
                    annonce(id: "${annonce.id}") {
                        annonce { id titre }
                    }
                }
            `;

            // Sans JWT : brouillon invisible.
            const visiteur = await graphql(query);
            expect(visiteur.data?.annonce?.annonce).toBeNull();

            // Propriétaire : brouillon visible.
            const proprietaire = await graphql(query, agent1);
            expect(proprietaire.errors).toBeUndefined();
            expect(proprietaire.data?.annonce?.annonce?.id)
                .toBe(annonce.id);

            // Autre agent : accès interdit.
            const autreAgent = await graphql(query, agent2);
            expect(autreAgent.data?.annonce?.annonce).toBeNull();

            // USER : accès interdit.
            const utilisateur = await graphql(query, user);
            expect(utilisateur.data?.annonce?.annonce).toBeNull();

            // ADMIN : accès autorisé.
            const administrateur = await graphql(query, admin);
            expect(administrateur.errors).toBeUndefined();
            expect(administrateur.data?.annonce?.annonce?.id)
                .toBe(annonce.id);

        } finally {
            // Nettoyage de la base E2E.
            const response = await fetch(
                `http://127.0.0.1:3002/annonces/${annonce.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${agent1}`
                    }
                }
            );

            expect(response.status).toBe(204);
        }
    });

    it("refuse un JWT invalide avec HTTP 401", async () => {
        const response = await fetch(
            "http://127.0.0.1:3002/graphql",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer token-invalide"
                },
                body: JSON.stringify({
                    query: "{ annonce(id: \"demo-immo-annonce-12\") { annonce { id } } }"
                })
            }
        );

        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
    });
});
