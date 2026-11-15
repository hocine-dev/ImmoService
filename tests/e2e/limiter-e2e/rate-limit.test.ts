import { describe, expect, it } from "vitest";
import {
    AnnoncesApi,
    AuthApi,
    Configuration,
    QuestionsApi
} from "../../../sdk/index.js";

const baseUrl = "http://localhost:3002";
const authApi = new AuthApi(new Configuration({ basePath: baseUrl }));
const annoncesApi = new AnnoncesApi(new Configuration({ basePath: baseUrl }));

const questionsApi = (token: string) => new QuestionsApi(new Configuration({
    basePath: baseUrl,
    headers: { Authorization: `Bearer ${token}` }
}));

const uniqueEmail = (index: number) =>
    `rate-limit.${Date.now()}.${index}.${Math.random().toString(36).slice(2, 8)}@test.local`;

describe("Sécurité - rate limiting", () => {
    // Ce test doit rester avant authLimiter : ses connexions réussies sont ignorées
    // par authLimiter, tandis que le test authLimiter bloque ensuite l'IP.
    it("registerLimiter retourne 429 à la 11e inscription", async () => {
        // Conserver les identifiants créés afin de supprimer les utilisateurs
        // de test après les assertions.
        const createdUserIds: string[] = [];

        try {
            // Les dix premières inscriptions doivent être acceptées.
            // La onzième doit être bloquée par registerLimiter.
            for (let inscription = 1; inscription <= 11; inscription++) {
                const response = await fetch(`${baseUrl}/users/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: `Utilisateur limite ${inscription}`,
                        email: uniqueEmail(inscription),
                        password: "motdepasse123"
                    })
                });

                // Vérifier le seuil exact : 10 succès, puis un HTTP 429.
                expect(response.status).toBe(inscription <= 10 ? 201 : 429);

                if (inscription <= 10) {
                    const body = await response.json();
                    expect(body.data?.id).toBeTruthy();
                    createdUserIds.push(body.data.id);
                } else {
                    // Vérifier le contrat d'erreur renvoyé par le limiteur.
                    const body = await response.json();
                    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
                }
            }
        } finally {
            // Le nettoyage est exécuté même si une assertion échoue.
            const adminEmail = process.env.SEED_ADMIN_EMAIL;
            const adminPassword = process.env.SEED_ADMIN_PASSWORD;

            if (!adminEmail || !adminPassword) {
                throw new Error(
                    "SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD manquants pour le nettoyage"
                );
            }

            const loginResponse = await authApi.loginRaw({
                loginInput: { email: adminEmail, password: adminPassword }
            });
            const loginBody = await loginResponse.value();

            // Supprimer les dix utilisateurs créés pour ne pas polluer la base E2E.
            for (const id of createdUserIds) {
                await fetch(`${baseUrl}/users/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${loginBody.data.token}` }
                });
            }
        }
    });

    it("questionLimiter retourne 429 à la 21e création de question", async () => {
        // Une session utilisateur est nécessaire pour créer des questions.
        const email = process.env.SEED_USER_1_EMAIL;
        const password = process.env.SEED_USER_1_PASSWORD;

        if (!email || !password) {
            throw new Error("SEED_USER_1_EMAIL et SEED_USER_1_PASSWORD manquants");
        }

        const login = await authApi.login({
            loginInput: { email, password }
        });

        // Utiliser une annonce publiée existante comme cible des questions.
        const annonce = await annoncesApi.listAnnonces({ limit: 1 });
        const annonceId = annonce.data[0]?.id;

        if (!annonceId) {
            throw new Error("Aucune annonce publiée disponible pour le test");
        }

        const createdQuestionIds: string[] = [];

        try {
            // Les vingt premières créations doivent réussir.
            // La vingt-et-unième doit être bloquée par questionLimiter.
            for (let creation = 1; creation <= 21; creation++) {
                const response = await fetch(`${baseUrl}/questions/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${login.data.token}`
                    },
                    body: JSON.stringify({
                        texte: `Question limite ${Date.now()} #${creation}`,
                        annonceId
                    })
                });

                // Vérifier le seuil exact : 20 succès, puis un HTTP 429.
                expect(response.status).toBe(creation <= 20 ? 201 : 429);

                if (creation <= 20) {
                    const body = await response.json();
                    expect(body.data?.id).toBeTruthy();
                    createdQuestionIds.push(body.data.id);
                } else {
                    // Vérifier le code d'erreur standard du rate limiter.
                    const body = await response.json();
                    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
                }
            }
        } finally {
            // Reprendre un compte administrateur pour supprimer les questions créées.
            const adminEmail = process.env.SEED_ADMIN_EMAIL;
            const adminPassword = process.env.SEED_ADMIN_PASSWORD;

            if (!adminEmail || !adminPassword) {
                throw new Error(
                    "SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD manquants pour le nettoyage"
                );
            }

            const adminLogin = await authApi.login({
                loginInput: {
                    email: adminEmail,
                    password: adminPassword
                }
            });

            // Supprimer les vingt questions créées pendant le scénario.
            for (const id of createdQuestionIds) {
                await questionsApi(adminLogin.data.token).deleteQuestion({ id });
            }
        }
    });

    it("authLimiter retourne 429 à la 15e tentative échouée", async () => {
        // Réutiliser un utilisateur existant avec un mot de passe volontairement faux.
        const email = process.env.SEED_USER_1_EMAIL;

        if (!email) {
            throw new Error("SEED_USER_1_EMAIL manquant");
        }

        // Le critère de l'énoncé vérifie que la 15e tentative est bloquée.
        for (let tentative = 1; tentative <= 15; tentative++) {
            const response = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password: "mot-de-passe-volontairement-incorrect"
                })
            });

            // Les quatorze premières réponses doivent être 401, la 15e 429.
            expect(response.status).toBe(tentative <= 14 ? 401 : 429);

            if (tentative === 15) {
                // Vérifier que le blocage utilise le code d'erreur attendu.
                const body = await response.json();
                expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
            }
        }
    });
});
