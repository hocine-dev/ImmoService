import { describe, it, expect } from "vitest";
import {
    createUserSchema,
    getUserByIdSchema,
    getUsersSchema,
    updateUserSchema
} from "../../../src/modules/user/user.schema.js";

// CUID valide (le schéma utilise z.string().cuid()).
const ID_VALIDE = "clw3f8k2a0000qwerty1234567";

// Message de la première issue d'une validation échouée.
const premierMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.error?.issues[0]?.message;

describe("getUsersSchema", () => {

    it("applique page=1 et limit=10 par défaut", () => {
        const result = getUsersSchema.parse({ query: {} });

        expect(result.query).toEqual({ page: 1, limit: 10 });
    });

    it("convertit les chaînes en nombres (query string)", () => {
        const result = getUsersSchema.parse({ query: { page: "2", limit: "50" } });

        expect(result.query).toEqual({ page: 2, limit: 50 });
    });

    it("accepte les bornes (page 1 et 10000, limit 1 et 100)", () => {
        expect(getUsersSchema.safeParse({ query: { page: 1, limit: 1 } }).success).toBe(true);
        expect(getUsersSchema.safeParse({ query: { page: 10000, limit: 100 } }).success).toBe(true);
    });

    it.each([
        ["page = 0", { page: 0 }],
        ["page > 10000", { page: 10001 }],
        ["page négative", { page: -1 }],
        ["page décimale", { page: 1.5 }],
        ["page non numérique", { page: "abc" }],
        ["limit = 0", { limit: 0 }],
        ["limit > 100", { limit: 101 }],
        ["limit décimale", { limit: 2.5 }],
        ["limit non numérique", { limit: "xyz" }]
    ])("refuse %s", (_nom, query) => {
        expect(getUsersSchema.safeParse({ query }).success).toBe(false);
    });
});

describe("createUserSchema", () => {
    const valide = {
        name: "Alice Martin",
        email: "alice@example.com",
        password: "motdepasse123"
    };

    it("accepte des données valides", () => {
        const result = createUserSchema.safeParse({ body: valide });

        expect(result.success).toBe(true);
    });

    it("retire les espaces autour du nom", () => {
        const result = createUserSchema.parse({ body: { ...valide, name: "  Alice  " } });

        expect(result.body.name).toBe("Alice");
    });

    it("refuse un nom de moins de 2 caractères", () => {
        const result = createUserSchema.safeParse({ body: { ...valide, name: "A" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("Le nom doit contenir au moins 2 caractères");
    });

    it("refuse un nom trop court une fois les espaces retirés", () => {
        const result = createUserSchema.safeParse({ body: { ...valide, name: "  A  " } });

        expect(result.success).toBe(false);
    });

    it("refuse un email invalide", () => {
        const result = createUserSchema.safeParse({ body: { ...valide, email: "pas-un-email" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("Format d'email invalide");
    });

    it("refuse un mot de passe de moins de 6 caractères", () => {
        const result = createUserSchema.safeParse({ body: { ...valide, password: "12345" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe(
            "Le mot de passe doit contenir au moins 6 caractères"
        );
    });

    it("accepte un mot de passe de exactement 6 caractères", () => {
        const result = createUserSchema.safeParse({ body: { ...valide, password: "123456" } });

        expect(result.success).toBe(true);
    });

    it.each(["name", "email", "password"])("refuse l'absence du champ %s", (champ) => {
        const body: Record<string, unknown> = { ...valide };
        delete body[champ];

        expect(createUserSchema.safeParse({ body }).success).toBe(false);
    });

    it("accepte un rôle valide (le service le force ensuite à USER)", () => {
        for (const role of ["USER", "AGENT", "ADMIN"]) {
            expect(createUserSchema.safeParse({ body: { ...valide, role } }).success).toBe(true);
        }
    });

    it("refuse un rôle inconnu", () => {
        const result = createUserSchema.safeParse({ body: { ...valide, role: "SUPERADMIN" } });

        expect(result.success).toBe(false);
    });

    it("refuse un body absent", () => {
        expect(createUserSchema.safeParse({}).success).toBe(false);
    });
});

describe("updateUserSchema", () => {

    it("accepte un body vide (tous les champs sont facultatifs)", () => {
        const result = updateUserSchema.safeParse({ body: {}, params: { id: ID_VALIDE } });

        expect(result.success).toBe(true);
    });

    it("accepte une mise à jour partielle", () => {
        const result = updateUserSchema.parse({
            body: { name: "Nouveau Nom" },
            params: { id: ID_VALIDE }
        });

        expect(result.body).toEqual({ name: "Nouveau Nom" });
    });

    it("retire les espaces autour du nom", () => {
        const result = updateUserSchema.parse({
            body: { name: "  Alice  " },
            params: { id: ID_VALIDE }
        });

        expect(result.body.name).toBe("Alice");
    });

    it("ignore les champs inconnus (ils sont supprimés du résultat)", () => {
        const result = updateUserSchema.parse({
            body: { name: "Alice", passwordHash: "pirate" },
            params: { id: ID_VALIDE }
        });

        expect(result.body).not.toHaveProperty("passwordHash");
    });

    it.each([
        ["nom trop court", { name: "A" }],
        ["email invalide", { email: "pas-un-email" }],
        ["rôle inconnu", { role: "SUPERADMIN" }]
    ])("refuse %s", (_nom, body) => {
        const result = updateUserSchema.safeParse({ body, params: { id: ID_VALIDE } });

        expect(result.success).toBe(false);
    });

    it("refuse un identifiant qui n'est pas un CUID", () => {
        const result = updateUserSchema.safeParse({
            body: {},
            params: { id: "pas-un-cuid" }
        });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID utilisateur invalide");
    });

    it("refuse l'absence d'identifiant", () => {
        expect(updateUserSchema.safeParse({ body: {}, params: {} }).success).toBe(false);
    });
});

describe("getUserByIdSchema", () => {

    it("accepte un CUID et applique la pagination par défaut", () => {
        const result = getUserByIdSchema.parse({
            query: {},
            params: { id: ID_VALIDE }
        });

        expect(result.params.id).toBe(ID_VALIDE);
        expect(result.query).toEqual({ page: 1, limit: 10 });
    });

    it("convertit les paramètres de pagination", () => {
        const result = getUserByIdSchema.parse({
            query: { page: "3", limit: "5" },
            params: { id: ID_VALIDE }
        });

        expect(result.query).toEqual({ page: 3, limit: 5 });
    });

    it("refuse un identifiant invalide", () => {
        const result = getUserByIdSchema.safeParse({
            query: {},
            params: { id: "pas-un-cuid" }
        });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID utilisateur invalide");
    });

    it("refuse une pagination invalide", () => {
        const result = getUserByIdSchema.safeParse({
            query: { limit: 1000 },
            params: { id: ID_VALIDE }
        });

        expect(result.success).toBe(false);
    });
});