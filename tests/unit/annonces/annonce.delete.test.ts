
import { describe, it, expect, vi } from "vitest";

import type { PrismaClient } from
    "../../../src/generated/prisma/client.js";

import { createAnnonceRepository } from
    "../../../src/modules/annonces/annonce.repository.js";

import { deleteAnnonce } from
    "../../../src/modules/annonces/annonce.service.js";


/**
 * Crée un faux Prisma pour les tests.
 *
 * Aucune connexion PostgreSQL n'est utilisée.
 * On contrôle simplement le résultat de deleteMany().
 */
function createRepositoryMock(count: number) {
    const deleteMany = vi.fn().mockResolvedValue({ count });

    const prisma = {
        annonce: { deleteMany }
    } as unknown as PrismaClient;

    return {
        repository: createAnnonceRepository(prisma),
        deleteMany
    };
}


describe("DELETE annonce - Tests unitaires", () => {

    it("autorise un agent à supprimer sa propre annonce", async () => {
        // Prisma indique qu'une annonce a été supprimée.
        const { repository, deleteMany } = createRepositoryMock(1);

        const result = await repository.deleteAnnonce(
            "annonce-1",
            "agent-1",
            false
        );

        expect(result).toBe(true);

        // L'agent ne peut supprimer que ses annonces.
        expect(deleteMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1"
            }
        });
    });


    it("protège contre la suppression d'une annonce d'un autre agent (IDOR)", async () => {
        // Aucune ligne ne correspond aux conditions.
        const { repository, deleteMany } = createRepositoryMock(0);

        const result = await repository.deleteAnnonce(
            "annonce-agent-1",
            "agent-2",
            false
        );

        expect(result).toBe(false);

        // La condition auteurId est obligatoire pour un agent.
        expect(deleteMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-agent-1",
                auteurId: "agent-2"
            }
        });
    });


    it("autorise un administrateur à supprimer toute annonce", async () => {
        const { repository, deleteMany } = createRepositoryMock(1);

        const result = await repository.deleteAnnonce(
            "annonce-1",
            "admin-1",
            true
        );

        expect(result).toBe(true);

        // Un administrateur n'est pas limité par auteurId.
        expect(deleteMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1"
            }
        });
    });


    it("retourne false si l'annonce n'existe pas", async () => {
        const { repository } = createRepositoryMock(0);

        const result = await repository.deleteAnnonce(
            "annonce-inexistante",
            "admin-1",
            true
        );

        expect(result).toBe(false);
    });


    it("vérifie que le Service transmet correctement les paramètres", async () => {
        // Simuler uniquement le Repository.
        const repository = {
            deleteAnnonce: vi.fn().mockResolvedValue(true)
        };

        const result = await deleteAnnonce(
            repository,
            "annonce-1",
            "agent-1",
            false
        );

        expect(result).toBe(true);

        expect(repository.deleteAnnonce).toHaveBeenCalledWith(
            "annonce-1",
            "agent-1",
            false
        );
    });


    it("vérifie que le Service transmet un échec de suppression", async () => {
        const repository = {
            deleteAnnonce: vi.fn().mockResolvedValue(false)
        };

        const result = await deleteAnnonce(
            repository,
            "annonce-inexistante",
            "agent-1",
            false
        );

        expect(result).toBe(false);
    });

});
