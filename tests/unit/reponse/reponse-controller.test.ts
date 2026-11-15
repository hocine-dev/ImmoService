import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createReponseController } from "../../../src/modules/reponses/reponse.controller.js";

// user.service (importé par le service) charge argon2 : simulé.
vi.mock("argon2", () => ({
    hash: vi.fn(),
    verify: vi.fn()
}));

/**
 * Le contrôleur est testé avec le vrai service et un Prisma simulé :
 * chaque test vérifie le code HTTP produit par les vraies règles métier,
 * sans base de données ni module du projet à mocker.
 */
const prisma = {
    question: { findUnique: vi.fn() },
    annonce: { findUnique: vi.fn() },
    reponse: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
    }
};

const controller = createReponseController(prisma as never);

// Requête Express simulée, avec les données déjà validées par le middleware.
function buildReq(overrides: Record<string, unknown> = {}) {
    return {
        user: { id: "agent-1", role: "AGENT" },
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
const erreur = (code: string, message?: string) =>
    expect.objectContaining({
        error: expect.objectContaining({ code, ...(message ? { message } : {}) })
    });

const reponseRecord = (overrides: Record<string, unknown> = {}) => ({
    id: "reponse-1",
    texte: "Oui, le logement est disponible.",
    questionId: "question-1",
    auteurId: "agent-1",
    ...overrides
});

let next: NextFunction & ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetAllMocks();
    next = vi.fn() as never;
});

