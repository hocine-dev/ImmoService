import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReponseService } from "../../../src/modules/reponses/reponse.service.js";
import { Role } from "../../../src/modules/user/user.service.js";

// user.service importe argon2 : simulé pour ne pas charger le module natif.
vi.mock("argon2", () => ({
    hash: vi.fn(),
    verify: vi.fn()
}));

// Prisma simulé : seules les méthodes utilisées par le service sont déclarées.
const prisma = {
    question: { findUnique: vi.fn() },
    annonce: { findUnique: vi.fn() },
    reponse: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
    }
};

// La vraie policy canViewQuestions est utilisée : on teste le comportement observable.
const service = createReponseService(prisma as never);

const agentProprietaire = { id: "agent-1", role: Role.AGENT };
const autreAgent = { id: "agent-2", role: Role.AGENT };
const admin = { id: "admin-1", role: Role.ADMIN };
const user = { id: "user-1", role: Role.USER };

const reponseRecord = (overrides: Record<string, unknown> = {}) => ({
    id: "reponse-1",
    texte: "Oui, le logement est disponible.",
    questionId: "question-1",
    auteurId: "agent-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
});

const publiee = { auteurId: "agent-1", statut: "PUBLIE" };
const brouillon = { auteurId: "agent-1", statut: "BROUILLON" };

// Prépare la question, l'annonce et la réponse existante renvoyées par Prisma.
function mockContexte(options: { annonce?: unknown; reponse?: unknown } = {}) {
    const { annonce = publiee, reponse = null } = options;

    prisma.question.findUnique.mockResolvedValue({ annonceId: "annonce-1" });
    prisma.annonce.findUnique.mockResolvedValue(annonce);
    prisma.reponse.findUnique.mockResolvedValue(reponse);
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("reponseService.createReponse", () => {
    const data = { texte: "Oui, le logement est disponible.", questionId: "question-1" };

    it("lit l'annonce de la question puis la réponse existante", async () => {
        mockContexte();
        prisma.reponse.create.mockResolvedValue(reponseRecord());

        await service.createReponse(data, agentProprietaire);

        expect(prisma.question.findUnique).toHaveBeenCalledWith({
            where: { id: "question-1" },
            select: { annonceId: true }
        });
        expect(prisma.annonce.findUnique).toHaveBeenCalledWith({
            where: { id: "annonce-1" },
            select: { auteurId: true }
        });
        expect(prisma.reponse.findUnique).toHaveBeenCalledWith({
            where: { questionId: "question-1" },
            select: { id: true }
        });
    });

    it("retourne NOT_FOUND quand la question n'existe pas", async () => {
        prisma.question.findUnique.mockResolvedValue(null);

        const result = await service.createReponse(data, agentProprietaire);

        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.annonce.findUnique).not.toHaveBeenCalled();
        expect(prisma.reponse.create).not.toHaveBeenCalled();
    });

    it("retourne NOT_FOUND quand l'annonce de la question n'existe plus", async () => {
        prisma.question.findUnique.mockResolvedValue({ annonceId: "annonce-1" });
        prisma.annonce.findUnique.mockResolvedValue(null);

        const result = await service.createReponse(data, agentProprietaire);

        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.reponse.create).not.toHaveBeenCalled();
    });

    it.each([
        ["un autre agent", autreAgent],
        ["un utilisateur standard", user]
    ])("retourne FORBIDDEN pour %s, sans créer de réponse", async (_nom, demandeur) => {
        mockContexte();

        const result = await service.createReponse(data, demandeur);

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.reponse.findUnique).not.toHaveBeenCalled();
        expect(prisma.reponse.create).not.toHaveBeenCalled();
    });

    it.each([
        ["l'agent propriétaire de l'annonce", agentProprietaire],
        ["un administrateur qui n'est pas propriétaire", admin]
    ])("autorise %s", async (_nom, demandeur) => {
        mockContexte();
        prisma.reponse.create.mockResolvedValue(reponseRecord());

        const result = await service.createReponse(data, demandeur);

        expect(result).not.toHaveProperty("error");
        expect(prisma.reponse.create).toHaveBeenCalledTimes(1);
    });

    it("retourne CONFLICT quand la question a déjà une réponse, sans en créer une seconde", async () => {
        mockContexte({ reponse: { id: "reponse-existante" } });

        const result = await service.createReponse(data, agentProprietaire);

        expect(result).toEqual({ error: "CONFLICT" });
        expect(prisma.reponse.create).not.toHaveBeenCalled();
    });

    it("crée la réponse avec l'utilisateur authentifié comme auteur", async () => {
        const created = reponseRecord({ auteurId: "admin-1" });
        mockContexte();
        prisma.reponse.create.mockResolvedValue(created);

        const result = await service.createReponse(data, admin);

        expect(prisma.reponse.create).toHaveBeenCalledWith({
            data: {
                texte: "Oui, le logement est disponible.",
                questionId: "question-1",
                auteurId: "admin-1"
            }
        });
        expect(result).toEqual(created);
    });

    it("retourne CONFLICT quand la base signale une violation d'unicité (P2002)", async () => {
        mockContexte();
        prisma.reponse.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

        const result = await service.createReponse(data, agentProprietaire);

        expect(result).toEqual({ error: "CONFLICT" });
    });

    it("propage les autres erreurs de la base lors de la création", async () => {
        mockContexte();
        prisma.reponse.create.mockRejectedValue(Object.assign(new Error("base indisponible"), { code: "P1001" }));

        await expect(service.createReponse(data, agentProprietaire)).rejects.toThrow(
            "base indisponible"
        );
    });

    it("propage une erreur de la base lors de la lecture de la question", async () => {
        prisma.question.findUnique.mockRejectedValue(new Error("base indisponible"));

        await expect(service.createReponse(data, agentProprietaire)).rejects.toThrow(
            "base indisponible"
        );
    });
});

