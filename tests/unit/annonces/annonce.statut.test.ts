
import { describe, it, expect, vi } from "vitest";

import type { PrismaClient } from
    "../../../src/generated/prisma/client.js";

import { createAnnonceRepository } from
    "../../../src/modules/annonces/annonce.repository.js";

/**
 * Simule Prisma sans connexion PostgreSQL.
 */
function createRepositoryMock(
    count: number,
    annonce: object | null
) {
    const updateMany = vi.fn().mockResolvedValue({ count });
    const findFirst = vi.fn().mockResolvedValue(annonce);

    const prisma = {
        annonce: {
            updateMany,
            findFirst
        }
    } as unknown as PrismaClient;

    return {
        repository: createAnnonceRepository(prisma),
        updateMany,
        findFirst
    };
}

const annoncePubliee = {
    id: "annonce-1",
    statut: "PUBLIE",
    auteurId: "agent-1",
    updatedAt: new Date("2026-11-08T10:00:00.000Z")
};

describe("Publication et dépublication - Tests unitaires", () => {

    it("autorise un agent à publier sa propre annonce", async () => {
        const { repository, updateMany } =
            createRepositoryMock(1, annoncePubliee);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "agent-1",
            false
        );

        expect(result?.statut).toBe("PUBLIE");

        // Vérifier le propriétaire et le statut précédent.
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            }
        });
    });

    it("autorise la dépublication d'une annonce", async () => {
        const annonceBrouillon = {
            ...annoncePubliee,
            statut: "BROUILLON"
        };

        const { repository, updateMany } =
            createRepositoryMock(1, annonceBrouillon);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "BROUILLON",
            "agent-1",
            false
        );

        expect(result?.statut).toBe("BROUILLON");

        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1",
                statut: { not: "BROUILLON" }
            },
            data: {
                statut: "BROUILLON"
            }
        });
    });

    it("évite de modifier une annonce déjà publiée", async () => {
        // count = 0 : aucune ligne modifiée par Prisma.
        const { repository, updateMany, findFirst } =
            createRepositoryMock(0, annoncePubliee);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "agent-1",
            false
        );

        // L'opération reste réussie.
        expect(result?.statut).toBe("PUBLIE");

        // La condition exclut les annonces déjà publiées.
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            }
        });

        // L'annonce est relue avec vérification du propriétaire.
        expect(findFirst).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1"
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
            }
        });
    });

    it("autorise un administrateur à changer le statut", async () => {
        const { repository, updateMany } =
            createRepositoryMock(1, annoncePubliee);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "admin-1",
            true
        );

        expect(result?.statut).toBe("PUBLIE");

        // ADMIN n'est pas limité par auteurId.
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            }
        });
    });

    it("empêche un agent de changer le statut d'un autre (IDOR)", async () => {
        const { repository, updateMany, findFirst } =
            createRepositoryMock(0, null);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "agent-2",
            false
        );

        expect(result).toBeNull();

        // La protection auteurId reste présente.
        expect(updateMany).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-2",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            }
        });

        expect(findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: "annonce-1",
                    auteurId: "agent-2"
                }
            })
        );
    });

    it("retourne null si l'annonce n'existe pas", async () => {
        const { repository } = createRepositoryMock(0, null);

        const result = await repository.changeStatutAnnonce(
            "annonce-inexistante",
            "PUBLIE",
            "admin-1",
            true
        );

        expect(result).toBeNull();
    });

});
