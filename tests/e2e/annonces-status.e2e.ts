
import { describe, it, expect } from "vitest";
import { AnnoncesApi, Configuration } from "../../sdk/index.js";

// Client généré depuis OpenAPI, connecté au serveur de test.
const api = new AnnoncesApi(
    new Configuration({
        basePath: "http://localhost:3002"
    })
);

const baseUrl = "http://localhost:3002";

/**
 * Récupère un JWT avec le compte agent préparé par le seed.
 * Le token est ensuite utilisé pour tester la route protégée POST /annonces.
     */
async function getToken(email: string | undefined, password: string | undefined) {
    const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
    });

    expect(response.status).toBe(200);

    const body = await response.json() as {
        data?: { token?: string };
    };

    expect(body.data?.token).toBeTruthy();
    return body.data!.token!;
}

async function getAgentToken() {
    return getToken(
        process.env.SEED_AGENT_1_EMAIL,
        process.env.SEED_AGENT_1_PASSWORD
    );
}

const sdkPost = (token?: string) =>
    new AnnoncesApi(new Configuration({
        basePath: baseUrl,
        accessToken: token
    }));

const annonceValide = {
    titre: "Appartement test E2E",
    description: "Appartement avec balcon au Havre",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
} as const;

describe("PATCH /annonces/:id/statut - Tests E2E", () => {

    it("publie, dépublie et évite les écritures inutiles", async () => {
        const token = await getAgentToken();

        // Créer une annonce en brouillon.
        const annonce = await sdkPost(token).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Test statut ${Date.now()}`
            }
        });

        // Fonction utilitaire pour appeler notre route via le SDK.
        const changerStatut = async (
            statut: "PUBLIE" | "BROUILLON"
        ) => {
            const response = await sdkPost(token).changeStatutAnnonceRaw({
                id: annonce.id,
                changeStatutAnnonceRequest: {
                    statut
                }
            });

            expect(response.raw.status).toBe(200);
            return response.value();
        };

        try {
            // 1. Publier l'annonce.
            const premierePublication =
                await changerStatut("PUBLIE");

            expect(premierePublication.statut).toBe("PUBLIE");

            // Elle doit être accessible publiquement.
            const detail = await api.getAnnonceById({
                id: annonce.id
            });

            expect(detail.statut).toBe("PUBLIE");

            // 2. Publier une deuxième fois.
            const secondePublication =
                await changerStatut("PUBLIE");

            // Aucune modification inutile dans PostgreSQL.
            expect(secondePublication.updatedAt).toEqual(
                premierePublication.updatedAt
            );

            // 3. Dépublier.
            const premiereDepublication =
                await changerStatut("BROUILLON");

            expect(premiereDepublication.statut).toBe("BROUILLON");

            // L'annonce n'est plus accessible publiquement.
            await expect(
                api.getAnnonceById({ id: annonce.id })
            ).rejects.toMatchObject({
                response: { status: 404 }
            });

            // 4. Dépublier une deuxième fois.
            const secondeDepublication =
                await changerStatut("BROUILLON");

            // Le champ updatedAt reste inchangé.
            expect(secondeDepublication.updatedAt).toEqual(
                premiereDepublication.updatedAt
            );

        } finally {
            // Nettoyage : supprimer l'annonce du test,
            // même si une assertion précédente échoue.
            const suppression = await sdkPost(token).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    /**
     * Fonction utilitaire pour les tests de sécurité.
     * Le token peut être absent pour tester HTTP 401.
     */
    const envoyerStatut = (
        id: string,
        token: string | undefined,
        body: unknown
    ) => fetch(`${baseUrl}/annonces/${id}/statut`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
    });

    it("empêche un agent de publier l'annonce d'un autre (IDOR)", async () => {
        const tokenAgent1 = await getAgentToken();
        const tokenAgent2 = await getToken(
            process.env.SEED_AGENT_2_EMAIL,
            process.env.SEED_AGENT_2_PASSWORD
        );

        // Créer un brouillon appartenant à l'agent 1.
        const annonce = await sdkPost(tokenAgent1).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Test IDOR statut ${Date.now()}`
            }
        });

        try {
            // L'agent 2 tente de publier cette annonce.
            await expect(
                sdkPost(tokenAgent2).changeStatutAnnonce({
                    id: annonce.id,
                    changeStatutAnnonceRequest: {
                        statut: "PUBLIE"
                    }
                })
            ).rejects.toMatchObject({
                response: { status: 404 }
            });

            // Le brouillon ne doit pas être devenu public.
            await expect(
                api.getAnnonceById({ id: annonce.id })
            ).rejects.toMatchObject({
                response: { status: 404 }
            });

        } finally {
            // Nettoyage avec le propriétaire légitime.
            const suppression = await sdkPost(tokenAgent1).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("autorise un administrateur à publier l'annonce d'un agent", async () => {
        const tokenAgent = await getAgentToken();
        const tokenAdmin = await getToken(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        const annonce = await sdkPost(tokenAgent).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Test statut ADMIN ${Date.now()}`
            }
        });

        try {
            const response = await sdkPost(tokenAdmin).changeStatutAnnonceRaw({
                id: annonce.id,
                changeStatutAnnonceRequest: {
                    statut: "PUBLIE"
                }
            });

            expect(response.raw.status).toBe(200);

            const resultat = await response.value();

            expect(resultat.statut).toBe("PUBLIE");
            expect(resultat.auteurId).toBe(annonce.auteurId);

        } finally {
            const suppression = await sdkPost(tokenAgent).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("refuse le changement de statut pour USER", async () => {
        const tokenUser = await getToken(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const response = await envoyerStatut(
            "demo-immo-annonce-01",
            tokenUser,
            { statut: "BROUILLON" }
        );

        expect(response.status).toBe(403);
    });

    it("refuse le changement de statut sans JWT", async () => {
        const response = await envoyerStatut(
            "demo-immo-annonce-01",
            undefined,
            { statut: "BROUILLON" }
        );

        expect(response.status).toBe(401);
    });

    it("refuse un statut invalide avec HTTP 400", async () => {
        const token = await getAgentToken();

        const response = await envoyerStatut(
            "demo-immo-annonce-01",
            token,
            { statut: "ARCHIVE" }
        );

        expect(response.status).toBe(400);
    });

    it("refuse un identifiant invalide avec HTTP 400", async () => {
        const token = await getAgentToken();

        const response = await envoyerStatut(
            encodeURIComponent("   "),
            token,
            { statut: "PUBLIE" }
        );

        expect(response.status).toBe(400);
    });

    it("retourne 404 pour une annonce inexistante", async () => {
        const token = await getAgentToken();

        const response = await envoyerStatut(
            "annonce-inexistante-999",
            token,
            { statut: "PUBLIE" }
        );

        expect(response.status).toBe(404);
    });

});
