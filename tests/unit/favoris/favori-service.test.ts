import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFavoriService } from "../../../src/modules/favoris/favori.service.js";

// Prisma simulé : seules les méthodes utilisées par le service sont déclarées.
const prisma = {
    annonce: { findUnique: vi.fn() },
    favori: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
    }
};

const service = createFavoriService(prisma as never);

const annonce = {
    id: "annonce-1",
    titre: "Appartement au Havre",
    ville: "Le Havre"
};

const favoriRecord = (overrides: Record<string, unknown> = {}) => ({
    userId: "user-1",
    annonceId: "annonce-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
});

beforeEach(() => {
    vi.resetAllMocks();
});

describe("favoriService.createFavori", () => {

    it("vérifie l'existence de l'annonce avec une sélection minimale", async () => {
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockResolvedValue(favoriRecord({ annonce }));

        await service.createFavori("user-1", { annonceId: "annonce-1" });

        expect(prisma.annonce.findUnique).toHaveBeenCalledWith({
            where: { id: "annonce-1" },
            select: { id: true }
        });
    });

    it("retourne NOT_FOUND quand l'annonce n'existe pas, sans rien créer", async () => {
        prisma.annonce.findUnique.mockResolvedValue(null);

        const result = await service.createFavori("user-1", { annonceId: "absente" });

        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.favori.findUnique).not.toHaveBeenCalled();
        expect(prisma.favori.create).not.toHaveBeenCalled();
    });

    it("cherche le favori existant avec la clé composée (utilisateur, annonce)", async () => {
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockResolvedValue(favoriRecord({ annonce }));

        await service.createFavori("user-1", { annonceId: "annonce-1" });

        expect(prisma.favori.findUnique).toHaveBeenCalledWith({
            where: { userId_annonceId: { userId: "user-1", annonceId: "annonce-1" } }
        });
    });

    it("retourne CONFLICT quand l'annonce est déjà dans les favoris, sans en créer un second", async () => {
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(favoriRecord());

        const result = await service.createFavori("user-1", { annonceId: "annonce-1" });

        expect(result).toEqual({ error: "CONFLICT" });
        expect(prisma.favori.create).not.toHaveBeenCalled();
    });

    it("crée le favori pour l'utilisateur fourni et inclut l'annonce", async () => {
        const created = favoriRecord({ annonce });
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockResolvedValue(created);

        const result = await service.createFavori("user-1", { annonceId: "annonce-1" });

        expect(prisma.favori.create).toHaveBeenCalledWith({
            data: { userId: "user-1", annonceId: "annonce-1" },
            include: { annonce: true }
        });
        expect(result).toEqual(created);
    });

    it("n'accorde pas le favori à un autre utilisateur que celui fourni", async () => {
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockResolvedValue(favoriRecord({ userId: "user-2", annonce }));

        await service.createFavori("user-2", { annonceId: "annonce-1" });

        const args = prisma.favori.create.mock.calls[0][0];
        expect(args.data.userId).toBe("user-2");
    });

    it("propage une erreur de la base lors de la recherche de l'annonce", async () => {
        prisma.annonce.findUnique.mockRejectedValue(new Error("base indisponible"));

        await expect(
            service.createFavori("user-1", { annonceId: "annonce-1" })
        ).rejects.toThrow("base indisponible");
        expect(prisma.favori.create).not.toHaveBeenCalled();
    });

    it("propage une erreur de la base lors de la création (ex. violation d'unicité simultanée)", async () => {
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockRejectedValue(
            Object.assign(new Error("unique"), { code: "P2002" })
        );

        await expect(
            service.createFavori("user-1", { annonceId: "annonce-1" })
        ).rejects.toThrow("unique");
    });
});

describe("favoriService.deleteFavori", () => {

    it("cherche le favori avec la clé composée (utilisateur, annonce)", async () => {
        prisma.favori.findUnique.mockResolvedValue(favoriRecord());
        prisma.favori.delete.mockResolvedValue(favoriRecord());

        await service.deleteFavori("user-1", "annonce-1");

        expect(prisma.favori.findUnique).toHaveBeenCalledWith({
            where: { userId_annonceId: { userId: "user-1", annonceId: "annonce-1" } }
        });
    });

    it("retourne NOT_FOUND quand l'utilisateur n'a pas cette annonce en favori, sans rien supprimer", async () => {
        prisma.favori.findUnique.mockResolvedValue(null);

        const result = await service.deleteFavori("user-1", "annonce-1");

        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.favori.delete).not.toHaveBeenCalled();
    });

    it("supprime le favori de l'utilisateur et retourne success", async () => {
        prisma.favori.findUnique.mockResolvedValue(favoriRecord());
        prisma.favori.delete.mockResolvedValue(favoriRecord());

        const result = await service.deleteFavori("user-1", "annonce-1");

        expect(prisma.favori.delete).toHaveBeenCalledWith({
            where: { userId_annonceId: { userId: "user-1", annonceId: "annonce-1" } }
        });
        expect(result).toEqual({ success: true });
    });

    it("ne cible que les favoris de l'utilisateur fourni (pas ceux des autres)", async () => {
        prisma.favori.findUnique.mockResolvedValue(favoriRecord({ userId: "user-2" }));
        prisma.favori.delete.mockResolvedValue(favoriRecord({ userId: "user-2" }));

        await service.deleteFavori("user-2", "annonce-1");

        const args = prisma.favori.delete.mock.calls[0][0];
        expect(args.where.userId_annonceId.userId).toBe("user-2");
    });

    it("propage une erreur de la base lors de la suppression", async () => {
        prisma.favori.findUnique.mockResolvedValue(favoriRecord());
        prisma.favori.delete.mockRejectedValue(new Error("contrainte violée"));

        await expect(service.deleteFavori("user-1", "annonce-1")).rejects.toThrow(
            "contrainte violée"
        );
    });
});