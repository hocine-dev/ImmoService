import { describe, it, expect } from "vitest";
import {
    baseUrl,
    getToken,
    getAgentToken,
    sdkPost,
    annonceValide
} from "./helpers.js";

describe("GET /annonces/:id - Accès aux brouillons", () => {

        it("autorise l'auteur et l'ADMIN, mais refuse les autres", async () => {
            const tokenAgent1 = await getAgentToken();

            const tokenAgent2 = await getToken(
                process.env.SEED_AGENT_2_EMAIL,
                process.env.SEED_AGENT_2_PASSWORD
            );

            const tokenAdmin = await getToken(
                process.env.SEED_ADMIN_EMAIL,
                process.env.SEED_ADMIN_PASSWORD
            );

            const annonce = await sdkPost(tokenAgent1).createAnnonce({
                createAnnonceInput: {
                    ...annonceValide,
                    titre: `Test lecture brouillon ${Date.now()}`
                }
            });

            const url = `${baseUrl}/annonces/${annonce.id}`;

            const consulter = (token?: string) =>
                fetch(url, {
                    headers: token
                        ? { Authorization: `Bearer ${token}` }
                        : {}
                });

            try {
                // Un visiteur ne peut pas lire le brouillon.
                const visiteur = await consulter();
                expect(visiteur.status).toBe(404);

                // Un autre agent ne peut pas lire le brouillon.
                const agent2 = await consulter(tokenAgent2);
                expect(agent2.status).toBe(404);

                // L'auteur peut consulter son brouillon.
                const auteur = await consulter(tokenAgent1);
                expect(auteur.status).toBe(200);

                const detailAuteur = await auteur.json();
                expect(detailAuteur.id).toBe(annonce.id);
                expect(detailAuteur.statut).toBe("BROUILLON");

                // L'administrateur peut également le consulter.
                const admin = await consulter(tokenAdmin);
                expect(admin.status).toBe(200);

                const detailAdmin = await admin.json();
                expect(detailAdmin.id).toBe(annonce.id);

            } finally {
                const suppression = await sdkPost(tokenAgent1).deleteAnnonceRaw({
                    id: annonce.id
                });

                expect(suppression.raw.status).toBe(204);
            }
        });

        it("refuse un JWT invalide avec HTTP 401", async () => {
            const response = await fetch(
                `${baseUrl}/annonces/demo-immo-annonce-12`,
                {
                    headers: {
                        Authorization: "Bearer jeton-invalide"
                    }
                }
            );

            expect(response.status).toBe(401);
    });

});
