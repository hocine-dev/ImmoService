import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createFavoriController } from "../../../src/modules/favoris/favori.controller.js";

/**
 * Le contrôleur est testé avec le vrai service et un Prisma simulé :
 * chaque test vérifie le code HTTP produit par les vraies règles métier,
 * sans base de données ni module du projet à mocker.
 */
const prisma = {
    annonce: { findUnique: vi.fn() },
    favori: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
    }
};

const controller = createFavoriController(prisma as never);

// Requête Express simulée, avec les données déjà validées par le middleware.
function buildReq(overrides: Record<string, unknown> = {}) {
    return {
        user: { id: "user-1", role: "USER" },
        validated: { params: {}, body: {} },
        ...overrides
    } as unknown as Request;
}

// Réponse Express simulée : status() et json() sont chaînables.
function buildRes() {
    const res: Record<string, ReturnType<typeof vi.fn>> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as unknown as Response & {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
    };
}

// Format d'erreur commun : { error: { code, message, details } }.
const erreur = (code: string, message: string) =>
    expect.objectContaining({
        error: expect.objectContaining({ code, message })
    });

const favoriRecord = (overrides: Record<string, unknown> = {}) => ({
    userId: "user-1",
    annonceId: "annonce-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    annonce: { id: "annonce-1", titre: "Appartement au Havre" },
    ...overrides
});

let next: NextFunction & ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetAllMocks();
    next = vi.fn() as never;
});

describe("favoriController.create", () => {
    const body = { annonceId: "annonce-1" };

    it("retourne 201 avec le favori créé", async () => {
        const res = buildRes();
        const created = favoriRecord();
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockResolvedValue(created);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Annonce ajoutée aux favoris",
            data: created
        });
    });

    it("prend l'utilisateur dans le JWT (req.user), pas dans le body", async () => {
        const res = buildRes();
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(null);
        prisma.favori.create.mockResolvedValue(favoriRecord({ userId: "user-7" }));

        await controller.create(
            buildReq({
                user: { id: "user-7", role: "USER" },
                validated: { body: { annonceId: "annonce-1", userId: "pirate" } }
            }),
            res,
            next
        );

        const args = prisma.favori.create.mock.calls[0][0];
        expect(args.data.userId).toBe("user-7");
    });

    it("retourne 404 quand l'annonce n'existe pas", async () => {
        const res = buildRes();
        prisma.annonce.findUnique.mockResolvedValue(null);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Annonce introuvable"));
        expect(prisma.favori.create).not.toHaveBeenCalled();
    });

    it("retourne 409 quand l'annonce est déjà dans les favoris", async () => {
        const res = buildRes();
        prisma.annonce.findUnique.mockResolvedValue({ id: "annonce-1" });
        prisma.favori.findUnique.mockResolvedValue(favoriRecord());

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            erreur("CONFLICT", "Cette annonce est déjà dans vos favoris")
        );
        expect(prisma.favori.create).not.toHaveBeenCalled();
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        prisma.annonce.findUnique.mockRejectedValue(failure);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });

    it("passe par next quand req.user est absent (le middleware JWT doit l'empêcher en amont)", async () => {
        const res = buildRes();

        await controller.create(buildReq({ user: undefined, validated: { body } }), res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(prisma.annonce.findUnique).not.toHaveBeenCalled();
    });
});

describe("favoriController.remove", () => {
    const params = { annonceId: "annonce-1" };

    it("retourne 200 avec un message de confirmation", async () => {
        const res = buildRes();
        prisma.favori.findUnique.mockResolvedValue(favoriRecord());
        prisma.favori.delete.mockResolvedValue(favoriRecord());

        await controller.remove(buildReq({ validated: { params } }), res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Annonce retirée des favoris"
        });
    });

    it("supprime le favori de l'utilisateur authentifié", async () => {
        const res = buildRes();
        prisma.favori.findUnique.mockResolvedValue(favoriRecord({ userId: "user-7" }));
        prisma.favori.delete.mockResolvedValue(favoriRecord({ userId: "user-7" }));

        await controller.remove(
            buildReq({ user: { id: "user-7", role: "USER" }, validated: { params } }),
            res,
            next
        );

        expect(prisma.favori.delete).toHaveBeenCalledWith({
            where: { userId_annonceId: { userId: "user-7", annonceId: "annonce-1" } }
        });
    });

    it("retourne 404 quand le favori n'existe pas, sans annoncer de suppression", async () => {
        const res = buildRes();
        prisma.favori.findUnique.mockResolvedValue(null);

        await controller.remove(buildReq({ validated: { params } }), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Favori introuvable"));
        expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(prisma.favori.delete).not.toHaveBeenCalled();
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        prisma.favori.findUnique.mockRejectedValue(failure);

        await controller.remove(buildReq({ validated: { params } }), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });

    it("passe par next quand req.user est absent (le middleware JWT doit l'empêcher en amont)", async () => {
        const res = buildRes();

        await controller.remove(buildReq({ user: undefined, validated: { params } }), res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(prisma.favori.findUnique).not.toHaveBeenCalled();
    });
});