import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createAuthService } from "../../../src/modules/auth/auth.service.js";

// argon2 est simulé : les tests restent instantanés.
// jsonwebtoken est réel : on vérifie de vrais tokens (payload, signature, durée).
vi.mock("argon2", () => ({
    hash: vi.fn(),
    verify: vi.fn()
}));

// Prisma simulé : seule la recherche d'un utilisateur est utilisée.
const prisma = {
    user: {
        findUnique: vi.fn()
    }
};

const service = createAuthService(prisma as never);

const SECRET = "secret-de-test-unitaire";

// Corps de requête tel que fourni par le middleware de validation.
const credentials = (email = "alice@test.local", password = "motdepasse123") =>
    ({ body: { email, password } }) as never;

// Enregistrement tel que Prisma le renverrait (avec le hash du mot de passe).
const userRecord = (overrides: Record<string, unknown> = {}) => ({
    id: "user-1",
    name: "Alice",
    email: "alice@test.local",
    role: "USER",
    passwordHash: "hash-secret",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides
});

const secretOriginal = process.env.JWT_SECRET;

beforeEach(() => {
    vi.resetAllMocks();
    process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
    if (secretOriginal === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretOriginal;
});

describe("authService.login - identifiants invalides", () => {

    it("retourne null quand l'email n'existe pas, sans vérifier de mot de passe", async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.login(credentials("inconnu@test.local"));

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: "inconnu@test.local" }
        });
        expect(result).toBeNull();
        expect(argon2.verify).not.toHaveBeenCalled();
    });

    it("retourne null quand le mot de passe est incorrect", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        vi.mocked(argon2.verify).mockResolvedValue(false);

        const result = await service.login(credentials());

        expect(result).toBeNull();
    });

    it("retourne le même résultat pour un email inconnu et un mauvais mot de passe", async () => {
        prisma.user.findUnique.mockResolvedValueOnce(null);
        const emailInconnu = await service.login(credentials("inconnu@test.local"));

        prisma.user.findUnique.mockResolvedValueOnce(userRecord());
        vi.mocked(argon2.verify).mockResolvedValue(false);
        const motDePasse = await service.login(credentials());

        // Aucune différence observable : ne pas révéler l'existence d'un compte.
        expect(motDePasse).toEqual(emailInconnu);
    });

    it("ne signe aucun token quand l'authentification échoue", async () => {
        const signSpy = vi.spyOn(jwt, "sign");
        prisma.user.findUnique.mockResolvedValue(userRecord());
        vi.mocked(argon2.verify).mockResolvedValue(false);

        await service.login(credentials());

        expect(signSpy).not.toHaveBeenCalled();
        signSpy.mockRestore();
    });
});

describe("authService.login - connexion réussie", () => {

    beforeEach(() => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        vi.mocked(argon2.verify).mockResolvedValue(true);
    });

    it("vérifie le mot de passe saisi contre le hash enregistré", async () => {
        await service.login(credentials("alice@test.local", "motdepasse123"));

        expect(argon2.verify).toHaveBeenCalledWith("hash-secret", "motdepasse123");
    });

    it("retourne un token et l'utilisateur", async () => {
        const result = await service.login(credentials());

        expect(result).not.toBeNull();
        expect(typeof result?.token).toBe("string");
        expect(result?.token.split(".")).toHaveLength(3);
        expect(result?.user).toMatchObject({
            id: "user-1",
            name: "Alice",
            email: "alice@test.local",
            role: "USER"
        });
    });

    it("ne retourne jamais le passwordHash", async () => {
        const result = await service.login(credentials());

        expect(result?.user).not.toHaveProperty("passwordHash");
    });

    it("signe un token dont le payload contient l'id et le rôle", async () => {
        const result = await service.login(credentials());

        const payload = jwt.verify(result!.token, SECRET) as jwt.JwtPayload;

        expect(payload.id).toBe("user-1");
        expect(payload.role).toBe("USER");
    });

    it("reprend le rôle de l'utilisateur dans le token (ADMIN)", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord({ id: "admin-1", role: "ADMIN" }));

        const result = await service.login(credentials("admin@test.local"));

        const payload = jwt.verify(result!.token, SECRET) as jwt.JwtPayload;
        expect(payload.id).toBe("admin-1");
        expect(payload.role).toBe("ADMIN");
    });

    it("signe un token valable exactement 1 jour", async () => {
        const result = await service.login(credentials());

        const payload = jwt.verify(result!.token, SECRET) as jwt.JwtPayload;

        expect(payload.exp! - payload.iat!).toBe(24 * 60 * 60);
    });

    it("signe avec JWT_SECRET : un autre secret ne peut pas valider le token", async () => {
        const result = await service.login(credentials());

        expect(() => jwt.verify(result!.token, "autre-secret")).toThrow();
    });

    it("n'inclut aucune donnée sensible dans le payload du token", async () => {
        const result = await service.login(credentials());

        const payload = jwt.verify(result!.token, SECRET) as jwt.JwtPayload;

        expect(payload).not.toHaveProperty("passwordHash");
        expect(payload).not.toHaveProperty("password");
        expect(payload).not.toHaveProperty("email");
    });
});

describe("authService.login - configuration et erreurs techniques", () => {

    it("lève une erreur quand JWT_SECRET est absent (pas de secret de secours)", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        vi.mocked(argon2.verify).mockResolvedValue(true);
        delete process.env.JWT_SECRET;

        await expect(service.login(credentials())).rejects.toThrow(
            "JWT_SECRET manquant dans les variables d'environnement"
        );
    });

    it("lève une erreur quand JWT_SECRET est vide", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord());
        vi.mocked(argon2.verify).mockResolvedValue(true);
        process.env.JWT_SECRET = "";

        await expect(service.login(credentials())).rejects.toThrow("JWT_SECRET manquant");
    });

    it("ne vérifie le secret qu'après l'authentification (identifiants invalides => null)", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        delete process.env.JWT_SECRET;

        await expect(service.login(credentials())).resolves.toBeNull();
    });

    it("propage une erreur de la base", async () => {
        prisma.user.findUnique.mockRejectedValue(new Error("base indisponible"));

        await expect(service.login(credentials())).rejects.toThrow("base indisponible");
    });

    it("propage une erreur d'argon2 (hash illisible)", async () => {
        prisma.user.findUnique.mockResolvedValue(userRecord({ passwordHash: "pas-un-hash" }));
        vi.mocked(argon2.verify).mockRejectedValue(new Error("hash invalide"));

        await expect(service.login(credentials())).rejects.toThrow("hash invalide");
    });
});