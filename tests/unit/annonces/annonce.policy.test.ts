
import { describe, it, expect } from "vitest";
import { canReadAnnonce, getAnnonceWriteScope } from
    "../../../src/modules/annonces/annonce.policy.js";

const brouillon = {
    statut: "BROUILLON",
    auteurId: "agent-1"
};

describe("Politique de lecture des annonces", () => {

    it("autorise la lecture publique d'une annonce publiée", () => {
        expect(canReadAnnonce({
            ...brouillon,
            statut: "PUBLIE"
        })).toBe(true);
    });

    it("refuse un brouillon à un visiteur", () => {
        expect(canReadAnnonce(brouillon)).toBe(false);
    });

    it("autorise l'auteur de son brouillon", () => {
        expect(canReadAnnonce(brouillon, {
            id: "agent-1",
            role: "AGENT"
        })).toBe(true);
    });

    it("refuse le brouillon à un autre agent", () => {
        expect(canReadAnnonce(brouillon, {
            id: "agent-2",
            role: "AGENT"
        })).toBe(false);
    });

    it("autorise un ADMIN à consulter un brouillon", () => {
        expect(canReadAnnonce(brouillon, {
            id: "admin-1",
            role: "ADMIN"
        })).toBe(true);
    });

    it("refuse le brouillon à un USER", () => {
        expect(canReadAnnonce(brouillon, {
            id: "user-1",
            role: "USER"
        })).toBe(false);
    });
});


describe("Politique d'écriture des annonces", () => {

    it("limite un AGENT à ses propres annonces", () => {
        expect(getAnnonceWriteScope({
            id: "agent-1",
            role: "AGENT"
        })).toEqual({
            auteurId: "agent-1"
        });
    });

    it("autorise ADMIN à gérer toutes les annonces", () => {
        expect(getAnnonceWriteScope({
            id: "admin-1",
            role: "ADMIN"
        })).toEqual({});
    });

    it("refuse les opérations à USER", () => {
        expect(getAnnonceWriteScope({
            id: "user-1",
            role: "USER"
        })).toBeNull();
    });

    it("refuse les utilisateurs non authentifiés", () => {
        expect(getAnnonceWriteScope(undefined)).toBeNull();
    });

    it("refuse un identifiant utilisateur vide", () => {
        expect(getAnnonceWriteScope({
            id: "",
            role: "AGENT"
        })).toBeNull();
    });
});
