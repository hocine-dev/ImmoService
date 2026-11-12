
import { describe, it, expect, vi } from "vitest";

import { Prisma } from
    "../../../src/generated/prisma/client.js";

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
    const update = count > 0
        ? vi.fn().mockResolvedValue(annonce)
        : vi.fn().mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError(
                "An operation failed because it depends on one or more records that were required but not found.",
                {
                    code: "P2025",
                    clientVersion: "test"
                }
            )
        );
    const findFirst = vi.fn().mockResolvedValue(annonce);

    const prisma = {
        annonce: {
            update,
            findFirst
        }
    } as unknown as PrismaClient;

    return {
        repository: createAnnonceRepository(prisma),
        update,
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
        const { repository, update } =
            createRepositoryMock(1, annoncePubliee);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "agent-1",
            false
        );

        expect(result?.statut).toBe("PUBLIE");

        // Vérifier le propriétaire et le statut précédent.
        expect(update).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
            }
        });
    });

    it("autorise la dépublication d'une annonce", async () => {
        const annonceBrouillon = {
            ...annoncePubliee,
            statut: "BROUILLON"
        };

        const { repository, update } =
            createRepositoryMock(1, annonceBrouillon);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "BROUILLON",
            "agent-1",
            false
        );

        expect(result?.statut).toBe("BROUILLON");

        expect(update).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1",
                statut: { not: "BROUILLON" }
            },
            data: {
                statut: "BROUILLON"
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
            }
        });
    });

    it("évite de modifier une annonce déjà publiée", async () => {
        // count = 0 : aucune ligne modifiée par Prisma.
        const { repository, update, findFirst } =
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
        expect(update).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-1",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
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
        const { repository, update } =
            createRepositoryMock(1, annoncePubliee);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "admin-1",
            true
        );

        expect(result?.statut).toBe("PUBLIE");

        // ADMIN n'est pas limité par auteurId.
        expect(update).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
            }
        });
    });

    it("empêche un agent de changer le statut d'un autre (IDOR)", async () => {
        const { repository, update, findFirst } =
            createRepositoryMock(0, null);

        const result = await repository.changeStatutAnnonce(
            "annonce-1",
            "PUBLIE",
            "agent-2",
            false
        );

        expect(result).toBeNull();

        // La protection auteurId reste présente.
        expect(update).toHaveBeenCalledWith({
            where: {
                id: "annonce-1",
                auteurId: "agent-2",
                statut: { not: "PUBLIE" }
            },
            data: {
                statut: "PUBLIE"
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
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
