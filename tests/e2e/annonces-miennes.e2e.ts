
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

describe("GET /annonces/miennes - Tests E2E", () => {

    it("retourne les brouillons et les annonces publiées de l'agent", async () => {
        const token = await getAgentToken();

        // Ville unique pour isoler les données du test.
        const ville = `VilleTest${Date.now()}`;

        // Conserver les IDs pour nettoyer la base ensuite.
        const ids: string[] = [];

        try {
            // 1. Créer deux annonces en brouillon.
            const annonce1 = await sdkPost(token).createAnnonce({
                createAnnonceInput: {
                    ...annonceValide,
                    titre: "Test mes annonces - Brouillon",
                    ville
                }
            });

            ids.push(annonce1.id);

            const annonce2 = await sdkPost(token).createAnnonce({
                createAnnonceInput: {
                    ...annonceValide,
                    titre: "Test mes annonces - Publiée",
                    ville
                }
            });

            ids.push(annonce2.id);

            // 2. Publier uniquement la deuxième annonce.
            const publication = await sdkPost(token).changeStatutAnnonceRaw({
                id: annonce2.id,
                changeStatutAnnonceRequest: {
                    statut: "PUBLIE"
                }
            });

            expect(publication.raw.status).toBe(200);

            // 3. Récupérer toutes les annonces de cette ville.
            const result = await sdkPost(token).getMesAnnonces({
                ville
            });

            expect(result.pagination.total).toBe(2);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(10);

            // Les deux annonces doivent être présentes.
            const annoncesIds = result.data.map(
                (annonce: { id: string }) => annonce.id
            );

            expect(annoncesIds).toContain(annonce1.id);
            expect(annoncesIds).toContain(annonce2.id);

            const sdkResult = await sdkPost(token).getMesAnnonces({
                ville
            });

            const annonceSDK = sdkResult.data.find(
                item => item.id === annonce1.id
            );

            expect(annonceSDK).toBeDefined();

            // Vérifier que le SDK conserve les champs détaillés.
            expect(annonceSDK?.description).toBe(annonceValide.description);
            expect(annonceSDK?.photos).toEqual([]);
            expect(annonceSDK?.updatedAt).toBeDefined();
            expect(annonceSDK?.statut).toBe("BROUILLON");

            // 4. Filtrer uniquement les brouillons.
            const dataBrouillons = await sdkPost(token).getMesAnnonces({
                ville,
                statut: "BROUILLON",
                page: 1,
                limit: 10
            });

            expect(dataBrouillons.pagination.total).toBe(1);
            expect(dataBrouillons.data[0].id).toBe(annonce1.id);

            // 5. Filtrer uniquement les annonces publiées.
            const dataPubliees = await sdkPost(token).getMesAnnonces({
                ville,
                statut: "PUBLIE",
                page: 1,
                limit: 10
            });

            expect(dataPubliees.pagination.total).toBe(1);
            expect(dataPubliees.data[0].id).toBe(annonce2.id);

            // 6. Vérifier la pagination avec limit=1.
            const dataPagination = await sdkPost(token).getMesAnnonces({
                ville,
                page: 1,
                limit: 1
            });

            expect(dataPagination.data).toHaveLength(1);
            expect(dataPagination.pagination.total).toBe(2);
            expect(dataPagination.pagination.pages).toBe(2);

        } finally {
            // Nettoyer les annonces créées pour le test.
            for (const id of ids) {
                const suppression = await sdkPost(token).deleteAnnonceRaw({
                    id
                });

                expect(suppression.raw.status).toBe(204);
            }
        }
    });


    it("empêche un agent de consulter les annonces d'un autre (IDOR)", async () => {
        const tokenAgent1 = await getAgentToken();

        const tokenAgent2 = await getToken(
            process.env.SEED_AGENT_2_EMAIL,
            process.env.SEED_AGENT_2_PASSWORD
        );

        const ville = `VilleIdor${Date.now()}`;

        // L'agent 1 crée un brouillon.
        const annonce = await sdkPost(tokenAgent1).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                ville,
                titre: "Annonce privée de l'agent 1"
            }
        });

        try {
            // L'agent 1 doit voir sa propre annonce.
            const resultatAgent1 = await sdkPost(tokenAgent1).getMesAnnonces({
                ville
            });

            expect(resultatAgent1.pagination.total).toBe(1);
            expect(resultatAgent1.data[0].id).toBe(annonce.id);

            // L'agent 2 ne doit pas voir ce brouillon.
            const resultatAgent2 = await sdkPost(tokenAgent2).getMesAnnonces({
                ville
            });

            expect(resultatAgent2.data).toEqual([]);
            expect(resultatAgent2.pagination.total).toBe(0);

        } finally {
            const suppression = await sdkPost(tokenAgent1).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("limite également un administrateur à ses propres annonces", async () => {
        const tokenAgent = await getAgentToken();

        const tokenAdmin = await getToken(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        const ville = `VilleAdmin${Date.now()}`;

        const annonce = await sdkPost(tokenAgent).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                ville
            }
        });

        try {
            const resultat = await sdkPost(tokenAdmin).getMesAnnonces({
                ville
            });

            expect(resultat.data).toEqual([]);
            expect(resultat.pagination.total).toBe(0);

        } finally {
            const suppression = await sdkPost(tokenAgent).deleteAnnonceRaw({
                id: annonce.id
            });

            expect(suppression.raw.status).toBe(204);
        }
    });

    it("traite % et _ comme des caractères littéraux", async () => {
        const token = await getAgentToken();

        const result = await sdkPost(token).getMesAnnonces({
            ville: "%"
        });

        for (const annonce of result.data) {
            expect(annonce.ville).toContain("%");
        }
    });

    it("refuse l'accès sans authentification avec HTTP 401", async () => {
        const response = await fetch(
            `${baseUrl}/annonces/miennes`
        );

        expect(response.status).toBe(401);
    });

    it("refuse l'accès à un utilisateur USER avec HTTP 403", async () => {
        const tokenUser = await getToken(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const response = await fetch(
            `${baseUrl}/annonces/miennes`,
            {
                headers: {
                    Authorization: `Bearer ${tokenUser}`
                }
            }
        );

        expect(response.status).toBe(403);
    });

    it("refuse les paramètres invalides et auteurId fourni par le client", async () => {
        const token = await getAgentToken();

        // Un statut inconnu doit être refusé.
        const statutInvalide = await fetch(
            `${baseUrl}/annonces/miennes?statut=ARCHIVE`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        expect(statutInvalide.status).toBe(400);

        // Un client ne doit pas choisir le propriétaire.
        const auteurInterdit = await fetch(
            `${baseUrl}/annonces/miennes?auteurId=agent-2`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        expect(auteurInterdit.status).toBe(400);
    });

});