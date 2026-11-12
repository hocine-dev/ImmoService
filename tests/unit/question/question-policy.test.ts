import { describe, it, expect } from "vitest";
import { canViewQuestions } from "../../../src/modules/questions/question.policy.js";

/**
 * Règles décrites dans openapi.yaml (GET /questions/annonce/{annonceId}) :
 * - annonce publiée : accès public, JWT facultatif ;
 * - brouillon : réservé à l'ADMIN ou à l'AGENT propriétaire de l'annonce.
 *
 * Signature utilisée par le service : canViewQuestions(annonce, user?).
 */
const publiee = { auteurId: "agent-1", statut: "PUBLIE" } as never;
const brouillon = { auteurId: "agent-1", statut: "BROUILLON" } as never;

const user = (id: string, role: string) => ({ id, role }) as never;

describe("canViewQuestions - annonce publiée", () => {

    it("autorise un visiteur anonyme", () => {
        expect(canViewQuestions(publiee, undefined)).toBe(true);
    });

    it.each(["USER", "AGENT", "ADMIN"])("autorise un utilisateur de rôle %s", (role) => {
        expect(canViewQuestions(publiee, user("quelquun", role))).toBe(true);
    });
});

describe("canViewQuestions - brouillon", () => {

    it("refuse un visiteur anonyme", () => {
        expect(canViewQuestions(brouillon, undefined)).toBe(false);
    });

    it("refuse un utilisateur standard", () => {
        expect(canViewQuestions(brouillon, user("user-1", "USER"))).toBe(false);
    });

    it("refuse un agent qui n'est pas le propriétaire", () => {
        expect(canViewQuestions(brouillon, user("agent-2", "AGENT"))).toBe(false);
    });

    it("autorise l'agent propriétaire", () => {
        expect(canViewQuestions(brouillon, user("agent-1", "AGENT"))).toBe(true);
    });

    it("autorise un administrateur, même s'il n'est pas le propriétaire", () => {
        expect(canViewQuestions(brouillon, user("admin-1", "ADMIN"))).toBe(true);
    });
});