import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    AnnoncesApi,
    AuthApi,
    Configuration,
    QuestionsApi
} from "../../sdk/index.js";

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

const getUser2Session = () =>
    session("user2", process.env.SEED_USER_2_EMAIL, process.env.SEED_USER_2_PASSWORD);

const getAgentSession = () =>
    session("agent", process.env.SEED_AGENT_1_EMAIL, process.env.SEED_AGENT_1_PASSWORD);

const getAdminSession = () =>
    session("admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);

async function expectApiError(promise: Promise<unknown>, status: number, code?: string) {
    const error = (await promise.then(() => null, (e: unknown) => e)) as
        { response: Response } | null;

    expect(error, "la requête aurait dû être rejetée").not.toBeNull();
    expect(error!.response.status).toBe(status);

    if (!code) return undefined;

    const body = await error!.response.json();
    expect(body.error.code).toBe(code);
    return body;
}

const annonceBase = {
    titre: "Annonce pour test suppression de questions",
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
    const response = await fetch(`${baseUrl}/annonces/${id}/statut`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ statut })
    });

    expect(
        response.status,
        `Changement de statut vers ${statut} refusé : ${await response.clone().text()}`
    ).toBe(200);
}

// Suppression : par cascade, elle supprime aussi les questions de l'annonce.
async function deleteAnnonce(token: string, id: string) {
    await annoncesApi(token).deleteAnnonceRaw({ id }).catch(() => undefined);
}

const QUESTION_INEXISTANTE = "cm0000000000000000000000x";

describe("DELETE /questions/:id - Tests E2E", () => {
    let annonceId: string;
    let agentToken: string;

    // Question partagée par les tests de contrôle d'accès (aucun ne la supprime).
    let questionProtegee: string;

    // Crée une question avec le compte donné et retourne son identifiant.
    async function createQuestion(token: string, prefix = "Question à supprimer") {
        const response = await questionsApi(token).createQuestionRaw({
            createQuestionInput: { texte: `${prefix} ${Date.now()}`, annonceId }
        });

        expect(response.raw.status).toBe(201);

        const body = await response.value();
        return body.data!.id!;
    }

    // Vérifie la présence d'une question dans la liste publique de l'annonce.
    async function questionExiste(id: string) {
        const liste = await questionsApi().listQuestionsByAnnonce({
            annonceId,
            limit: 100
        });

        return liste.data.some((q) => q.id === id);
    }

    // Annonce publiée par l'agent 1, avec une question protégée posée par l'utilisateur 1.
    beforeAll(async () => {
        const agent = await getAgentSession();
        const user = await getUserSession();
        agentToken = agent.token;

        annonceId = await createBrouillon(agent.token, `Suppression questions ${Date.now()}`);
        await changeStatut(agent.token, annonceId, "PUBLIE");

        questionProtegee = await createQuestion(user.token, "Question protégée");
    });

    // Nettoyage : la suppression de l'annonce emporte aussi les questions restantes.
    afterAll(async () => {
        if (annonceId) await deleteAnnonce(agentToken, annonceId);
    });

    describe("suppression autorisée", () => {

        it("permet à l'auteur de supprimer sa question", async () => {
            const user = await getUserSession();
            const id = await createQuestion(user.token);

            expect(await questionExiste(id)).toBe(true);

            const response = await questionsApi(user.token).deleteQuestionRaw({ id });
            const body = await response.value();

            expect(response.raw.status).toBe(200);
            expect(body.status).toBe("success");
            expect(body.message).toBeTruthy();

            // La question a disparu de la liste publique.
            expect(await questionExiste(id)).toBe(false);
        });

        it("retourne 404 si on supprime deux fois la même question", async () => {
            const user = await getUserSession();
            const id = await createQuestion(user.token);

            const premiere = await questionsApi(user.token).deleteQuestionRaw({ id });
            expect(premiere.raw.status).toBe(200);

            await expectApiError(
                questionsApi(user.token).deleteQuestion({ id }),
                404,
                "NOT_FOUND"
            );
        });

        it("permet à un administrateur de supprimer la question d'un autre", async () => {
            const user = await getUserSession();
            const admin = await getAdminSession();
            const id = await createQuestion(user.token);

            const response = await questionsApi(admin.token).deleteQuestionRaw({ id });

            expect(response.raw.status).toBe(200);
            expect(await questionExiste(id)).toBe(false);
        });
    });

    describe("suppression refusée", () => {

        it("refuse la suppression par un autre utilisateur (IDOR)", async () => {
            const user2 = await getUser2Session();

            await expectApiError(
                questionsApi(user2.token).deleteQuestion({ id: questionProtegee }),
                403,
                "FORBIDDEN"
            );

            // La question doit toujours exister.
            expect(await questionExiste(questionProtegee)).toBe(true);
        });

        it("refuse la suppression par l'agent propriétaire de l'annonce (réservé à l'auteur et à l'admin)", async () => {
            const agent = await getAgentSession();

            await expectApiError(
                questionsApi(agent.token).deleteQuestion({ id: questionProtegee }),
                403,
                "FORBIDDEN"
            );

            expect(await questionExiste(questionProtegee)).toBe(true);
        });

        it("refuse la suppression sans authentification", async () => {
            await expectApiError(
                questionsApi().deleteQuestion({ id: questionProtegee }),
                401
            );

            expect(await questionExiste(questionProtegee)).toBe(true);
        });

        it("refuse un token invalide", async () => {
            await expectApiError(
                questionsApi("token.invalide.xyz").deleteQuestion({ id: questionProtegee }),
                401
            );
        });
    });

    describe("question inexistante", () => {

        it("retourne 404 pour une question inexistante (utilisateur)", async () => {
            const user = await getUserSession();

            await expectApiError(
                questionsApi(user.token).deleteQuestion({ id: QUESTION_INEXISTANTE }),
                404,
                "NOT_FOUND"
            );
        });

        it("retourne 404 pour une question inexistante (administrateur)", async () => {
            const admin = await getAdminSession();

            await expectApiError(
                questionsApi(admin.token).deleteQuestion({ id: QUESTION_INEXISTANTE }),
                404,
                "NOT_FOUND"
            );
        });
    });
});