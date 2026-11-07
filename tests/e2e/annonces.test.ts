
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

describe("GET /annonces - Tests E2E", () => {

    /**
     * Vérifie que l'API retourne les annonces publiées
     * depuis la base PostgreSQL de test.
     *
     * Notre seed contient 12 annonces publiées.
     * Avec une limite de 10, la réponse doit contenir
     * 10 annonces sur la première page et 2 pages au total.
     */
    it("retourne la première page des annonces", async () => {
        const result = await api.listAnnonces({
            page: 1,
            limit: 10
        });

        expect(result.data).toHaveLength(10);

        expect(result.pagination).toEqual({
            page: 1,
            limit: 10,
            total: 12,
            pages: 2
        });
    });


    /**
     * Vérifie que la deuxième page contient uniquement
     * les 2 annonces restantes sur les 12 publiées.
     *
     * Cela permet de vérifier que la pagination
     * ne retourne pas les mêmes annonces à chaque page.
     */
    it("retourne correctement la deuxième page", async () => {
        const page1 = await api.listAnnonces({
            page: 1,
            limit: 10
        });

        const page2 = await api.listAnnonces({
            page: 2,
            limit: 10
        });

        expect(page2.data).toHaveLength(2);
        expect(page2.pagination.total).toBe(12);
        expect(page2.pagination.pages).toBe(2);

        // Aucune annonce de la deuxième page ne doit figurer sur la première.
        const idsPage1 = page1.data.map(annonce => annonce.id);

        for (const annonce of page2.data) {
            expect(idsPage1).not.toContain(annonce.id);
        }
    });


    /**
     * Vérifie que le filtre ville fonctionne correctement.
     *
     * Lorsque l'utilisateur recherche des annonces à Paris,
     * l'API doit retourner uniquement des annonces situées
     * dans cette ville.
     */
    it("filtre correctement les annonces par ville", async () => {
        const result = await api.listAnnonces({
            ville: "Paris",
            limit: 100
        });

        // Vérifie que la recherche retourne au moins une annonce.
        expect(result.data.length).toBeGreaterThan(0);

        // Toutes les annonces retournées doivent être à Paris.
        for (const annonce of result.data) {
            expect(annonce.ville.toLowerCase()).toBe("paris");
        }
    });

    /**
     * Vérifie que le filtre type retourne uniquement
     * les annonces de location.
     */
    it("filtre les annonces par type", async () => {
        const result = await api.listAnnonces({
            type: "LOCATION",
            limit: 100
        });

        expect(result.data.length).toBeGreaterThan(0);

        for (const annonce of result.data) {
            expect(annonce.type).toBe("LOCATION");
        }
    });

    /**
     * Vérifie que le filtre prixMax exclut
     * les annonces dont le prix dépasse le plafond.
     */
    it("respecte le prix maximal", async () => {
        const prixMax = 250000;

        const result = await api.listAnnonces({
            prixMax,
            limit: 100
        });

        // Le filtre doit retourner au moins une annonce.
        expect(result.data.length).toBeGreaterThan(0);

        for (const annonce of result.data) {
            expect(Number(annonce.prix)).toBeLessThanOrEqual(prixMax);
        }
    });

    /**
     * Vérifie que la liste publique contient les
     * 12 annonces publiées prévues par notre seed,
     * et non les 14 annonces au total.
     */
    it("retourne le nombre attendu d'annonces publiées", async () => {
        const result = await api.listAnnonces({
            limit: 100
        });

        expect(result.pagination.total).toBe(12);
        expect(result.data).toHaveLength(12);
    });

    /**
     * Vérifie qu'une recherche sans résultat
     * retourne une liste vide, sans erreur.
     */
    it("retourne une liste vide si aucune annonce ne correspond", async () => {
        const result = await api.listAnnonces({
            ville: "VilleInexistante12345"
        });

        expect(result.data).toEqual([]);
        expect(result.pagination.total).toBe(0);
        expect(result.pagination.pages).toBe(0);
    });

    /**
     * Vérifie que l'API refuse une demande dépassant
     * la limite de 100 annonces par page.
     *
     * Le SDK doit recevoir une erreur HTTP 400.
     */
    it("refuse les paramètres invalides avec HTTP 400", async () => {
        await expect(
            api.listAnnonces({ limit: 101 })
        ).rejects.toMatchObject({
            response: {
                status: 400
            }
        });
    });

    /**
     * Vérifie que les annonces en brouillon
     * ne sont jamais visibles dans la liste publique.
     *
     * Notre seed contient deux brouillons :
     * demo-immo-annonce-13 et demo-immo-annonce-14.
     */
    it("ne retourne jamais les annonces en brouillon", async () => {
        const result = await api.listAnnonces({
            limit: 100
        });

        const ids = result.data.map(annonce => annonce.id);

        expect(ids).not.toContain("demo-immo-annonce-13");
        expect(ids).not.toContain("demo-immo-annonce-14");
    });



}
);



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

        const response = await sdkPost(token).createAnnonceRaw({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce E2E ${Date.now()}`
            }
        });

        expect(response.raw.status).toBe(201);

        const annonce = await response.value();
        expect(annonce.statut).toBe("BROUILLON");
        expect(annonce.ville).toBe("Le Havre");
        expect(annonce.auteurId).toBeTruthy();
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

        const response = await sdkPost(token).createAnnonceRaw({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Annonce admin E2E ${Date.now()}`
            }
        });

        expect(response.raw.status).toBe(201);

        const annonce = await response.value();
        expect(annonce.statut).toBe("BROUILLON");
        expect(annonce.auteurId).toBeTruthy();
    });
});

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
