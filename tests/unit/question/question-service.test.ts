import { describe, it, expect, vi, beforeEach } from "vitest";
import { createQuestionService } from "../../../src/modules/questions/question.service.js";


// Prisma simulé : seules les méthodes utilisées par le service sont déclarées.
const prisma = {
    annonce: {
        findFirst: vi.fn(),
        findUnique: vi.fn()
    },
    question: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn()
    }
};

const service = createQuestionService(prisma as never);

const questionRecord = (overrides: Record<string, unknown> = {}) => ({
    id: "question-1",
    texte: "Le logement est-il disponible ?",
    annonceId: "annonce-1",
    auteurId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
});

beforeEach(() => {
    vi.resetAllMocks();
});

describe("questionService.createQuestion", () => {
    const data = {
        texte: "Le logement est-il disponible ?",
        annonceId: "annonce-1",
        auteurId: "user-1"
    };

    it("ne cherche que les annonces publiées", async () => {
        prisma.annonce.findFirst.mockResolvedValue({ id: "annonce-1" });
        prisma.question.create.mockResolvedValue(questionRecord());

        await service.createQuestion(data);

        expect(prisma.annonce.findFirst).toHaveBeenCalledWith({
            where: { id: "annonce-1", statut: "PUBLIE" }
        });
    });

    it("retourne null quand l'annonce est inexistante ou non publiée, sans créer de question", async () => {
        prisma.annonce.findFirst.mockResolvedValue(null);

        const result = await service.createQuestion(data);

        expect(result).toBeNull();
        expect(prisma.question.create).not.toHaveBeenCalled();
    });

    it("crée la question avec le texte, l'annonce et l'auteur fournis", async () => {
        const created = questionRecord();
        prisma.annonce.findFirst.mockResolvedValue({ id: "annonce-1" });
        prisma.question.create.mockResolvedValue(created);

        const result = await service.createQuestion(data);

        expect(prisma.question.create).toHaveBeenCalledWith({
            data: {
                texte: "Le logement est-il disponible ?",
                annonceId: "annonce-1",
                auteurId: "user-1"
            }
        });
        expect(result).toEqual(created);
    });

    it("propage une erreur de la base lors de la recherche de l'annonce", async () => {
        prisma.annonce.findFirst.mockRejectedValue(new Error("base indisponible"));

        await expect(service.createQuestion(data)).rejects.toThrow("base indisponible");
        expect(prisma.question.create).not.toHaveBeenCalled();
    });

    it("propage une erreur de la base lors de la création", async () => {
        prisma.annonce.findFirst.mockResolvedValue({ id: "annonce-1" });
        prisma.question.create.mockRejectedValue(new Error("contrainte violée"));

        await expect(service.createQuestion(data)).rejects.toThrow("contrainte violée");
    });
});

