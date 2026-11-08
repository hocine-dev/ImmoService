
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

describe("GET /annonces/:id - Tests E2E", () => {

    /**
     * Vérifie qu'une annonce publiée est accessible
     * et que sa réponse contient ses informations
     * détaillées ainsi que ses photos.
     */
    it("retourne le détail d'une annonce publiée", async () => {
        const annonce = await api.getAnnonceById({
            id: "demo-immo-annonce-12"
        });

        expect(annonce.id).toBe("demo-immo-annonce-12");
        expect(annonce.statut).toBe("PUBLIE");
        expect(annonce.titre).toBeTruthy();
        expect(annonce.photos).toHaveLength(1);
    });

    /**
     * Vérifie qu'une annonce en brouillon reste
     * inaccessible, même si son identifiant est connu.
     */
    it("refuse l'accès à une annonce en brouillon", async () => {
        await expect(
            api.getAnnonceById({
                id: "demo-immo-annonce-13"
            })
        ).rejects.toMatchObject({
            response: {
                status: 404
            }
        });
    });

    /**
     * Vérifie que la recherche d'une annonce
     * inexistante retourne HTTP 404.
     */
    it("retourne 404 pour une annonce inexistante", async () => {
        await expect(
            api.getAnnonceById({
                id: "annonce-inexistante-999"
            })
        ).rejects.toMatchObject({
            response: {
                status: 404
            }
        });
    });

    /**
     * Vérifie qu'un identifiant composé uniquement
     * d'espaces est rejeté par la validation Zod.
     */
    it("refuse un identifiant invalide avec HTTP 400", async () => {
        await expect(
            api.getAnnonceById({
                id: "   "
            })
        ).rejects.toMatchObject({
            response: {
                status: 400
            }
        });
    });

});