describe("reponseService.getReponseByQuestion", () => {

    it("retourne null quand la question n'existe pas, sans consulter l'annonce", async () => {
        prisma.question.findUnique.mockResolvedValue(null);

        const result = await service.getReponseByQuestion("absente", user);

        expect(result).toBeNull();
        expect(prisma.annonce.findUnique).not.toHaveBeenCalled();
    });

    it("retourne null quand l'annonce n'existe plus", async () => {
        prisma.question.findUnique.mockResolvedValue({ annonceId: "annonce-1" });
        prisma.annonce.findUnique.mockResolvedValue(null);

        const result = await service.getReponseByQuestion("question-1", user);

        expect(result).toBeNull();
        expect(prisma.reponse.findUnique).not.toHaveBeenCalled();
    });

    it("lit l'auteur et le statut de l'annonce pour appliquer la policy", async () => {
        mockContexte({ reponse: reponseRecord() });

        await service.getReponseByQuestion("question-1", user);

        expect(prisma.annonce.findUnique).toHaveBeenCalledWith({
            where: { id: "annonce-1" },
            select: { auteurId: true, statut: true }
        });
    });

    describe("annonce publiée", () => {

        it("retourne la réponse avec son auteur (id et nom uniquement)", async () => {
            const reponse = reponseRecord({ auteur: { id: "agent-1", name: "Agent Un" } });
            mockContexte({ reponse });

            const result = await service.getReponseByQuestion("question-1", user);

            expect(prisma.reponse.findUnique).toHaveBeenCalledWith({
                where: { questionId: "question-1" },
                include: { auteur: { select: { id: true, name: true } } }
            });
            expect(result).toEqual(reponse);
        });

        it("est accessible à un visiteur anonyme", async () => {
            mockContexte({ reponse: reponseRecord() });

            const result = await service.getReponseByQuestion("question-1", undefined);

            expect(result).not.toBeNull();
        });

        it("retourne null quand la question n'a pas de réponse", async () => {
            mockContexte({ reponse: null });

            const result = await service.getReponseByQuestion("question-1", user);

            expect(result).toBeNull();
        });
    });

    describe("annonce en brouillon", () => {

        it.each([
            ["un visiteur anonyme", undefined],
            ["un utilisateur standard", user],
            ["un agent qui n'est pas le propriétaire", autreAgent]
        ])("retourne null pour %s, sans lire la réponse", async (_nom, demandeur) => {
            mockContexte({ annonce: brouillon, reponse: reponseRecord() });

            const result = await service.getReponseByQuestion("question-1", demandeur);

            expect(result).toBeNull();
            expect(prisma.reponse.findUnique).not.toHaveBeenCalled();
        });

        it.each([
            ["l'agent propriétaire", agentProprietaire],
            ["un administrateur", admin]
        ])("autorise %s", async (_nom, demandeur) => {
            mockContexte({ annonce: brouillon, reponse: reponseRecord() });

            const result = await service.getReponseByQuestion("question-1", demandeur);

            expect(result).not.toBeNull();
        });

        it("retourne le même résultat (null) pour un accès refusé et une question inexistante", async () => {
            prisma.question.findUnique.mockResolvedValueOnce(null);
            const inexistante = await service.getReponseByQuestion("absente", user);

            mockContexte({ annonce: brouillon, reponse: reponseRecord() });
            const refusee = await service.getReponseByQuestion("question-1", user);

            expect(refusee).toEqual(inexistante);
        });
    });
});

describe("reponseService.deleteReponse", () => {

    it("retourne NOT_FOUND quand la réponse n'existe pas, sans rien supprimer", async () => {
        prisma.reponse.findUnique.mockResolvedValue(null);

        const result = await service.deleteReponse("absente", "agent-1", Role.AGENT);

        expect(prisma.reponse.findUnique).toHaveBeenCalledWith({ where: { id: "absente" } });
        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.reponse.delete).not.toHaveBeenCalled();
    });

    it("permet à l'auteur de la réponse de la supprimer", async () => {
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));
        prisma.reponse.delete.mockResolvedValue(reponseRecord());

        const result = await service.deleteReponse("reponse-1", "agent-1", Role.AGENT);

        expect(prisma.reponse.delete).toHaveBeenCalledWith({ where: { id: "reponse-1" } });
        expect(result).toEqual({ message: "Réponse supprimée avec succès" });
    });

    it("permet à un administrateur de supprimer la réponse d'un autre", async () => {
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));
        prisma.reponse.delete.mockResolvedValue(reponseRecord());

        const result = await service.deleteReponse("reponse-1", "admin-1", Role.ADMIN);

        expect(prisma.reponse.delete).toHaveBeenCalledWith({ where: { id: "reponse-1" } });
        expect(result).toEqual({ message: "Réponse supprimée avec succès" });
    });

    it.each([
        ["un autre agent", "agent-2", Role.AGENT],
        ["l'auteur de la question (utilisateur standard)", "user-1", Role.USER]
    ])("refuse la suppression par %s (IDOR)", async (_nom, userId, role) => {
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));

        const result = await service.deleteReponse("reponse-1", userId, role);

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.reponse.delete).not.toHaveBeenCalled();
    });

    it("propage une erreur de la base lors de la suppression", async () => {
        prisma.reponse.findUnique.mockResolvedValue(reponseRecord({ auteurId: "agent-1" }));
        prisma.reponse.delete.mockRejectedValue(new Error("contrainte violée"));

        await expect(
            service.deleteReponse("reponse-1", "agent-1", Role.AGENT)
        ).rejects.toThrow("contrainte violée");
    });
});