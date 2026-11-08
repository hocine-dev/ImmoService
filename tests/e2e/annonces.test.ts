
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

/**
 * Tests E2E de PATCH /annonces/:id.
 *
 * Les appels passent par le SDK généré depuis OpenAPI.
 * Le serveur utilise la base PostgreSQL de test (port 3002).
 */
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

        const tokenAdmin = await getToken(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        // L'administrateur modifie une annonce dont il n'est pas l'auteur.
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



/**
 * Tests E2E de DELETE /annonces/:id.
 *
 * On crée des annonces spécifiques aux tests
 * afin de ne jamais supprimer les données du seed.
 */
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
        const response = await fetch(
            `${baseUrl}/annonces/${annonce.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        // 204 : suppression réussie, sans corps JSON.
        expect(response.status).toBe(204);
        expect(await response.text()).toBe("");

        // Une deuxième suppression doit échouer :
        // l'annonce n'existe plus.
        const secondeSuppression = await fetch(
            `${baseUrl}/annonces/${annonce.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        expect(secondeSuppression.status).toBe(404);
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
        const tentative = await fetch(
            `${baseUrl}/annonces/${annonce.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokenAgent2}`
                }
            }
        );

        // L'accès est refusé sans révéler le propriétaire.
        expect(tentative.status).toBe(404);

        // L'agent 1 doit encore pouvoir supprimer
        // son annonce : la tentative IDOR n'a rien effacé.
        const suppressionLegitime = await fetch(
            `${baseUrl}/annonces/${annonce.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokenAgent1}`
                }
            }
        );

        expect(suppressionLegitime.status).toBe(204);
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
        const response = await fetch(
            `${baseUrl}/annonces/${annonce.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokenAdmin}`
                }
            }
        );

        expect(response.status).toBe(204);
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


/**
 * Tests E2E de publication et dépublication.
 *
 * L'annonce est créée spécialement pour le test.
 * Elle est supprimée à la fin pour ne pas modifier
 * les résultats des autres tests E2E.
 */
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

        // Fonction utilitaire pour appeler notre route.
        const changerStatut = async (
            statut: "PUBLIE" | "BROUILLON"
        ) => {
            const response = await fetch(
                `${baseUrl}/annonces/${annonce.id}/statut`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ statut })
                }
            );

            expect(response.status).toBe(200);

            return response.json() as Promise<{
                statut: string;
                updatedAt: string;
            }>;
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
            expect(secondePublication.updatedAt).toBe(
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
            expect(secondeDepublication.updatedAt).toBe(
                premiereDepublication.updatedAt
            );

        } finally {
            // Nettoyage : supprimer l'annonce du test,
            // même si une assertion précédente échoue.
            const suppression = await fetch(
                `${baseUrl}/annonces/${annonce.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            expect(suppression.status).toBe(204);
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
            const response = await envoyerStatut(
                annonce.id,
                tokenAgent2,
                { statut: "PUBLIE" }
            );

            expect(response.status).toBe(404);

            // Le brouillon ne doit pas être devenu public.
            await expect(
                api.getAnnonceById({ id: annonce.id })
            ).rejects.toMatchObject({
                response: { status: 404 }
            });

        } finally {
            // Nettoyage avec le propriétaire légitime.
            const suppression = await fetch(
                `${baseUrl}/annonces/${annonce.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${tokenAgent1}`
                    }
                }
            );

            expect(suppression.status).toBe(204);
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
            const response = await envoyerStatut(
                annonce.id,
                tokenAdmin,
                { statut: "PUBLIE" }
            );

            expect(response.status).toBe(200);

            const resultat = await response.json();

            expect(resultat.statut).toBe("PUBLIE");
            expect(resultat.auteurId).toBe(annonce.auteurId);

        } finally {
            const suppression = await fetch(
                `${baseUrl}/annonces/${annonce.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${tokenAgent}`
                    }
                }
            );

            expect(suppression.status).toBe(204);
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