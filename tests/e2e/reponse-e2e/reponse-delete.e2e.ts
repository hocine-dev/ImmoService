import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AnnoncesApi, AuthApi, Configuration, QuestionsApi } from "../../../sdk/index.js";

const baseUrl = "http://localhost:3002";

// En-tête Authorization envoyé explicitement : fonctionne que
// `securitySchemes` soit déclaré ou non dans openapi.yaml.
const config = (token?: string) =>
    new Configuration({
        basePath: baseUrl,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

const questionsApi = (token?: string) => new QuestionsApi(config(token));
const annoncesApi = (token?: string) => new AnnoncesApi(config(token));
const authApi = new AuthApi(new Configuration({ basePath: baseUrl }));

type Session = { token: string; userId: string };

async function login(email: string | undefined, password: string | undefined): Promise<Session> {
    const response = await authApi.login({
        loginInput: { email: email as string, password: password as string }
    });

    expect(response.data.token).toBeTruthy();
    return { token: response.data.token, userId: response.data.user.id! };
}

// Un seul login par rôle et par fichier : évite le slow-down / rate limit.
const cache = new Map<string, Promise<Session>>();

function session(role: string, email?: string, password?: string) {
    if (!cache.has(role)) cache.set(role, login(email, password));
    return cache.get(role)!;
}

const getUserSession = () =>
    session("user", process.env.SEED_USER_1_EMAIL, process.env.SEED_USER_1_PASSWORD);

const getAgentSession = () =>
    session("agent", process.env.SEED_AGENT_1_EMAIL, process.env.SEED_AGENT_1_PASSWORD);

const getAgent2Session = () =>
    session("agent2", process.env.SEED_AGENT_2_EMAIL, process.env.SEED_AGENT_2_PASSWORD);

const getAdminSession = () =>
    session("admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);

const annonceBase = {
    titre: "Annonce pour test suppression de réponses",
    description: "Annonce créée par les tests E2E, supprimée en fin de test",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
} as const;

// Crée une annonce (statut BROUILLON) ; en cas d'échec, remonte le statut et
// le corps de la réponse pour faciliter le diagnostic.
async function createBrouillon(token: string, titre: string) {
    try {
        const response = await annoncesApi(token).createAnnonceRaw({
            createAnnonceInput: { ...annonceBase, titre }
        });

        expect(response.raw.status).toBe(201);

        const annonce = await response.value();
        expect(annonce.statut).toBe("BROUILLON");

        return annonce.id;
    } catch (e) {
        const response = (e as { response?: Response }).response;
        if (!response) throw e;

        const corps = await response.text();
        throw new Error(
            `Création de l'annonce refusée (HTTP ${response.status}) : ${corps}`
        );
    }
}

// PATCH /annonces/{id}/statut : fetch brut, le corps de la requête est défini en ligne
// dans la spec (pas de schéma nommé donc pas de nom de paramètre SDK garanti).
async function changeStatut(token: string, id: string, statut: "PUBLIE" | "BROUILLON") {
    const response = await annoncesApi(token).changeStatutAnnonceRaw({
                id: id,
                changeStatutAnnonceRequest: {
                    statut
                }
            });

    expect(response.raw.status).toBe(200);
}

// Suppression : par cascade, elle supprime aussi les questions et les réponses.
async function deleteAnnonce(token: string, id: string) {
    await annoncesApi(token).deleteAnnonceRaw({ id }).catch(() => undefined);
}

// POST /reponses/create : fetch brut (les routes /reponses ne sont pas dans le SDK).
// Retourne l'identifiant de la réponse créée.
async function createReponse(token: string, questionId: string, texte: string) {
    const response = await fetch(`${baseUrl}/reponses/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ texte, questionId })
    });

    const body = await response.json();
    expect(response.status, `Création de la réponse refusée : ${JSON.stringify(body)}`).toBe(201);

    return body.data.id as string;
}

// GET /reponses/question/:questionId : fetch brut.
function getReponse(token: string | undefined, questionId: string) {
    return fetch(`${baseUrl}/reponses/question/${questionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
}

// DELETE /reponses/:id : fetch brut.
function deleteReponse(token: string | undefined, id: string) {
    return fetch(`${baseUrl}/reponses/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
}

// Vérifie le statut et le code d'erreur d'une réponse HTTP.
async function expectError(response: Response, status: number, code?: string) {
    expect(response.status).toBe(status);

    if (!code) return undefined;

    const body = await response.json();
    expect(body.error.code).toBe(code);
    return body;
}

const uniqueTexte = (prefix = "Réponse E2E") => `${prefix} ${Date.now()}`;

const REPONSE_INEXISTANTE = "cm0000000000000000000000x";

describe("DELETE /reponses/:id - Tests E2E", () => {
    let annonceId: string;
    let agentToken: string;

    // Réponse partagée par les tests de refus (aucun ne la supprime).
    let reponseProtegee: { questionId: string; reponseId: string };

    // Pose une question (utilisateur 1) puis y répond (agent 1, propriétaire de l'annonce).
    async function questionRepondue(prefix = "Question à traiter") {
        const user = await getUserSession();
        const agent = await getAgentSession();

        const question = await questionsApi(user.token).createQuestion({
            createQuestionInput: { texte: `${prefix} ${Date.now()}`, annonceId }
        });
        const questionId = question.data!.id!;

        const reponseId = await createReponse(agent.token, questionId, uniqueTexte());

        return { questionId, reponseId };
    }

    // Vérifie si la réponse d'une question existe encore (lecture par l'agent propriétaire).
    async function reponseExiste(questionId: string) {
        const agent = await getAgentSession();
        const response = await getReponse(agent.token, questionId);

        return response.status === 200;
    }

    // Annonce publiée par l'agent 1, avec une réponse protégée.
    beforeAll(async () => {
        const agent = await getAgentSession();
        agentToken = agent.token;

        annonceId = await createBrouillon(agent.token, `Réponses suppression ${Date.now()}`);
        await changeStatut(agent.token, annonceId, "PUBLIE");

        reponseProtegee = await questionRepondue("Question protégée");
    });

    // Nettoyage : la suppression de l'annonce emporte aussi questions et réponses.
    afterAll(async () => {
        if (annonceId) await deleteAnnonce(agentToken, annonceId);
    });

    describe("suppression autorisée", () => {

        it("permet à l'auteur de la réponse de la supprimer", async () => {
            const agent = await getAgentSession();
            const { questionId, reponseId } = await questionRepondue();

            expect(await reponseExiste(questionId)).toBe(true);

            const response = await deleteReponse(agent.token, reponseId);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.status).toBe("success");
            expect(body.message).toBeTruthy();

            // La réponse a disparu.
            expect(await reponseExiste(questionId)).toBe(false);
        });

        it("permet à un administrateur de supprimer la réponse d'un autre", async () => {
            const admin = await getAdminSession();
            const { questionId, reponseId } = await questionRepondue();

            const response = await deleteReponse(admin.token, reponseId);

            expect(response.status).toBe(200);
            expect(await reponseExiste(questionId)).toBe(false);
        });

        it("conserve la question quand sa réponse est supprimée", async () => {
            const agent = await getAgentSession();
            const { questionId, reponseId } = await questionRepondue();

            const response = await deleteReponse(agent.token, reponseId);
            expect(response.status).toBe(200);

            const liste = await questionsApi().listQuestionsByAnnonce({ annonceId, limit: 100 });
            const question = liste.data.find((q) => q.id === questionId);

            expect(question, "la question doit toujours exister").toBeDefined();
            expect(question!.reponse).toBeNull();
        });

        it("permet de répondre à nouveau après la suppression", async () => {
            const agent = await getAgentSession();
            const { questionId, reponseId } = await questionRepondue();

            const suppression = await deleteReponse(agent.token, reponseId);
            expect(suppression.status).toBe(200);

            // La contrainte « une réponse par question » est libérée.
            const nouvelleId = await createReponse(agent.token, questionId, uniqueTexte("Nouvelle"));

            expect(nouvelleId).not.toBe(reponseId);
            expect(await reponseExiste(questionId)).toBe(true);
        });

        it("retourne 404 quand on supprime deux fois la même réponse", async () => {
            const agent = await getAgentSession();
            const { reponseId } = await questionRepondue();

            const premiere = await deleteReponse(agent.token, reponseId);
            expect(premiere.status).toBe(200);

            const seconde = await deleteReponse(agent.token, reponseId);
            await expectError(seconde, 404, "NOT_FOUND");
        });
    });

    describe("suppression refusée", () => {

        it("refuse un autre agent (pas l'auteur de la réponse)", async () => {
            const agent2 = await getAgent2Session();

            const response = await deleteReponse(agent2.token, reponseProtegee.reponseId);

            await expectError(response, 403, "FORBIDDEN");
            expect(await reponseExiste(reponseProtegee.questionId)).toBe(true);
        });

        it("refuse un utilisateur standard", async () => {
            const user2 = await session(
                "user2",
                process.env.SEED_USER_2_EMAIL,
                process.env.SEED_USER_2_PASSWORD
            );

            const response = await deleteReponse(user2.token, reponseProtegee.reponseId);

            await expectError(response, 403, "FORBIDDEN");
            expect(await reponseExiste(reponseProtegee.questionId)).toBe(true);
        });

        it("refuse l'auteur de la question (il n'est pas l'auteur de la réponse)", async () => {
            const user = await getUserSession();

            const response = await deleteReponse(user.token, reponseProtegee.reponseId);

            await expectError(response, 403, "FORBIDDEN");
            expect(await reponseExiste(reponseProtegee.questionId)).toBe(true);
        });

        it("refuse la suppression sans authentification", async () => {
            const response = await deleteReponse(undefined, reponseProtegee.reponseId);

            await expectError(response, 401);
            expect(await reponseExiste(reponseProtegee.questionId)).toBe(true);
        });

        it("refuse un token invalide", async () => {
            const response = await deleteReponse("token.invalide.xyz", reponseProtegee.reponseId);

            await expectError(response, 401);
        });
    });

    describe("identifiant invalide", () => {

        it("retourne 404 pour une réponse inexistante", async () => {
            const admin = await getAdminSession();

            const response = await deleteReponse(admin.token, REPONSE_INEXISTANTE);

            await expectError(response, 404, "NOT_FOUND");
        });

        it("retourne 400 pour un identifiant qui n'est pas un CUID", async () => {
            const admin = await getAdminSession();

            const response = await deleteReponse(admin.token, "pas-un-cuid");

            await expectError(response, 400, "VALIDATION_ERROR");
        });
    });
});