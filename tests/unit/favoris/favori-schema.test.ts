import { describe, it, expect } from "vitest";
import {
    createFavoriSchema,
    deleteFavoriSchema
} from "../../../src/modules/favoris/favori.schema.js";

// Message de la première issue d'une validation échouée.
const premierMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.error?.issues[0]?.message;

describe("createFavoriSchema", () => {

    it("accepte un annonceId non vide", () => {
        const result = createFavoriSchema.parse({ body: { annonceId: "annonce-1" } });

        expect(result.body.annonceId).toBe("annonce-1");
    });

    it("accepte un CUID (le schéma n'impose pas ce format)", () => {
        const result = createFavoriSchema.safeParse({
            body: { annonceId: "clw3f8k2a0001annonce1234567" }
        });

        expect(result.success).toBe(true);
    });

    it("refuse un annonceId vide", () => {
        const result = createFavoriSchema.safeParse({ body: { annonceId: "" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID annonce invalide");
    });

    it("refuse l'absence d'annonceId", () => {
        expect(createFavoriSchema.safeParse({ body: {} }).success).toBe(false);
    });

    it("refuse un annonceId qui n'est pas une chaîne", () => {
        expect(createFavoriSchema.safeParse({ body: { annonceId: 123 } }).success).toBe(false);
    });

    it("supprime les champs inconnus du résultat (l'utilisateur vient du JWT)", () => {
        const result = createFavoriSchema.parse({
            body: { annonceId: "annonce-1", userId: "pirate" }
        });

        expect(result.body).toEqual({ annonceId: "annonce-1" });
        expect(result.body).not.toHaveProperty("userId");
    });

    it("refuse un body absent", () => {
        expect(createFavoriSchema.safeParse({}).success).toBe(false);
    });
});

describe("deleteFavoriSchema", () => {

    it("accepte un annonceId non vide dans l'URL", () => {
        const result = deleteFavoriSchema.parse({ params: { annonceId: "annonce-1" } });

        expect(result.params.annonceId).toBe("annonce-1");
    });

    it("refuse un annonceId vide", () => {
        const result = deleteFavoriSchema.safeParse({ params: { annonceId: "" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID annonce invalide");
    });

    it("refuse l'absence d'annonceId", () => {
        expect(deleteFavoriSchema.safeParse({ params: {} }).success).toBe(false);
    });

    it("refuse des paramètres absents", () => {
        expect(deleteFavoriSchema.safeParse({}).success).toBe(false);
    });
});