describe("reponseController.create", () => {
    const body = { texte: "Oui, le logement est disponible.", questionId: "question-1" };

    // Question existante, annonce de l'agent 1, pas encore de réponse.
    function mockCreationPossible() {
        prisma.question.findUnique.mockResolvedValue({ annonceId: "annonce-1" });
        prisma.annonce.findUnique.mockResolvedValue({ auteurId: "agent-1" });
        prisma.reponse.findUnique.mockResolvedValue(null);
    }

    it("retourne 401 quand aucun utilisateur n'est authentifié, sans interroger la base", async () => {
        const res = buildRes();

        await controller.create(buildReq({ user: undefined, validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(erreur("UNAUTHORIZED"));
        expect(prisma.question.findUnique).not.toHaveBeenCalled();
    });

    it("retourne 201 avec la réponse créée", async () => {
        const res = buildRes();
        const created = reponseRecord();
        mockCreationPossible();
        prisma.reponse.create.mockResolvedValue(created);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            status: "success",
            message: "Réponse ajoutée avec succès",
            data: created
        });
    });

    it("prend l'auteur dans le JWT, jamais dans le body", async () => {
        const res = buildRes();
        mockCreationPossible();
        prisma.reponse.create.mockResolvedValue(reponseRecord());

        await controller.create(
            buildReq({
                user: { id: "agent-1", role: "AGENT" },
                validated: { body: { ...body, auteurId: "pirate" } }
            }),
            res,
            next
        );

        const args = prisma.reponse.create.mock.calls[0][0];
        expect(args.data.auteurId).toBe("agent-1");
    });

    it("retourne 404 quand la question n'existe pas", async () => {
        const res = buildRes();
        prisma.question.findUnique.mockResolvedValue(null);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Question introuvable"));
    });

    it("retourne 403 quand l'agent n'est pas propriétaire de l'annonce", async () => {
        const res = buildRes();
        mockCreationPossible();

        await controller.create(
            buildReq({ user: { id: "agent-2", role: "AGENT" }, validated: { body } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(erreur("FORBIDDEN", "Accès refusé"));
        expect(prisma.reponse.create).not.toHaveBeenCalled();
    });

    it("autorise un administrateur qui n'est pas propriétaire", async () => {
        const res = buildRes();
        mockCreationPossible();
        prisma.reponse.create.mockResolvedValue(reponseRecord({ auteurId: "admin-1" }));

        await controller.create(
            buildReq({ user: { id: "admin-1", role: "ADMIN" }, validated: { body } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(201);
    });

    it("retourne 409 quand la question a déjà une réponse", async () => {
        const res = buildRes();
        mockCreationPossible();
        prisma.reponse.findUnique.mockResolvedValue({ id: "reponse-existante" });

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            erreur("CONFLICT", "Cette question a déjà une réponse")
        );
        expect(prisma.reponse.create).not.toHaveBeenCalled();
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        prisma.question.findUnique.mockRejectedValue(failure);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("reponseController.getByQuestion", () => {
    const params = { questionId: "question-1" };

    // Question existante et annonce dans le statut donné.
    function mockAnnonce(statut: "PUBLIE" | "BROUILLON", reponse: unknown = reponseRecord()) {
        prisma.question.findUnique.mockResolvedValue({ annonceId: "annonce-1" });
        prisma.annonce.findUnique.mockResolvedValue({ auteurId: "agent-1", statut });
        prisma.reponse.findUnique.mockResolvedValue(reponse);
    }

    it("retourne 200 avec la réponse", async () => {
        const res = buildRes();
        const reponse = reponseRecord({ auteur: { id: "agent-1", name: "Agent Un" } });
        mockAnnonce("PUBLIE", reponse);

        await controller.getByQuestion(
            buildReq({ user: { id: "user-1", role: "USER" }, validated: { params } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ status: "success", data: reponse });
    });

    it("accepte un visiteur sans utilisateur authentifié sur une annonce publiée", async () => {
        const res = buildRes();
        mockAnnonce("PUBLIE");

        await controller.getByQuestion(
            buildReq({ user: undefined, validated: { params } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("retourne 404 quand la question n'existe pas", async () => {
        const res = buildRes();
        prisma.question.findUnique.mockResolvedValue(null);

        await controller.getByQuestion(buildReq({ validated: { params } }), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Réponse introuvable"));
    });

    it("retourne 404 quand la question n'a pas de réponse", async () => {
        const res = buildRes();
        mockAnnonce("PUBLIE", null);

        await controller.getByQuestion(buildReq({ validated: { params } }), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Réponse introuvable"));
    });

    it("retourne 404 pour un utilisateur standard quand l'annonce est en brouillon", async () => {
        const res = buildRes();
        mockAnnonce("BROUILLON");

        await controller.getByQuestion(
            buildReq({ user: { id: "user-1", role: "USER" }, validated: { params } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Réponse introuvable"));
    });

    it("retourne 200 à l'agent propriétaire quand l'annonce est en brouillon", async () => {
        const res = buildRes();
        mockAnnonce("BROUILLON");

        await controller.getByQuestion(
            buildReq({ user: { id: "agent-1", role: "AGENT" }, validated: { params } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        prisma.question.findUnique.mockRejectedValue(failure);

        await controller.getByQuestion(buildReq({ validated: { params } }), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("reponseController.remove", () => {
    const params = { id: "reponse-1" };

    it("retourne 401 quand aucun utilisateur n'est authentifié, sans interroger la base", async () => {
        const res = buildRes();

        await controller.remove(buildReq({ user: undefined, validated: { params } }), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(erreur("UNAUTHORIZED"));
        expect(prisma.reponse.findUnique).not.toHaveBeenCalled();
    });

    it("retourne 200 avec un message quand l'auteur supprime sa réponse", async () => {
        const res = buildRes();
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));
        prisma.reponse.delete.mockResolvedValue(reponseRecord());

        await controller.remove(buildReq({ validated: { params } }), res, next);

        expect(prisma.reponse.delete).toHaveBeenCalledWith({ where: { id: "reponse-1" } });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            status: "success",
            message: "Réponse supprimée avec succès"
        });
    });

    it("permet à un administrateur de supprimer la réponse d'un autre", async () => {
        const res = buildRes();
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));
        prisma.reponse.delete.mockResolvedValue(reponseRecord());

        await controller.remove(
            buildReq({ user: { id: "admin-1", role: "ADMIN" }, validated: { params } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("retourne 404 quand la réponse n'existe pas", async () => {
        const res = buildRes();
        prisma.reponse.findUnique.mockResolvedValue(null);

        await controller.remove(buildReq({ validated: { params } }), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND", "Réponse introuvable"));
    });

    it("n'annonce pas de suppression quand elle est refusée (403)", async () => {
        const res = buildRes();
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));

        await controller.remove(
            buildReq({ user: { id: "agent-2", role: "AGENT" }, validated: { params } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(erreur("FORBIDDEN", "Accès refusé"));
        expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
        expect(prisma.reponse.delete).not.toHaveBeenCalled();
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        prisma.reponse.findUnique.mockRejectedValue(failure);

        await controller.remove(buildReq({ validated: { params } }), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });
});