describe("questionService.getQuestionsByAnnonce", () => {
    // La vraie policy est utilisée : les tests vérifient le comportement observable.
    const publiee = { auteurId: "agent-1", statut: "PUBLIE" };
    const brouillon = { auteurId: "agent-1", statut: "BROUILLON" };

    const visiteur = undefined;
    const user = { id: "user-1", role: "USER" } as never;
    const agentProprietaire = { id: "agent-1", role: "AGENT" } as never;
    const autreAgent = { id: "agent-2", role: "AGENT" } as never;
    const admin = { id: "admin-1", role: "ADMIN" } as never;

    // Prépare les réponses de Prisma pour une annonce donnée.
    function mockAnnonce(annonce: unknown, total = 0, questions: unknown[] = []) {
        prisma.annonce.findUnique.mockResolvedValue(annonce);
        prisma.question.count.mockResolvedValue(total);
        prisma.question.findMany.mockResolvedValue(questions);
    }

    it("retourne null quand l'annonce n'existe pas, sans lire les questions", async () => {
        prisma.annonce.findUnique.mockResolvedValue(null);

        const result = await service.getQuestionsByAnnonce("absente", user);

        expect(result).toBeNull();
        expect(prisma.question.count).not.toHaveBeenCalled();
        expect(prisma.question.findMany).not.toHaveBeenCalled();
    });

    it("lit uniquement l'auteur et le statut de l'annonce", async () => {
        mockAnnonce(publiee);

        await service.getQuestionsByAnnonce("annonce-1", user);

        expect(prisma.annonce.findUnique).toHaveBeenCalledWith({
            where: { id: "annonce-1" },
            select: { auteurId: true, statut: true }
        });
    });

    describe("annonce publiée", () => {

        it("autorise un visiteur anonyme", async () => {
            mockAnnonce(publiee);

            const result = await service.getQuestionsByAnnonce("annonce-1", visiteur);

            expect(result).not.toBeNull();
            expect(prisma.question.findMany).toHaveBeenCalled();
        });

        it("autorise un utilisateur standard", async () => {
            mockAnnonce(publiee);

            const result = await service.getQuestionsByAnnonce("annonce-1", user);

            expect(result).not.toBeNull();
        });
    });

    describe("annonce en brouillon", () => {

        it.each([
            ["un visiteur anonyme", visiteur],
            ["un utilisateur standard", user],
            ["un agent qui n'est pas le propriétaire", autreAgent]
        ])("retourne null pour %s, sans lire les questions", async (_nom, demandeur) => {
            mockAnnonce(brouillon);

            const result = await service.getQuestionsByAnnonce("annonce-1", demandeur);

            expect(result).toBeNull();
            expect(prisma.question.count).not.toHaveBeenCalled();
            expect(prisma.question.findMany).not.toHaveBeenCalled();
        });

        it.each([
            ["l'agent propriétaire", agentProprietaire],
            ["un administrateur", admin]
        ])("autorise %s", async (_nom, demandeur) => {
            mockAnnonce(brouillon);

            const result = await service.getQuestionsByAnnonce("annonce-1", demandeur);

            expect(result).not.toBeNull();
        });
    });

    it("retourne le même résultat (null) pour une annonce inexistante et un brouillon refusé", async () => {
        prisma.annonce.findUnique.mockResolvedValueOnce(null);
        const inexistante = await service.getQuestionsByAnnonce("absente", user);

        prisma.annonce.findUnique.mockResolvedValueOnce(brouillon);
        const refusee = await service.getQuestionsByAnnonce("brouillon", user);

        expect(refusee).toEqual(inexistante);
    });

    it("lit la page demandée, de la plus récente à la plus ancienne, avec l'auteur et la réponse", async () => {
        mockAnnonce(publiee, 25);

        await service.getQuestionsByAnnonce("annonce-1", user, 2, 10);

        expect(prisma.question.count).toHaveBeenCalledWith({ where: { annonceId: "annonce-1" } });
        expect(prisma.question.findMany).toHaveBeenCalledWith({
            where: { annonceId: "annonce-1" },
            skip: 10,
            take: 10,
            include: {
                auteur: { select: { id: true, name: true } },
                reponse: true
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }]
        });
    });

    it("n'expose de l'auteur que son id et son nom", async () => {
        mockAnnonce(publiee);

        await service.getQuestionsByAnnonce("annonce-1", user);

        const args = prisma.question.findMany.mock.calls[0][0];
        expect(Object.keys(args.include.auteur.select).sort()).toEqual(["id", "name"]);
    });

    it("utilise page=1 et limit=10 par défaut", async () => {
        mockAnnonce(publiee, 3);

        const result = await service.getQuestionsByAnnonce("annonce-1", user);

        const args = prisma.question.findMany.mock.calls[0][0];
        expect(args.skip).toBe(0);
        expect(args.take).toBe(10);
        expect(result?.pagination).toEqual({ page: 1, limit: 10, total: 3, pages: 1 });
    });

    it("retourne les questions et calcule la pagination", async () => {
        const questions = [questionRecord({ id: "q1" }), questionRecord({ id: "q2" })];
        mockAnnonce(publiee, 25, questions);

        const result = await service.getQuestionsByAnnonce("annonce-1", user, 2, 10);

        expect(result).toEqual({
            data: questions,
            pagination: { page: 2, limit: 10, total: 25, pages: 3 }
        });
    });

    it("retourne 0 page quand l'annonce n'a aucune question", async () => {
        mockAnnonce(publiee, 0);

        const result = await service.getQuestionsByAnnonce("annonce-1", user);

        expect(result?.data).toEqual([]);
        expect(result?.pagination).toEqual({ page: 1, limit: 10, total: 0, pages: 0 });
    });

    it("arrondit le nombre de pages à l'entier supérieur", async () => {
        mockAnnonce(publiee, 21);

        const result = await service.getQuestionsByAnnonce("annonce-1", user, 1, 10);

        expect(result?.pagination.pages).toBe(3);
    });
});

describe("questionService.deleteQuestion", () => {

    it("retourne NOT_FOUND quand la question n'existe pas, sans rien supprimer", async () => {
        prisma.question.findUnique.mockResolvedValue(null);

        const result = await service.deleteQuestion("absente", "user-1", "USER");

        expect(prisma.question.findUnique).toHaveBeenCalledWith({ where: { id: "absente" } });
        expect(result).toEqual({ error: "NOT_FOUND" });
        expect(prisma.question.delete).not.toHaveBeenCalled();
    });

    it("permet à l'auteur de supprimer sa question", async () => {
        prisma.question.findUnique.mockResolvedValue(questionRecord({ auteurId: "user-1" }));
        prisma.question.delete.mockResolvedValue(questionRecord());

        const result = await service.deleteQuestion("question-1", "user-1", "USER");

        expect(prisma.question.delete).toHaveBeenCalledWith({ where: { id: "question-1" } });
        expect(result).toEqual({ message: "Question supprimée avec succès" });
    });

    it("permet à un administrateur de supprimer la question d'un autre", async () => {
        prisma.question.findUnique.mockResolvedValue(questionRecord({ auteurId: "user-1" }));
        prisma.question.delete.mockResolvedValue(questionRecord());

        const result = await service.deleteQuestion("question-1", "admin-1", "ADMIN");

        expect(prisma.question.delete).toHaveBeenCalledWith({ where: { id: "question-1" } });
        expect(result).toEqual({ message: "Question supprimée avec succès" });
    });

    it("refuse la suppression par un autre utilisateur (IDOR)", async () => {
        prisma.question.findUnique.mockResolvedValue(questionRecord({ auteurId: "user-1" }));

        const result = await service.deleteQuestion("question-1", "user-2", "USER");

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.question.delete).not.toHaveBeenCalled();
    });

    it("refuse la suppression par un agent qui n'est pas l'auteur", async () => {
        prisma.question.findUnique.mockResolvedValue(questionRecord({ auteurId: "user-1" }));

        const result = await service.deleteQuestion("question-1", "agent-1", "AGENT");

        expect(result).toEqual({ error: "FORBIDDEN" });
        expect(prisma.question.delete).not.toHaveBeenCalled();
    });

    it("propage une erreur de la base lors de la suppression", async () => {
        prisma.question.findUnique.mockResolvedValue(questionRecord({ auteurId: "user-1" }));
        prisma.question.delete.mockRejectedValue(new Error("contrainte violée"));

        await expect(
            service.deleteQuestion("question-1", "user-1", "USER")
        ).rejects.toThrow("contrainte violée");
    });
});