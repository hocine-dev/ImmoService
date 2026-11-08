
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

describe("PATCH /annonces/:id - Tests E2E", () => {

    it("autorise un agent à modifier sa propre annonce", async () => {
        const token = await getAgentToken();

        // Créer un brouillon appartenant à cet agent.
        const annonce = await sdkPost(token).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce PATCH ${Date.now()}`
            }
        });

        try {
            // Modifier uniquement le titre.
            const response = await sdkPost(token).updateAnnonceRaw({
                id: annonce.id,
                updateAnnonceInput: {
                    titre: "Titre modifié par son auteur"
                }
            });

            expect(response.raw.status).toBe(200);

            const resultat = await response.value();

            expect(resultat.titre).toBe("Titre modifié par son auteur");
            expect(resultat.auteurId).toBe(annonce.auteurId);
            expect(resultat.statut).toBe("BROUILLON");

        } finally {
            // Nettoyage avec le propriétaire de l'annonce.
            const suppression = await sdkPost(token).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("empêche un agent de modifier l'annonce d'un autre agent (IDOR)", async () => {
        // Dans le seed, cette annonce publiée appartient à l'agent 1.
        const id = "demo-immo-annonce-01";

        // Lire l'annonce avant toute tentative de modification.
        const avant = await api.getAnnonceById({ id });

        // Authentification avec le compte de l'agent 2.
        const tokenAgent2 = await getToken(
            process.env.SEED_AGENT_2_EMAIL,
            process.env.SEED_AGENT_2_PASSWORD
        );

        // L'agent 2 essaie de modifier l'annonce de l'agent 1.
        await expect(
            sdkPost(tokenAgent2).updateAnnonce({
                id,
                updateAnnonceInput: {
                    titre: "Modification interdite"
                }
            })
        ).rejects.toMatchObject({
            response: { status: 404 }
        });

        // Relire l'annonce depuis PostgreSQL via l'API.
        const apres = await api.getAnnonceById({ id });

        // Toutes les données retournées, y compris updatedAt,
        // doivent être identiques : la tentative n'a rien modifié.
        expect(apres).toEqual(avant);
    });

    it("autorise un administrateur à modifier une annonce", async () => {
        const tokenAgent = await getAgentToken();

        // Créer une annonce appartenant à un agent.
        const annonce = await sdkPost(tokenAgent).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce pour ADMIN ${Date.now()}`
            }
        });

        try {
            const tokenAdmin = await getToken(
                process.env.SEED_ADMIN_EMAIL,
                process.env.SEED_ADMIN_PASSWORD
            );

            // L'administrateur modifie une annonce
            // dont il n'est pas propriétaire.
            const response = await sdkPost(tokenAdmin).updateAnnonceRaw({
                id: annonce.id,
                updateAnnonceInput: {
                    prix: "200000.00"
                }
            });

            expect(response.raw.status).toBe(200);

            const resultat = await response.value();

            expect(resultat.prix).toBe("200000.00");
            expect(resultat.auteurId).toBe(annonce.auteurId);

        } finally {
            // Supprimer l'annonce avec le compte propriétaire.
            const suppression = await sdkPost(tokenAgent).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("refuse la modification pour un utilisateur standard", async () => {
        const tokenUser = await getToken(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        // Le rôle USER n'a pas le droit de modifier les annonces.
        await expect(
            sdkPost(tokenUser).updateAnnonce({
                id: "demo-immo-annonce-01",
                updateAnnonceInput: {
                    ville: "Rouen"
                }
            })
        ).rejects.toMatchObject({
            response: { status: 403 }
        });
    });

    it("refuse une modification sans authentification", async () => {
        // Aucun JWT transmis au serveur.
        await expect(
            sdkPost().updateAnnonce({
                id: "demo-immo-annonce-01",
                updateAnnonceInput: {
                    ville: "Rouen"
                }
            })
        ).rejects.toMatchObject({
            response: { status: 401 }
        });
    });

    it("refuse les données de modification invalides", async () => {
        const token = await getAgentToken();

        // Le schéma Zod interdit un prix négatif.
        await expect(
            sdkPost(token).updateAnnonce({
                id: "demo-immo-annonce-01",
                updateAnnonceInput: {
                    prix: "-100"
                }
            })
        ).rejects.toMatchObject({
            response: { status: 400 }
        });
    });
});
