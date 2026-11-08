
import { describe, it, expect, vi } from "vitest";

import type { PrismaClient } from
    "../../../src/generated/prisma/client.js";

import { createAnnonceRepository } from
    "../../../src/modules/annonces/annonce.repository.js";

import { mesAnnoncesQuerySchema } from
    "../../../src/modules/annonces/annonce.schema.js";

/**
 * Simule uniquement les méthodes Prisma utilisées
 * par GET /annonces/miennes.
 *
 * Aucune connexion à PostgreSQL n'est nécessaire.
 */
function createRepositoryMock(
    annonces: object[] = [],
    total = 0
) {
    const count = vi.fn().mockResolvedValue(total);
    const findMany = vi.fn().mockResolvedValue(annonces);

    const prisma = {
        annonce: {
            count,
            findMany
        }
    } as unknown as PrismaClient;

    return {
        repository: createAnnonceRepository(prisma),
        count,
        findMany
    };
}

/**
 * Annonce fictive : les dates et le prix
 * reproduisent les objets retournés par Prisma.
 */
const annonceBrouillon = {
    id: "annonce-1",
    auteurId: "agent-1",
    titre: "Appartement au Havre",
    statut: "BROUILLON",
    prix: {
        toFixed: () => "250000.00"
    },
    dateDisponibilite: new Date("2026-11-10T00:00:00Z"),
    createdAt: new Date("2026-11-08T10:00:00Z"),
    updatedAt: new Date("2026-11-08T10:00:00Z"),
    photos: []
};

describe("GET /annonces/miennes - Repository", () => {

    it("retourne les brouillons sans imposer PUBLIE", async () => {
        const { repository, count, findMany } =
            createRepositoryMock([annonceBrouillon], 1);

        const query = mesAnnoncesQuerySchema.parse({});

        const result = await repository.findMesAnnonces(
            query,
            "agent-1"
        );

        expect(result.total).toBe(1);
        expect(result.annonces).toHaveLength(1);
        expect(result.annonces[0].statut).toBe("BROUILLON");

        // Vérifier la conversion du prix Prisma.
        expect(result.annonces[0].prix).toBe("250000.00");

        // Aucun filtre de statut par défaut.
        // Mais le propriétaire est toujours imposé.
        expect(count).toHaveBeenCalledWith({
            where: {
                auteurId: "agent-1"
            }
        });

        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    auteurId: "agent-1"
                },
                skip: 0,
                take: 10
            })
        );
    });

    it("applique tous les filtres dans count et findMany", async () => {
        const { repository, count, findMany } =
            createRepositoryMock([], 7);

        const query = mesAnnoncesQuerySchema.parse({
            page: "2",
            limit: "5",
            ville: " Le Havre ",
            type: "VENTE",
            prixMax: "300000",
            statut: "PUBLIE"
        });

        const result = await repository.findMesAnnonces(
            query,
            "agent-2"
        );

        const where = {
            auteurId: "agent-2",
            statut: "PUBLIE",
            ville: {
                contains: "Le Havre",
                mode: "insensitive"
            },
            type: "VENTE",
            prix: {
                lte: 300000
            }
        };

        // Le total doit utiliser les mêmes filtres.
        expect(count).toHaveBeenCalledWith({
            where
        });

        // La liste doit utiliser ces filtres
        // et appliquer la pagination demandée.
        expect(findMany).toHaveBeenCalledWith({
            where,
            skip: 5,
            take: 5,
            orderBy: [
                { createdAt: "desc" },
                { id: "asc" }
            ],
            include: {
                photos: true
            }
        });

        expect(result.total).toBe(7);
    });

    it("adapte le filtre auteurId à l'utilisateur authentifié", async () => {
        const { repository, count, findMany } =
            createRepositoryMock();

        const query = mesAnnoncesQuerySchema.parse({});

        // Première requête : agent 1.
        await repository.findMesAnnonces(
            query,
            "agent-1"
        );

        // Deuxième requête : agent 2.
        await repository.findMesAnnonces(
            query,
            "agent-2"
        );

        expect(count).toHaveBeenNthCalledWith(1, {
            where: { auteurId: "agent-1" }
        });

        expect(count).toHaveBeenNthCalledWith(2, {
            where: { auteurId: "agent-2" }
        });

        expect(findMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: { auteurId: "agent-1" }
            })
        );

        expect(findMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                where: { auteurId: "agent-2" }
            })
        );
    });

    it("retourne une liste vide si aucune annonce ne correspond", async () => {
        const { repository } = createRepositoryMock([], 0);

        const query = mesAnnoncesQuerySchema.parse({
            statut: "BROUILLON"
        });

        const result = await repository.findMesAnnonces(
            query,
            "agent-inconnu"
        );

        expect(result).toEqual({
            annonces: [],
            total: 0
        });
    });

});
