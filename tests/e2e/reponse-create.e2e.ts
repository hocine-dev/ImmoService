import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AnnoncesApi, AuthApi, Configuration, QuestionsApi } from "../../sdk/index.js";

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
    titre: "Annonce pour test création de réponses",
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

// POST /reponses/create : fetch brut (les routes /reponses ne sont pas dans le SDK).
function postReponse(token: string | undefined, body: unknown) {
    return fetch(`${baseUrl}/reponses/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
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

describe("POST /reponses/create - Tests E2E", () => {
    let annonceId: string;
    let agentToken: string;

    // Question que personne n'a le droit de traiter dans ces tests : elle reste sans réponse.
    let questionProtegee: string;

    // Pose une question sur l'annonce avec l'utilisateur 1 et retourne son identifiant.
    async function createQuestion(prefix = "Question E2E") {
        const user = await getUserSession();

        const response = await questionsApi(user.token).createQuestion({
            createQuestionInput: { texte: uniqueTexte(prefix), annonceId }
        });

        return response.data!.id!;
    }

    // Retourne la réponse attachée à une question, lue via la liste publique des questions.
    async function reponseDeLaQuestion(questionId: string) {
        const liste = await questionsApi().listQuestionsByAnnonce({ annonceId, limit: 100 });
        const question = liste.data.find((q) => q.id === questionId);

        expect(question, "la question doit apparaître dans la liste").toBeDefined();
        return question!.reponse;
    }

    // Annonce publiée par l'agent 1, avec une question sans réponse.
    beforeAll(async () => {
        const agent = await getAgentSession();
        agentToken = agent.token;

        annonceId = await createBrouillon(agent.token, `Réponses création ${Date.now()}`);
        await changeStatut(agent.token, annonceId, "PUBLIE");

        questionProtegee = await createQuestion("Question protégée");
    });

    // Nettoyage : la suppression de l'annonce emporte aussi questions et réponses.
    afterAll(async () => {
        if (annonceId) await deleteAnnonce(agentToken, annonceId);
    });

    describe("création autorisée", () => {

        it("permet à l'agent propriétaire de l'annonce de répondre", async () => {
            const agent = await getAgentSession();
            const questionId = await createQuestion();
            const texte = uniqueTexte();

            const response = await postReponse(agent.token, { texte, questionId });
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.status).toBe("success");
            expect(body.message).toBeTruthy();
            expect(body.data.id).toBeTruthy();
            expect(body.data.texte).toBe(texte);
            expect(body.data.questionId).toBe(questionId);
            // L'auteur vient du JWT.
            expect(body.data.auteurId).toBe(agent.userId);
            expect(body.data.createdAt).toBeTruthy();
        });

        it("rattache la réponse à la question dans la liste publique", async () => {
            const agent = await getAgentSession();
            const questionId = await createQuestion();
            const texte = uniqueTexte();

            const response = await postReponse(agent.token, { texte, questionId });
            expect(response.status).toBe(201);

            const reponse = await reponseDeLaQuestion(questionId);

            expect(reponse).not.toBeNull();
            expect(reponse).toMatchObject({ texte, questionId });
        });

        it("permet à un administrateur de répondre", async () => {
            const admin = await getAdminSession();
            const questionId = await createQuestion();

            const response = await postReponse(admin.token, {
                texte: uniqueTexte(),
                questionId
            });
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.data.auteurId).toBe(admin.userId);
        });

        it("retire les espaces de début et de fin du texte", async () => {
            const agent = await getAgentSession();
            const questionId = await createQuestion();
            const texte = uniqueTexte("Réponse trim");

            const response = await postReponse(agent.token, {
                texte: `   ${texte}   `,
                questionId
            });
            const body = await response.json();

            expect(response.status).toBe(201);
            expect(body.data.texte).toBe(texte);
        });
    });

    describe("conflit", () => {

        it("retourne 409 quand la question a déjà une réponse", async () => {
            const agent = await getAgentSession();
            const questionId = await createQuestion();

            const premiere = await postReponse(agent.token, {
                texte: uniqueTexte("Première"),
                questionId
            });
            expect(premiere.status).toBe(201);

            const seconde = await postReponse(agent.token, {
                texte: uniqueTexte("Seconde"),
                questionId
            });
            await expectError(seconde, 409, "CONFLICT");

            // La première réponse est conservée.
            const reponse = await reponseDeLaQuestion(questionId);
            expect(reponse?.texte).toContain("Première");
        });
    });

    describe("création refusée", () => {

        it("refuse un autre agent (pas propriétaire de l'annonce)", async () => {
            const agent2 = await getAgent2Session();

            const response = await postReponse(agent2.token, {
                texte: uniqueTexte(),
                questionId: questionProtegee
            });

            await expectError(response, 403, "FORBIDDEN");

            // La question doit toujours être sans réponse.
            expect(await reponseDeLaQuestion(questionProtegee)).toBeNull();
        });

        it("refuse un utilisateur standard (réservé aux agents et administrateurs)", async () => {
            const user = await getUserSession();

            const response = await postReponse(user.token, {
                texte: uniqueTexte(),
                questionId: questionProtegee
            });

            await expectError(response, 403, "FORBIDDEN");
            expect(await reponseDeLaQuestion(questionProtegee)).toBeNull();
        });

        it("refuse la création sans authentification", async () => {
            const response = await postReponse(undefined, {
                texte: uniqueTexte(),
                questionId: questionProtegee
            });

            await expectError(response, 401);
        });

        it("refuse un token invalide", async () => {
            const response = await postReponse("token.invalide.xyz", {
                texte: uniqueTexte(),
                questionId: questionProtegee
            });

            await expectError(response, 401);
        });

        it("retourne 404 pour une question inexistante", async () => {
            const agent = await getAgentSession();

            const response = await postReponse(agent.token, {
                texte: uniqueTexte(),
                questionId: QUESTION_INEXISTANTE
            });

            await expectError(response, 404, "NOT_FOUND");
        });
    });

    describe("données invalides", () => {

        it("refuse un texte vide", async () => {
            const agent = await getAgentSession();

            const response = await postReponse(agent.token, {
                texte: "",
                questionId: questionProtegee
            });

            await expectError(response, 400, "VALIDATION_ERROR");
        });

        it("refuse un texte composé uniquement d'espaces", async () => {
            const agent = await getAgentSession();

            const response = await postReponse(agent.token, {
                texte: "     ",
                questionId: questionProtegee
            });

            await expectError(response, 400, "VALIDATION_ERROR");
        });

        it("refuse une création sans questionId", async () => {
            const agent = await getAgentSession();

            const response = await postReponse(agent.token, { texte: uniqueTexte() });

            await expectError(response, 400, "VALIDATION_ERROR");
        });

        it("refuse un questionId qui n'est pas un CUID", async () => {
            const agent = await getAgentSession();

            const response = await postReponse(agent.token, {
                texte: uniqueTexte(),
                questionId: "pas-un-cuid"
            });

            await expectError(response, 400, "VALIDATION_ERROR");
        });

        it("refuse un champ inconnu dans le body (auteurId)", async () => {
            const agent = await getAgentSession();

            // L'auteur vient du JWT : l'envoyer dans le body est interdit.
            const response = await postReponse(agent.token, {
                texte: uniqueTexte(),
                questionId: questionProtegee,
                auteurId: "cm0000000000000000000000x"
            });

            await expectError(response, 400, "VALIDATION_ERROR");
            expect(await reponseDeLaQuestion(questionProtegee)).toBeNull();
        });

        it("refuse un body vide", async () => {
            const agent = await getAgentSession();

            const response = await postReponse(agent.token, {});

            await expectError(response, 400, "VALIDATION_ERROR");
        });

        it("retourne 400 pour un JSON mal formé", async () => {
            const agent = await getAgentSession();

            const response = await fetch(`${baseUrl}/reponses/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${agent.token}`
                },
                body: '{"texte":'
            });

            const body = await expectError(response, 400, "VALIDATION_ERROR");

            expect(body.error.details.body).toBeDefined();
        });
    });
});