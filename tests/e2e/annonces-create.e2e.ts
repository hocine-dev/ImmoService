
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

describe("POST /annonces - Tests E2E", () => {

    it("crée une annonce en brouillon pour un agent authentifié", async () => {
        const token = await getAgentToken();

        // Créer une annonce avec le compte agent.
        const response = await sdkPost(token).createAnnonceRaw({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce E2E ${Date.now()}`
            }
        });

        const annonce = await response.value();

        try {
            // Vérifier la création.
            expect(response.raw.status).toBe(201);
            expect(annonce.statut).toBe("BROUILLON");
            expect(annonce.ville).toBe("Le Havre");
            expect(annonce.auteurId).toBeTruthy();

        } finally {
            // Supprimer l'annonce créée pour le test.
            // Le nettoyage s'exécute même si une assertion échoue.
            const suppression = await sdkPost(token).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("refuse une création sans authentification", async () => {
        await expect(
            sdkPost().createAnnonce({
                createAnnonceInput: annonceValide
            })
        ).rejects.toMatchObject({
            response: { status: 401 }
        });
    });

    it("refuse les données de création invalides", async () => {
        const token = await getAgentToken();

        await expect(
            sdkPost(token).createAnnonce({
                createAnnonceInput: {
                    ...annonceValide,
                    prix: "-100"
                }
            })
        ).rejects.toMatchObject({
            response: { status: 400 }
        });
    });

    it("refuse la création pour un utilisateur standard", async () => {
        const token = await getToken(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        await expect(
            sdkPost(token).createAnnonce({
                createAnnonceInput: annonceValide
            })
        ).rejects.toMatchObject({
            response: { status: 403 }
        });
    });

    it("crée une annonce en brouillon pour un administrateur", async () => {
        const token = await getToken(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        // Créer une annonce avec le compte administrateur.
        const response = await sdkPost(token).createAnnonceRaw({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce admin E2E ${Date.now()}`
            }
        });

        const annonce = await response.value();

        try {
            // Vérifier que l'administrateur peut créer une annonce.
            expect(response.raw.status).toBe(201);
            expect(annonce.statut).toBe("BROUILLON");
            expect(annonce.auteurId).toBeTruthy();

        } finally {
            // Nettoyer l'annonce créée pendant le test.
            const suppression = await sdkPost(token).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("retourne 400 pour un JSON mal formé", async () => {
        const response = await fetch(
            "http://127.0.0.1:3002/annonces",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: '{"titre":'
            }
        );

        expect(response.status).toBe(400);

        const body = await response.json();

        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.details.body).toBeDefined();
    });

    it("retourne 413 pour un JSON dépassant 100 Ko", async () => {
        const response = await fetch(
            "http://127.0.0.1:3002/annonces",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    description: "A".repeat(110 * 1024)
                })
            }
        );

        expect(response.status).toBe(413);

        const body = await response.json();

        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.details.body).toBeDefined();
    });
});