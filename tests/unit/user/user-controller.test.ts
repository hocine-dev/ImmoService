import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Service simulé : le contrôleur est testé seul, sans Prisma ni argon2.
const service = vi.hoisted(() => ({
    getAllUsers: vi.fn(),
    getUserById: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn()
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
    createUserService: () => service
}));

import { createUserController } from "../../../src/modules/user/user.controller.js";

const controller = createUserController({} as never);

// Requête Express simulée, avec les données déjà validées par le middleware.
function buildReq(overrides: Record<string, unknown> = {}) {
    return {
        user: { id: "user-1", role: "USER" },
        validated: {
            params: { id: "target-1" },
            query: { page: 1, limit: 10 },
            body: {}
        },
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
const erreur = (code: string) =>
    expect.objectContaining({
        error: expect.objectContaining({ code })
    });

let next: NextFunction & ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetAllMocks();
    next = vi.fn() as never;
});

describe("userController.getUsers", () => {

    it("retourne 401 quand aucun utilisateur n'est authentifié", async () => {
        const res = buildRes();

        await controller.getUsers(buildReq({ user: undefined }), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(erreur("UNAUTHORIZED"));
        expect(service.getAllUsers).not.toHaveBeenCalled();
    });

    it("retourne 403 quand le service refuse l'accès (null)", async () => {
        const res = buildRes();
        service.getAllUsers.mockResolvedValue(null);

        await controller.getUsers(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(erreur("FORBIDDEN"));
    });

    it("retourne 200 avec les données et la pagination", async () => {
        const res = buildRes();
        const data = [{ id: "u1" }];
        const pagination = { page: 1, limit: 10, total: 1, pages: 1 };
        service.getAllUsers.mockResolvedValue({ data, pagination });

        await controller.getUsers(
            buildReq({ user: { id: "admin-1", role: "ADMIN" } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data, pagination });
    });

    it("transmet le rôle, la page et la limite au service", async () => {
        const res = buildRes();
        service.getAllUsers.mockResolvedValue({ data: [], pagination: {} });

        await controller.getUsers(
            buildReq({
                user: { id: "admin-1", role: "ADMIN" },
                validated: { query: { page: 3, limit: 25 } }
            }),
            res,
            next
        );

        expect(service.getAllUsers).toHaveBeenCalledWith("ADMIN", 3, 25);
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        service.getAllUsers.mockRejectedValue(failure);

        await controller.getUsers(buildReq(), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("userController.getUser", () => {

    it("retourne 200 avec le profil", async () => {
        const res = buildRes();
        const user = { id: "target-1", name: "Alice" };
        service.getUserById.mockResolvedValue(user);

        await controller.getUser(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: user });
    });

    it("transmet l'identifiant, l'utilisateur courant et la pagination au service", async () => {
        const res = buildRes();
        service.getUserById.mockResolvedValue({ id: "target-1" });

        await controller.getUser(
            buildReq({
                user: { id: "admin-1", role: "ADMIN" },
                validated: { params: { id: "target-1" }, query: { page: 2, limit: 5 } }
            }),
            res,
            next
        );

        expect(service.getUserById).toHaveBeenCalledWith("target-1", "admin-1", "ADMIN", 2, 5);
    });

    it("retourne 403 quand le service répond FORBIDDEN", async () => {
        const res = buildRes();
        service.getUserById.mockResolvedValue({ error: "FORBIDDEN" });

        await controller.getUser(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(erreur("FORBIDDEN"));
    });

    it("retourne 404 quand le service répond NOT_FOUND", async () => {
        const res = buildRes();
        service.getUserById.mockResolvedValue({ error: "NOT_FOUND" });

        await controller.getUser(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND"));
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        service.getUserById.mockRejectedValue(failure);

        await controller.getUser(buildReq(), res, next);

        expect(next).toHaveBeenCalledWith(failure);
    });
});

describe("userController.create", () => {
    const body = { name: "Alice", email: "alice@test.local", password: "motdepasse123" };

    it("retourne 201 avec l'utilisateur créé", async () => {
        const res = buildRes();
        const created = { id: "user-1", name: "Alice" };
        service.createUser.mockResolvedValue(created);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(service.createUser).toHaveBeenCalledWith(body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Utilisateur créé avec succès",
            data: created
        });
    });

    it("retourne 409 avec les détails quand l'email existe déjà", async () => {
        const res = buildRes();
        const details = { email: ["Cet email est déjà associé à un autre compte."] };
        service.createUser.mockResolvedValue({ error: "CONFLICT", details });

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({ code: "CONFLICT", details })
            })
        );
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        service.createUser.mockRejectedValue(failure);

        await controller.create(buildReq({ validated: { body } }), res, next);

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("userController.update", () => {
    const body = { name: "Nouveau Nom" };

    it("retourne 200 avec l'utilisateur mis à jour", async () => {
        const res = buildRes();
        const updated = { id: "target-1", name: "Nouveau Nom" };
        service.updateUser.mockResolvedValue(updated);

        await controller.update(
            buildReq({ validated: { params: { id: "target-1" }, body } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Utilisateur mis à jour avec succès",
            data: updated
        });
    });

    it("transmet la cible, l'utilisateur courant, son rôle et le body au service", async () => {
        const res = buildRes();
        service.updateUser.mockResolvedValue({ id: "target-1" });

        await controller.update(
            buildReq({
                user: { id: "admin-1", role: "ADMIN" },
                validated: { params: { id: "target-1" }, body }
            }),
            res,
            next
        );

        expect(service.updateUser).toHaveBeenCalledWith("target-1", "admin-1", "ADMIN", body);
    });

    it("retourne 403 quand le service répond FORBIDDEN", async () => {
        const res = buildRes();
        service.updateUser.mockResolvedValue({ error: "FORBIDDEN" });

        await controller.update(
            buildReq({ validated: { params: { id: "target-1" }, body } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(erreur("FORBIDDEN"));
    });

    it("retourne 404 quand le service répond NOT_FOUND", async () => {
        const res = buildRes();
        service.updateUser.mockResolvedValue({ error: "NOT_FOUND" });

        await controller.update(
            buildReq({ validated: { params: { id: "target-1" }, body } }),
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND"));
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        service.updateUser.mockRejectedValue(failure);

        await controller.update(
            buildReq({ validated: { params: { id: "target-1" }, body } }),
            res,
            next
        );

        expect(next).toHaveBeenCalledWith(failure);
    });
});

describe("userController.remove", () => {

    it("retourne 200 avec un message de confirmation", async () => {
        const res = buildRes();
        service.deleteUser.mockResolvedValue({ id: "target-1" });

        await controller.remove(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Utilisateur supprimé avec succès"
        });
    });

    it("transmet la cible, l'utilisateur courant et son rôle au service", async () => {
        const res = buildRes();
        service.deleteUser.mockResolvedValue({ id: "target-1" });

        await controller.remove(
            buildReq({
                user: { id: "admin-1", role: "ADMIN" },
                validated: { params: { id: "target-1" } }
            }),
            res,
            next
        );

        expect(service.deleteUser).toHaveBeenCalledWith("target-1", "admin-1", "ADMIN");
    });

    it("n'annonce pas de suppression quand elle est refusée (403)", async () => {
        const res = buildRes();
        service.deleteUser.mockResolvedValue({ error: "FORBIDDEN" });

        await controller.remove(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(erreur("FORBIDDEN"));
        expect(res.json).not.toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    it("retourne 404 quand le service répond NOT_FOUND", async () => {
        const res = buildRes();
        service.deleteUser.mockResolvedValue({ error: "NOT_FOUND" });

        await controller.remove(buildReq(), res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(erreur("NOT_FOUND"));
    });

    it("transmet l'erreur au gestionnaire global (next)", async () => {
        const res = buildRes();
        const failure = new Error("boom");
        service.deleteUser.mockRejectedValue(failure);

        await controller.remove(buildReq(), res, next);

        expect(next).toHaveBeenCalledWith(failure);
    });
});