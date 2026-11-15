import { describe, it, expect } from "vitest";
import {
    createReponseSchema,
    deleteReponseSchema,
    getReponseByQuestionSchema
} from "../../../src/modules/reponses/reponse.schema.js";

// CUID valide (le schéma utilise z.string().cuid()).
const ID_VALIDE = "clw3f8k2a0000qwerty1234567";

// Message de la première issue d'une validation échouée.
const premierMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.error?.issues[0]?.message;

describe("createReponseSchema", () => {
    const valide = { texte: "Oui, le logement est disponible.", questionId: ID_VALIDE };

    it("accepte des données valides", () => {
        const result = createReponseSchema.safeParse({ body: valide });

        expect(result.success).toBe(true);
    });

    it("retire les espaces autour du texte", () => {
        const result = createReponseSchema.parse({
            body: { ...valide, texte: "   Bonjour   " }
        });

        expect(result.body.texte).toBe("Bonjour");
    });

    it("refuse un texte vide", () => {
        const result = createReponseSchema.safeParse({ body: { ...valide, texte: "" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("Le texte de la réponse est obligatoire");
    });

    it("refuse un texte composé uniquement d'espaces", () => {
        const result = createReponseSchema.safeParse({ body: { ...valide, texte: "     " } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("Le texte de la réponse est obligatoire");
    });

    it("refuse l'absence de texte", () => {
        const result = createReponseSchema.safeParse({ body: { questionId: ID_VALIDE } });

        expect(result.success).toBe(false);
    });

    it("refuse un questionId qui n'est pas un CUID", () => {
        const result = createReponseSchema.safeParse({
            body: { ...valide, questionId: "pas-un-cuid" }
        });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID question invalide");
    });

    it("refuse l'absence de questionId", () => {
        const result = createReponseSchema.safeParse({ body: { texte: "Bonjour" } });

        expect(result.success).toBe(false);
    });

    it("refuse un champ inconnu (l'auteur vient du JWT, jamais du body)", () => {
        const result = createReponseSchema.safeParse({
            body: { ...valide, auteurId: "cm0000000000000000000000x" }
        });

        expect(result.success).toBe(false);
    });

    it("refuse un body vide", () => {
        expect(createReponseSchema.safeParse({ body: {} }).success).toBe(false);
    });

    it("refuse un body absent", () => {
        expect(createReponseSchema.safeParse({}).success).toBe(false);
    });
});

describe("getReponseByQuestionSchema", () => {

    it("accepte un questionId CUID", () => {
        const result = getReponseByQuestionSchema.parse({ params: { questionId: ID_VALIDE } });

        expect(result.params.questionId).toBe(ID_VALIDE);
    });

    it("refuse un questionId qui n'est pas un CUID", () => {
        const result = getReponseByQuestionSchema.safeParse({
            params: { questionId: "pas-un-cuid" }
        });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID question invalide");
    });

    it("refuse l'absence de questionId", () => {
        expect(getReponseByQuestionSchema.safeParse({ params: {} }).success).toBe(false);
    });
});

describe("deleteReponseSchema", () => {

    it("accepte un identifiant CUID", () => {
        const result = deleteReponseSchema.parse({ params: { id: ID_VALIDE } });

        expect(result.params.id).toBe(ID_VALIDE);
    });

    it("refuse un identifiant qui n'est pas un CUID", () => {
        const result = deleteReponseSchema.safeParse({ params: { id: "pas-un-cuid" } });

        expect(result.success).toBe(false);
        expect(premierMessage(result as never)).toBe("ID réponse invalide");
    });

    it("refuse l'absence d'identifiant", () => {
        expect(deleteReponseSchema.safeParse({ params: {} }).success).toBe(false);
    });
});