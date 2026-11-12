import { describe, it, expect, vi, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { createUserService, Role } from "../../../src/modules/user/user.service.js";

// argon2 est simulé : les tests restent instantanés.
vi.mock("argon2", () => ({
    hash: vi.fn(),
    verify: vi.fn()
}));

// Prisma simulé : seules les méthodes utilisées par le service sont déclarées.
const prisma = {
    user: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    }
};

const service = createUserService(prisma as never);

// Enregistrement tel que Prisma le renverrait (avec le hash du mot de passe).
const userRecord = (overrides: Record<string, unknown> = {}) => ({
    id: "user-1",
    name: "Alice",
    email: "alice@test.local",
    role: Role.USER,
    passwordHash: "hash-secret",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    annonces: [],
    favoris: [],
    _count: { annonces: 0, favoris: 0 },
    ...overrides
});

beforeEach(() => {
    vi.resetAllMocks();
});

describe("userService.getAllUsers", () => {

    it.each([Role.USER, Role.AGENT])("retourne null pour le rôle %s sans interroger la base", async (role) => {
        const result = await service.getAllUsers(role, 1, 10);

        expect(result).toBeNull();
        expect(prisma.user.count).not.toHaveBeenCalled();
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("retourne la page demandée pour un administrateur", async () => {
        const users = [{ id: "u1" }, { id: "u2" }];
        prisma.user.count.mockResolvedValue(25);
        prisma.user.findMany.mockResolvedValue(users);

        const result = await service.getAllUsers(Role.ADMIN, 2, 10);

        expect(prisma.user.findMany).toHaveBeenCalledWith({
            skip: 10,
            take: 10,
            orderBy: { id: "asc" },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
        expect(result).toEqual({
            data: users,
            pagination: { page: 2, limit: 10, total: 25, pages: 3 }
        });
    });

    it("ne sélectionne jamais le passwordHash", async () => {
        prisma.user.count.mockResolvedValue(0);
        prisma.user.findMany.mockResolvedValue([]);

        await service.getAllUsers(Role.ADMIN, 1, 10);

        const args = prisma.user.findMany.mock.calls[0][0];
        expect(args.select.passwordHash).toBeUndefined();
    });

    it("retourne 0 page quand il n'y a aucun utilisateur", async () => {
        prisma.user.count.mockResolvedValue(0);
        prisma.user.findMany.mockResolvedValue([]);

        const result = await service.getAllUsers(Role.ADMIN, 1, 10);

        expect(result?.pagination).toEqual({ page: 1, limit: 10, total: 0, pages: 0 });
    });

    it("arrondit le nombre de pages à l'entier supérieur", async () => {
        prisma.user.count.mockResolvedValue(21);
        prisma.user.findMany.mockResolvedValue([]);

        const result = await service.getAllUsers(Role.ADMIN, 1, 10);

        expect(result?.pagination.pages).toBe(3);
    });
});

describe("userService.getUserById", () => {

    it("refuse l'accès au profil d'un autre utilisateur sans interroger la base", async () => {
        const result = await service.getUserById("user-2", "user-1", Role.USER);

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("refuse l'accès à un agent qui consulte un autre profil", async () => {
        const result = await service.getUserById("user-2", "agent-1", Role.AGENT);

        expect(result).toEqual({ error: "FORBIDDEN" });
    });

    it("autorise un utilisateur à consulter son propre profil", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());

        const result = await service.getUserById("user-1", "user-1", Role.USER);

        expect(result).not.toHaveProperty("error");
        expect(result).toMatchObject({ id: "user-1", email: "alice@test.local" });
    });

    it("autorise un administrateur à consulter n'importe quel profil", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord({ id: "user-2" }));

        const result = await service.getUserById("user-2", "admin-1", Role.ADMIN);

        expect(result).toMatchObject({ id: "user-2" });
    });

    it("retourne NOT_FOUND quand l'utilisateur n'existe pas", async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.getUserById("absent", "admin-1", Role.ADMIN);

        expect(result).toEqual({ error: "NOT_FOUND" });
    });

    it("pagine les annonces et les favoris avec la page et la limite demandées", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());

        await service.getUserById("user-1", "user-1", Role.USER, 3, 5);

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: "user-1" },
            include: {
                annonces: { skip: 10, take: 5 },
                favoris: { skip: 10, take: 5 },
                _count: { select: { annonces: true, favoris: true } }
            }
        });
    });

    it("utilise page=1 et limit=10 par défaut", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());

        const result = await service.getUserById("user-1", "user-1", Role.USER);

        expect(prisma.user.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({
                    annonces: { skip: 0, take: 10 }
                })
            })
        );
        expect(result).toMatchObject({
            pagination: {
                annonces: { page: 1, limit: 10 },
                favoris: { page: 1, limit: 10 }
            }
        });
    });

    it("calcule la pagination à partir des compteurs", async () => {
        prisma.user.findUnique.mockResolvedValue(
            userRecord({ _count: { annonces: 25, favoris: 3 } })
        );

        const result = await service.getUserById("user-1", "user-1", Role.USER, 1, 10);

        expect(result).toMatchObject({
            pagination: {
                annonces: { page: 1, limit: 10, total: 25, pages: 3 },
                favoris: { page: 1, limit: 10, total: 3, pages: 1 }
            }
        });
    });

    it("ne retourne ni le passwordHash ni le compteur interne _count", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());

        const result = await service.getUserById("user-1", "user-1", Role.USER);

        expect(result).not.toHaveProperty("passwordHash");
        expect(result).not.toHaveProperty("_count");
    });
});

