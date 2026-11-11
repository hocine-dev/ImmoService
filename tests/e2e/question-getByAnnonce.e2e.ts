import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    AnnoncesApi,
    AuthApi,
    Configuration,
    QuestionsApi
} from "../../sdk/index.js";

const baseUrl = "http://localhost:3002";

// En-tête Authorization envoyé explicitement : fonctionne même si
// `securitySchemes` n'est pas déclaré dans openapi.yaml.
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

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const annonceBrouillon = {
    titre: "Brouillon pour test liste des questions",
    description: "Brouillon : accessible seulement à l'agent propriétaire et à l'admin",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
} as const;


// Crée un brouillon ; en cas d'échec, remonte le statut et le corps de la réponse
// pour faciliter le diagnostic.
async function createBrouillon(token: string, titre: string) {
    try {
        return await annoncesApi(token).createAnnonceRaw({
            createAnnonceInput: { ...annonceBrouillon, titre }
        });
    } catch (e) {
        const response = (e as { response?: Response }).response;
        const corps = response ? await response.text() : String(e);
        throw new Error(
            `Création du brouillon refusée (HTTP ${response?.status}) : ${corps}`
        );
    }
}

const ANNONCE_INEXISTANTE = "cm0000000000000000000000x";

describe("GET /questions/annonce/:annonceId - Tests E2E", () => {
    let annoncePubliee: string;
    const questionsCreees: { id: string; texte: string }[] = [];

    // Annonce publiée du seed + 3 questions créées dans l'ordre, avec une courte pause
    // pour garantir des dates de création distinctes.
    beforeAll(async () => {
        const liste = await annoncesApi().listAnnonces({ limit: 1 });

        expect(
            liste.data.length,
            "Le seed doit contenir au moins une annonce publiée"
        ).toBeGreaterThan(0);

        annoncePubliee = liste.data[0].id;

        const user = await getUserSession();

        for (let i = 1; i <= 3; i++) {
            const texte = `Question liste ${Date.now()} #${i}`;

            const response = await questionsApi(user.token).createQuestion({
                createQuestionInput: { texte, annonceId: annoncePubliee }
            });

            questionsCreees.push({ id: response.data!.id!, texte });
            await pause(20);
        }
    });

    // Nettoyage : suppression des questions par l'administrateur.
    afterAll(async () => {
        const admin = await getAdminSession();

        for (const question of questionsCreees) {
            await questionsApi(admin.token)
                .deleteQuestion({ id: question.id })
                .catch(() => undefined);
        }
    });

    describe("annonce publiée", () => {

        it("retourne la liste paginée sans authentification (accès public)", async () => {
            const response = await questionsApi().listQuestionsByAnnonceRaw({
                annonceId: annoncePubliee
            });
            const body = await response.value();

            expect(response.raw.status).toBe(200);
            expect(body.status).toBe("success");
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.pagination).toMatchObject({ page: 1, limit: 10 });
            expect(body.pagination.total).toBeGreaterThanOrEqual(questionsCreees.length);

            // Les questions créées dans beforeAll doivent être présentes.
            const ids = body.data.map((q) => q.id);
            for (const question of questionsCreees) {
                expect(ids).toContain(question.id);
            }
        });

        it("fonctionne aussi avec un JWT valide (authentification facultative)", async () => {
            const user = await getUserSession();

            const response = await questionsApi(user.token).listQuestionsByAnnonceRaw({
                annonceId: annoncePubliee
            });

            expect(response.raw.status).toBe(200);
        });

        it("inclut l'auteur (id, name) et la réponse éventuelle", async () => {
            const user = await getUserSession();

            const response = await questionsApi().listQuestionsByAnnonceRaw({
                annonceId: annoncePubliee,
                limit: 100
            });

            // Le SDK ignore les champs inconnus : on lit donc le JSON brut.
            const rawBody = await response.raw.json();

            expect(response.raw.status).toBe(200);

            const question = rawBody.data.find(
                (q: { id: string }) => q.id === questionsCreees[0].id
            );

            expect(question).toBeDefined();
            expect(question.texte).toBe(questionsCreees[0].texte);
            expect(question.annonceId).toBe(annoncePubliee);
            expect(question.auteurId).toBe(user.userId);
            expect(question.createdAt).toBeTruthy();
            expect(question.reponse).toBeNull();

            // L'auteur n'expose que id et name, jamais d'email ni de hash.
            expect(question.auteur.id).toBe(user.userId);
            expect(question.auteur.name).toBeTruthy();
            expect(Object.keys(question.auteur).sort()).toEqual(["id", "name"]);
        });

        it("trie les questions de la plus récente à la plus ancienne", async () => {
            const response = await questionsApi().listQuestionsByAnnonceRaw({
                annonceId: annoncePubliee,
                limit: 100
            });
            const body = await response.value();

            expect(response.raw.status).toBe(200);

            // On ne garde que les questions de ce test, dans l'ordre renvoyé.
            const idsCrees = new Set(questionsCreees.map((q) => q.id));
            const ordreRenvoye = body.data.filter((q) => idsCrees.has(q.id)).map((q) => q.id);
            const ordreAttendu = [...questionsCreees].reverse().map((q) => q.id);

            expect(ordreRenvoye).toEqual(ordreAttendu);
        });

        it("respecte la pagination", async () => {
            const page1 = await questionsApi().listQuestionsByAnnonceRaw({
                annonceId: annoncePubliee,
                page: 1,
                limit: 1
            });
            const body1 = await page1.value();

            expect(page1.raw.status).toBe(200);
            expect(body1.data).toHaveLength(1);
            expect(body1.pagination.limit).toBe(1);
            expect(body1.pagination.pages).toBe(body1.pagination.total);

            // Au moins 3 questions existent : la page 2 est donc non vide et différente.
            const page2 = await questionsApi().listQuestionsByAnnonce({
                annonceId: annoncePubliee,
                page: 2,
                limit: 1
            });

            expect(page2.data).toHaveLength(1);
            expect(page2.data[0].id).not.toBe(body1.data[0].id);
        });

        it("retourne une liste vide au-delà de la dernière page", async () => {
            const response = await questionsApi().listQuestionsByAnnonceRaw({
                annonceId: annoncePubliee,
                page: 10000,
                limit: 100
            });
            const body = await response.value();

            expect(response.raw.status).toBe(200);
            expect(body.data).toHaveLength(0);
        });

        it("refuse un token invalide (le JWT est vérifié s'il est fourni)", async () => {
            await expectApiError(
                questionsApi("token.invalide.xyz").listQuestionsByAnnonce({
                    annonceId: annoncePubliee
                }),
                401
            );
        });

        it("refuse limit > 100", async () => {
            await expectApiError(
                questionsApi().listQuestionsByAnnonce({
                    annonceId: annoncePubliee,
                    limit: 1000
                }),
                400,
                "VALIDATION_ERROR"
            );
        });

        it("refuse page = 0", async () => {
            await expectApiError(
                questionsApi().listQuestionsByAnnonce({
                    annonceId: annoncePubliee,
                    page: 0
                }),
                400
            );
        });
    });

    describe("annonce inexistante", () => {

        it("retourne 404 pour une annonce inexistante", async () => {
            await expectApiError(
                questionsApi().listQuestionsByAnnonce({ annonceId: ANNONCE_INEXISTANTE }),
                404,
                "NOT_FOUND"
            );
        });
    });

    describe("annonce en brouillon", () => {
        let brouillonId: string;
        let agentToken: string;

        // Brouillon créé par l'agent 1 (propriétaire).
        beforeAll(async () => {
            const agent = await getAgentSession();
            agentToken = agent.token;

            const response = await createBrouillon(
                agent.token,
                `Brouillon liste questions ${Date.now()}`
            );

            const annonce = await response.value();

            expect(response.raw.status).toBe(201);
            expect(annonce.statut).toBe("BROUILLON");

            brouillonId = annonce.id;
        });

        afterAll(async () => {
            if (!brouillonId) return;

            await annoncesApi(agentToken)
                .deleteAnnonceRaw({ id: brouillonId })
                .catch(() => undefined);
        });

        it("autorise l'agent propriétaire", async () => {
            const agent = await getAgentSession();

            const response = await questionsApi(agent.token).listQuestionsByAnnonceRaw({
                annonceId: brouillonId
            });
            const body = await response.value();

            expect(response.raw.status).toBe(200);
            // Aucune question ne peut être posée sur un brouillon.
            expect(body.data).toHaveLength(0);
            expect(body.pagination.total).toBe(0);
        });

        it("autorise un administrateur", async () => {
            const admin = await getAdminSession();

            const response = await questionsApi(admin.token).listQuestionsByAnnonceRaw({
                annonceId: brouillonId
            });

            expect(response.raw.status).toBe(200);
        });

        it("retourne 404 pour un autre agent", async () => {
            const agent2 = await getAgent2Session();

            await expectApiError(
                questionsApi(agent2.token).listQuestionsByAnnonce({ annonceId: brouillonId }),
                404,
                "NOT_FOUND"
            );
        });

        it("retourne 404 pour un utilisateur standard", async () => {
            const user = await getUserSession();

            await expectApiError(
                questionsApi(user.token).listQuestionsByAnnonce({ annonceId: brouillonId }),
                404,
                "NOT_FOUND"
            );
        });

        it("retourne 404 pour un visiteur anonyme", async () => {
            await expectApiError(
                questionsApi().listQuestionsByAnnonce({ annonceId: brouillonId }),
                404,
                "NOT_FOUND"
            );
        });

        it("ne révèle pas l'existence du brouillon (même erreur qu'une annonce inexistante)", async () => {
            const brouillon = await expectApiError(
                questionsApi().listQuestionsByAnnonce({ annonceId: brouillonId }),
                404,
                "NOT_FOUND"
            );

            const inexistante = await expectApiError(
                questionsApi().listQuestionsByAnnonce({ annonceId: ANNONCE_INEXISTANTE }),
                404,
                "NOT_FOUND"
            );

            expect(brouillon.error.message).toBe(inexistante.error.message);
        });
    });
});