
import { describe, it, expect, vi } from "vitest";

import {
    updateAnnonceSchema,
    updateAnnonceRequestSchema
} from "../../../src/modules/annonces/annonce.schema.js";

import {
    updateAnnonce
} from "../../../src/modules/annonces/annonce.service.js";


/**
 * Tests unitaires du schéma PATCH.
 *
 * Objectif : vérifier les règles de validation Zod
 * sans démarrer Express ni PostgreSQL.
 */
describe("PATCH /annonces/:id - Validation Zod", () => {

    it("accepte une modification partielle", () => {
        // PATCH ne nécessite pas tous les champs de l'annonce.
        const result = updateAnnonceSchema.safeParse({
            prix: "195000.00"
        });

        expect(result.success).toBe(true);
    });

    it("refuse un corps JSON vide", () => {
        // Une requête PATCH doit modifier au moins un champ.
        const result = updateAnnonceSchema.safeParse({});

        expect(result.success).toBe(false);
    });

    it("interdit la modification du propriétaire et du statut", () => {
        // Ces champs sont contrôlés exclusivement par le serveur.
        const result = updateAnnonceSchema.safeParse({
            titre: "Appartement modifié",
            auteurId: "autre-agent",
            statut: "PUBLIE"
        });

        expect(result.success).toBe(false);
    });

    it("refuse un prix négatif", () => {
        // On conserve les règles métier utilisées lors du POST.
        const result = updateAnnonceSchema.safeParse({
            prix: "-100"
        });

        expect(result.success).toBe(false);
    });

    it("refuse une surface et un nombre de chambres hors limites", () => {
        // Surface autorisée : de 9 à 2000 m².
        expect(
            updateAnnonceSchema.safeParse({ surface: 5 }).success
        ).toBe(false);

        // Nombre de chambres autorisé : de 0 à 20.
        expect(
            updateAnnonceSchema.safeParse({ chambres: 21 }).success
        ).toBe(false);
    });

    it("valide ensemble l'identifiant et les données du PATCH", () => {
        // Le middleware commun utilise ce schéma de requête.
        const result = updateAnnonceRequestSchema.safeParse({
            params: { id: "demo-immo-annonce-01" },
            body: { ville: "Rouen" }
        });

        expect(result.success).toBe(true);

        // Un identifiant vide doit être refusé.
        expect(
            updateAnnonceRequestSchema.safeParse({
                params: { id: "" },
                body: { ville: "Rouen" }
            }).success
        ).toBe(false);
    });
});


/**
 * Tests unitaires du Service PATCH.
 *
 * On remplace le Repository par un mock Vitest.
 * Aucune connexion PostgreSQL n'est nécessaire.
 */
describe("PATCH /annonces/:id - Service", () => {

    it("transmet les paramètres d'un agent au Repository", async () => {
        // Simulation d'un Repository qui réussit la modification.
        const annonce = {
            id: "annonce-01",
            prix: "195000.00"
        };

        const repository = {
            updateAnnonce: vi.fn().mockResolvedValue(annonce)
        };

        const result = await updateAnnonce(
            repository,
            "annonce-01",
            { prix: "195000.00" },
            "agent-01",
            false // L'utilisateur n'est pas ADMIN.
        );

        // Vérifier que le Service transmet exactement les paramètres.
        expect(repository.updateAnnonce).toHaveBeenCalledWith(
            "annonce-01",
            { prix: "195000.00" },
            "agent-01",
            false
        );

        expect(result).toEqual(annonce);
    });

    it("transmet correctement le rôle administrateur", async () => {
        const repository = {
            updateAnnonce: vi.fn().mockResolvedValue({
                id: "annonce-01"
            })
        };

        await updateAnnonce(
            repository,
            "annonce-01",
            { ville: "Le Havre" },
            "admin-01",
            true // L'utilisateur est ADMIN.
        );

        expect(repository.updateAnnonce).toHaveBeenCalledWith(
            "annonce-01",
            { ville: "Le Havre" },
            "admin-01",
            true
        );
    });

    it("retourne null lorsque le Repository ne modifie rien", async () => {
        // Cas d'une annonce inexistante ou non accessible.
        const repository = {
            updateAnnonce: vi.fn().mockResolvedValue(null)
        };

        const result = await updateAnnonce(
            repository,
            "annonce-inexistante",
            { titre: "Nouveau titre" },
            "agent-01",
            false
        );

        // Le Controller transformera ce résultat en HTTP 404.
        expect(result).toBeNull();
    });
});