describe("userService.createUser", () => {
    const data = {
        name: "Alice",
        email: "alice@test.local",
        password: "motdepasse123"
    };

    it("retourne CONFLICT quand l'email existe déjà, sans hacher ni créer", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());

        const result = await service.createUser(data);

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: "alice@test.local" }
        });
        expect(result).toEqual({
            error: "CONFLICT",
            details: { email: ["Cet email est déjà associé à un autre compte."] }
        });
        expect(argon2.hash).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("hache le mot de passe et enregistre le hash, jamais le mot de passe en clair", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        vi.mocked(argon2.hash).mockResolvedValue("hash-argon2");
        prisma.user.create.mockResolvedValue(userRecord({ passwordHash: "hash-argon2" }));

        await service.createUser(data);

        expect(argon2.hash).toHaveBeenCalledWith("motdepasse123");
        expect(prisma.user.create).toHaveBeenCalledWith({
            data: {
                name: "Alice",
                email: "alice@test.local",
                passwordHash: "hash-argon2",
                role: Role.USER
            }
        });
    });

    it("force le rôle USER même si un rôle ADMIN est fourni (anti auto-promotion)", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        vi.mocked(argon2.hash).mockResolvedValue("hash-argon2");
        prisma.user.create.mockResolvedValue(userRecord());

        await service.createUser({ ...data, role: Role.ADMIN });

        const args = prisma.user.create.mock.calls[0][0];
        expect(args.data.role).toBe(Role.USER);
    });

    it("ne retourne pas le passwordHash", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        vi.mocked(argon2.hash).mockResolvedValue("hash-argon2");
        prisma.user.create.mockResolvedValue(userRecord({ passwordHash: "hash-argon2" }));

        const result = await service.createUser(data);

        expect(result).not.toHaveProperty("passwordHash");
        expect(result).toMatchObject({ id: "user-1", email: "alice@test.local" });
    });

    it("propage une erreur de la base", async () => {
        prisma.user.findUnique.mockRejectedValue(new Error("base indisponible"));

        await expect(service.createUser(data)).rejects.toThrow("base indisponible");
    });
});

describe("userService.updateUser", () => {

    it("refuse la modification du profil d'un autre utilisateur sans interroger la base", async () => {
        const result = await service.updateUser("user-2", "user-1", Role.USER, { name: "Pirate" } as never);

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("retourne NOT_FOUND quand le profil n'existe pas (administrateur)", async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.updateUser("absent", "admin-1", Role.ADMIN, { name: "Test" } as never);

        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("permet au propriétaire de modifier son nom et son email", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.update.mockResolvedValue(userRecord({ name: "Nouveau" }));

        const result = await service.updateUser(
            "user-1",
            "user-1",
            Role.USER,
            { name: "Nouveau", email: "nouveau@test.local" } as never
        );

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: expect.objectContaining({ name: "Nouveau", email: "nouveau@test.local" })
        });
        expect(result).toMatchObject({ name: "Nouveau" });
    });

    it("ignore le rôle envoyé par un utilisateur standard (anti auto-promotion)", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.update.mockResolvedValue(userRecord());

        await service.updateUser("user-1", "user-1", Role.USER, { role: Role.ADMIN } as never);

        const args = prisma.user.update.mock.calls[0][0];
        expect(args.data.role).toBeUndefined();
    });

    it("ignore le rôle envoyé par un agent sur son propre profil", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord({ id: "agent-1", role: Role.AGENT }));
        prisma.user.update.mockResolvedValue(userRecord({ id: "agent-1", role: Role.AGENT }));

        await service.updateUser("agent-1", "agent-1", Role.AGENT, { role: Role.ADMIN } as never);

        const args = prisma.user.update.mock.calls[0][0];
        expect(args.data.role).toBeUndefined();
    });

    it("permet à un administrateur de modifier le rôle d'un utilisateur", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.update.mockResolvedValue(userRecord({ role: Role.AGENT }));

        await service.updateUser("user-1", "admin-1", Role.ADMIN, { role: Role.AGENT } as never);

        const args = prisma.user.update.mock.calls[0][0];
        expect(args.where).toEqual({ id: "user-1" });
        expect(args.data.role).toBe(Role.AGENT);
    });

    it("ne retourne pas le passwordHash", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.update.mockResolvedValue(userRecord());

        const result = await service.updateUser("user-1", "user-1", Role.USER, { name: "Test" } as never);

        expect(result).not.toHaveProperty("passwordHash");
    });
});

describe("userService.deleteUser", () => {

    it("refuse la suppression du compte d'un autre utilisateur sans interroger la base", async () => {
        const result = await service.deleteUser("user-2", "user-1", Role.USER);

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("retourne NOT_FOUND quand le compte n'existe pas (administrateur)", async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.deleteUser("absent", "admin-1", Role.ADMIN);

        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("permet au propriétaire de supprimer son compte", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.delete.mockResolvedValue(userRecord());

        const result = await service.deleteUser("user-1", "user-1", Role.USER);

        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
        expect(result).toMatchObject({ id: "user-1" });
    });

    it("permet à un administrateur de supprimer le compte d'un autre", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord({ id: "user-2" }));
        prisma.user.delete.mockResolvedValue(userRecord({ id: "user-2" }));

        const result = await service.deleteUser("user-2", "admin-1", Role.ADMIN);

        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-2" } });
        expect(result).not.toHaveProperty("error");
    });

    it("ne retourne pas le passwordHash", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.delete.mockResolvedValue(userRecord());

        const result = await service.deleteUser("user-1", "user-1", Role.USER);

        expect(result).not.toHaveProperty("passwordHash");
    });

    it("propage une erreur de la base lors de la suppression", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        prisma.user.delete.mockRejectedValue(new Error("contrainte violée"));

        await expect(service.deleteUser("user-1", "user-1", Role.USER)).rejects.toThrow(
            "contrainte violée"
        );
    });
});