
import { describe, it, expect, vi } from "vitest";

import { createAnnonceService } from
    "../../../src/modules/annonces/annonce.service.js";

describe("GET /annonces - Service", () => {

    /**
     * Vérifie que le Service transmet correctement les filtres
     * et la pagination au Repository.
     *
     * Vérifie également que les annonces récupérées sont
     * retournées dans le format JSON prévu par notre API.
     */
    it("récupère les annonces avec les bons paramètres", async () => {
        const annonces = [
            { id: "1", titre: "Appartement Paris" },
            { id: "2", titre: "Maison Paris" }
        ];

        // Faux Repository : aucune connexion à PostgreSQL
        const repository = {
            findPublishedPage: vi.fn().mockResolvedValue({
                annonces,
                total: 5
            })
        };

        const service = createAnnonceService(repository);

        const query = {
            page: 1,
            limit: 2,
            ville: "Paris",
            type: "VENTE" as const
        };

        const result = await service.listAnnonces(query);

        // Vérifie les paramètres transmis au Repository
        expect(repository.findPublishedPage)
            .toHaveBeenCalledWith(query);

        // Vérifie le résultat retourné au Controller
        expect(result).toEqual({
            data: annonces,
            pagination: {
                page: 1,
                limit: 2,
                total: 5,
                pages: 3
            }
        });
    });

    /**
     * Vérifie le calcul du nombre total de pages.
     *
     * Avec 25 annonces et une limite de 10 par page,
     * il faut 3 pages : 10 + 10 + 5.
     * La dernière page peut donc être incomplète.
     */
    it("calcule correctement le nombre de pages", async () => {
        const repository = {
            findPublishedPage: async () => ({
                annonces: [],
                total: 25
            })
        };

        const service = createAnnonceService(repository);

        const result = await service.listAnnonces({
            page: 1,
            limit: 10
        });

        expect(result.pagination.pages).toBe(3);
        expect(result.pagination.total).toBe(25);
    });

    /**
     * Vérifie que le Service retourne une liste vide
     * et zéro page lorsqu'aucune annonce ne correspond
     * aux critères de recherche.
     *
     * Ce cas ne doit pas provoquer d'erreur HTTP.
     */
    it("gère correctement une liste vide", async () => {
        const repository = {
            findPublishedPage: async () => ({
                annonces: [],
                total: 0
            })
        };

        const service = createAnnonceService(repository);

        const result = await service.listAnnonces({
            page: 1,
            limit: 10
        });

        expect(result).toEqual({
            data: [],
            pagination: {
                page: 1,
                limit: 10,
                total: 0,
                pages: 0
            }
        });
    });

});
