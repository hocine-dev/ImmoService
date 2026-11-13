import { describe, it, expect } from "vitest";
import { api } from "./helpers.js";

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
