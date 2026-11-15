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

const getUser2Session = () =>
    session("user2", process.env.SEED_USER_2_EMAIL, process.env.SEED_USER_2_PASSWORD);

const getAgentSession = () =>
    session("agent", process.env.SEED_AGENT_1_EMAIL, process.env.SEED_AGENT_1_PASSWORD);

const getAgent2Session = () =>
    session("agent2", process.env.SEED_AGENT_2_EMAIL, process.env.SEED_AGENT_2_PASSWORD);

const getAdminSession = () =>
    session("admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);

const annonceBase = {
    titre: "Annonce pour test lecture de réponses",
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

// Suppression : par cascade, elle supprime aussi les questions et les réponses.
async function deleteAnnonce(token: string, id: string) {
    await annoncesApi(token).deleteAnnonceRaw({ id }).catch(() => undefined);
}

// Pose une question sur une annonce publiée avec l'utilisateur 1.
async function createQuestionOn(annonceId: string, prefix = "Question E2E") {
    const user = await getUserSession();

    const response = await questionsApi(user.token).createQuestion({
        createQuestionInput: { texte: `${prefix} ${Date.now()}`, annonceId }
    });

    return response.data!.id!;
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

// Vérifie le statut et le code d'erreur d'une réponse HTTP.
async function expectError(response: Response, status: number, code?: string) {
    expect(response.status).toBe(status);

    if (!code) return undefined;

    const body = await response.json();
    expect(body.error.code).toBe(code);
    return body;
}

const uniqueTexte = (prefix = "Réponse E2E") => `${prefix} ${Date.now()}`;

const QUESTION_INEXISTANTE = "cm0000000000000000000000x";

describe("GET /reponses/question/:questionId - Tests E2E", () => {
    let annonceId: string;
    let agentToken: string;
    let questionRepondue: string;
    let questionSansReponse: string;
    let texteReponse: string;
    let reponseId: string;

    // Annonce publiée par l'agent 1, avec une question répondue et une question sans réponse.
    beforeAll(async () => {
        const agent = await getAgentSession();
        agentToken = agent.token;

        annonceId = await createBrouillon(agent.token, `Réponses lecture ${Date.now()}`);
        await changeStatut(agent.token, annonceId, "PUBLIE");

        questionRepondue = await createQuestionOn(annonceId, "Question répondue");
        texteReponse = uniqueTexte();
        reponseId = await createReponse(agent.token, questionRepondue, texteReponse);

        questionSansReponse = await createQuestionOn(annonceId, "Question sans réponse");
    });

    // Nettoyage : la suppression de l'annonce emporte aussi questions et réponses.
    afterAll(async () => {
        if (annonceId) await deleteAnnonce(agentToken, annonceId);
    });

    describe("annonce publiée", () => {

        it("retourne la réponse d'une question pour un utilisateur authentifié", async () => {
            const user = await getUserSession();
            const agent = await getAgentSession();

            const response = await getReponse(user.token, questionRepondue);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.status).toBe("success");
            expect(body.data.id).toBe(reponseId);
            expect(body.data.texte).toBe(texteReponse);
            expect(body.data.questionId).toBe(questionRepondue);
            expect(body.data.auteurId).toBe(agent.userId);
            expect(body.data.createdAt).toBeTruthy();
        });

        it("inclut l'auteur avec son id et son nom uniquement", async () => {
            const user = await getUserSession();
            const agent = await getAgentSession();

            const response = await getReponse(user.token, questionRepondue);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.data.auteur.id).toBe(agent.userId);
            expect(body.data.auteur.name).toBeTruthy();
            // Jamais d'email ni de hash.
            expect(Object.keys(body.data.auteur).sort()).toEqual(["id", "name"]);
        });

        it("est consultable par un autre utilisateur, par un autre agent et par un administrateur", async () => {
            for (const compte of [getUser2Session, getAgent2Session, getAdminSession]) {
                const { token } = await compte();

                const response = await getReponse(token, questionRepondue);

                expect(response.status).toBe(200);
            }
        });

        it("retourne 404 pour une question sans réponse", async () => {
            const user = await getUserSession();

            const response = await getReponse(user.token, questionSansReponse);

            await expectError(response, 404, "NOT_FOUND");
        });

        it("retourne 404 pour une question inexistante", async () => {
            const user = await getUserSession();

            const response = await getReponse(user.token, QUESTION_INEXISTANTE);

            await expectError(response, 404, "NOT_FOUND");
        });
    });

    describe("authentification et données invalides", () => {

        // Le routeur exige actuellement un JWT (authMiddleware()).
        // Si l'accès devient public (authentification facultative), ce test doit attendre 200.
        it("refuse l'accès sans authentification", async () => {
            const response = await getReponse(undefined, questionRepondue);

            await expectError(response, 401);
        });

        it("refuse un token invalide", async () => {
            const response = await getReponse("token.invalide.xyz", questionRepondue);

            await expectError(response, 401);
        });

        it("retourne 400 pour un questionId qui n'est pas un CUID", async () => {
            const user = await getUserSession();

            const response = await getReponse(user.token, "pas-un-cuid");

            await expectError(response, 400, "VALIDATION_ERROR");
        });
    });

    describe("annonce repassée en brouillon", () => {
        let annonceDepubliee: string;
        let questionDepubliee: string;

        // Annonce propre à ce bloc : publiée, avec une réponse, puis repassée en brouillon.
        beforeAll(async () => {
            const agent = await getAgentSession();

            annonceDepubliee = await createBrouillon(agent.token, `Dépubliée ${Date.now()}`);
            await changeStatut(agent.token, annonceDepubliee, "PUBLIE");

            questionDepubliee = await createQuestionOn(annonceDepubliee, "Question dépubliée");
            await createReponse(agent.token, questionDepubliee, uniqueTexte());

            await changeStatut(agent.token, annonceDepubliee, "BROUILLON");
        });

        afterAll(async () => {
            if (annonceDepubliee) await deleteAnnonce(agentToken, annonceDepubliee);
        });

        it("autorise l'agent propriétaire", async () => {
            const agent = await getAgentSession();

            const response = await getReponse(agent.token, questionDepubliee);

            expect(response.status).toBe(200);
        });

        it("autorise un administrateur", async () => {
            const admin = await getAdminSession();

            const response = await getReponse(admin.token, questionDepubliee);

            expect(response.status).toBe(200);
        });

        it("retourne 404 pour un utilisateur standard", async () => {
            const user = await getUserSession();

            const response = await getReponse(user.token, questionDepubliee);

            await expectError(response, 404, "NOT_FOUND");
        });

        it("retourne 404 pour un autre agent", async () => {
            const agent2 = await getAgent2Session();

            const response = await getReponse(agent2.token, questionDepubliee);

            await expectError(response, 404, "NOT_FOUND");
        });

        it("ne révèle pas l'existence de la réponse (même erreur qu'une question inexistante)", async () => {
            const user = await getUserSession();

            const refusee = await expectError(
                await getReponse(user.token, questionDepubliee),
                404,
                "NOT_FOUND"
            );

            const inexistante = await expectError(
                await getReponse(user.token, QUESTION_INEXISTANTE),
                404,
                "NOT_FOUND"
            );

            expect(refusee.error.message).toBe(inexistante.error.message);
        });
    });
});