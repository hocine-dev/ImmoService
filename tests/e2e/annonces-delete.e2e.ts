
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

describe("DELETE /annonces/:id - Tests E2E", () => {

    it("autorise un agent à supprimer sa propre annonce", async () => {
        const token = await getAgentToken();

        // Créer une annonce appartenant à l'agent.
        const annonce = await sdkPost(token).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce DELETE ${Date.now()}`
            }
        });

        // Supprimer cette annonce.
        const response = await sdkPost(token).deleteAnnonceRaw({
            id: annonce.id
        });

        // 204 : suppression réussie, sans corps JSON.
        expect(response.raw.status).toBe(204);

        // Une deuxième suppression doit échouer :
        // l'annonce n'existe plus.
        await expect(
            sdkPost(token).deleteAnnonce({
                id: annonce.id
            })
        ).rejects.toMatchObject({
            response: { status: 404 }
        });
    });

    it("empêche un agent de supprimer l'annonce d'un autre (IDOR)", async () => {
        // Créer une annonce avec l'agent 1.
        const tokenAgent1 = await getAgentToken();

        const annonce = await sdkPost(tokenAgent1).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce protégée ${Date.now()}`
            }
        });

        // Connexion de l'agent 2.
        const tokenAgent2 = await getToken(
            process.env.SEED_AGENT_2_EMAIL,
            process.env.SEED_AGENT_2_PASSWORD
        );

        // L'agent 2 essaie de supprimer l'annonce.
        // L'accès est refusé sans révéler le propriétaire.
        await expect(
            sdkPost(tokenAgent2).deleteAnnonce({
                id: annonce.id
            })
        ).rejects.toMatchObject({
            response: { status: 404 }
        });

        // L'agent 1 doit encore pouvoir supprimer
        // son annonce : la tentative IDOR n'a rien effacé.
        const suppressionLegitime = await sdkPost(tokenAgent1).deleteAnnonceRaw({
            id: annonce.id
        });

        expect(suppressionLegitime.raw.status).toBe(204);
    });

    it("autorise un administrateur à supprimer une annonce", async () => {
        const tokenAgent = await getAgentToken();

        // Créer une annonce appartenant à l'agent.
        const annonce = await sdkPost(tokenAgent).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce DELETE ADMIN ${Date.now()}`
            }
        });

        const tokenAdmin = await getToken(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        // L'administrateur supprime l'annonce de l'agent.
        const response = await sdkPost(tokenAdmin).deleteAnnonceRaw({
            id: annonce.id
        });

        expect(response.raw.status).toBe(204);
    });

    it("refuse la suppression pour un utilisateur standard", async () => {
        const tokenUser = await getToken(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const response = await fetch(
            `${baseUrl}/annonces/demo-immo-annonce-01`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokenUser}`
                }
            }
        );

        expect(response.status).toBe(403);
    });

    it("refuse une suppression sans authentification", async () => {
        const response = await fetch(
            `${baseUrl}/annonces/demo-immo-annonce-01`,
            {
                method: "DELETE"
            }
        );

        expect(response.status).toBe(401);
    });

    it("refuse un identifiant invalide avec HTTP 400", async () => {
        const token = await getAgentToken();

        // Identifiant composé uniquement d'espaces.
        const idInvalide = encodeURIComponent("   ");

        const response = await fetch(
            `${baseUrl}/annonces/${idInvalide}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        expect(response.status).toBe(400);
    });

});
