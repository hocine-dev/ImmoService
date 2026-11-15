import { describe, it, expect, beforeAll } from "vitest";
import { AuthApi, Configuration, UsersApi } from "../../../sdk/index.js";

const baseUrl = "http://localhost:3002";

const authApi = new AuthApi(new Configuration({ basePath: baseUrl }));


const usersApi = (token?: string) =>
    new UsersApi(new Configuration({
        basePath: baseUrl,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }));

const seed = {
    user: {
        email: process.env.SEED_USER_1_EMAIL as string,
        password: process.env.SEED_USER_1_PASSWORD as string
    },
    agent: {
        email: process.env.SEED_AGENT_1_EMAIL as string,
        password: process.env.SEED_AGENT_1_PASSWORD as string
    },
    admin: {
        email: process.env.SEED_ADMIN_EMAIL as string,
        password: process.env.SEED_ADMIN_PASSWORD as string
    }
};

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

// Lit le payload d'un JWT sans vérifier la signature.
function decodeJwt(token: string) {
    const [, payload] = token.split(".");

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        id: string;
        role: string;
        iat: number;
        exp: number;
    };
}

describe("POST /auth/login - Tests E2E", () => {

    describe("connexion réussie", () => {
        let status: number;
        let rawBody: any;
        let body: Awaited<ReturnType<typeof authApi.login>>;

        // Une seule connexion pour toutes les assertions de ce bloc.
        beforeAll(async () => {
            const response = await authApi.loginRaw({ loginInput: seed.user });

            // Le SDK ignore les champs inconnus : on garde aussi le JSON brut.
            rawBody = await response.raw.clone().json();
            body = await response.value();
            status = response.raw.status;
        });

        it("retourne 200 avec un token et l'utilisateur", () => {
            expect(status).toBe(200);
            expect(body.status).toBe("success");
            expect(body.message).toBeTruthy();
            expect(typeof body.data.token).toBe("string");
            expect(body.data.token.split(".")).toHaveLength(3);
            expect(body.data.user.email).toBe(seed.user.email);
            expect(body.data.user.role).toBe("USER");
            expect(body.data.user.id).toBeTruthy();
        });

        it("ne retourne jamais le passwordHash ni le mot de passe", () => {
            expect(rawBody.data.user.passwordHash).toBeUndefined();
            expect(rawBody.data.user.password).toBeUndefined();
        });

        it("retourne un JWT dont le payload contient id et role, valable 1 jour", () => {
            const payload = decodeJwt(body.data.token);

            expect(payload.id).toBe(body.data.user.id);
            expect(payload.role).toBe("USER");
            expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
        });

        it("retourne un token utilisable sur une route protégée", async () => {
            const profil = await usersApi(body.data.token).getUserByIdRaw({
                id: body.data.user.id!
            });

            expect(profil.raw.status).toBe(200);
        });
    });

    describe("rôle selon le compte", () => {

        it("retourne le rôle ADMIN pour l'administrateur", async () => {
            const response = await authApi.login({ loginInput: seed.admin });

            expect(response.data.user.role).toBe("ADMIN");
            expect(decodeJwt(response.data.token).role).toBe("ADMIN");
        });

        it("retourne le rôle AGENT pour l'agent", async () => {
            const response = await authApi.login({ loginInput: seed.agent });

            expect(response.data.user.role).toBe("AGENT");
            expect(decodeJwt(response.data.token).role).toBe("AGENT");
        });
    });

    describe("identifiants invalides", () => {

        it("retourne la même erreur 401 pour un mauvais mot de passe et un email inconnu", async () => {
            const motDePasse = await expectApiError(
                authApi.login({
                    loginInput: { email: seed.user.email, password: "mauvais-mot-de-passe" }
                }),
                401,
                "UNAUTHORIZED"
            );

            const emailInconnu = await expectApiError(
                authApi.login({
                    loginInput: {
                        email: `inconnu.${Date.now()}@test.local`,
                        password: "motdepasse123"
                    }
                }),
                401,
                "UNAUTHORIZED"
            );

            // Même message : ne pas révéler l'existence d'un compte.
            expect(motDePasse.error.message).toBe(emailInconnu.error.message);
            expect(motDePasse.error.token).toBeUndefined();
        });
    });

    describe("données invalides", () => {

        it("refuse un email invalide", async () => {
            const body = await expectApiError(
                authApi.login({
                    loginInput: { email: "pas-un-email", password: "motdepasse123" }
                }),
                400,
                "VALIDATION_ERROR"
            );

            expect(body.error.details.email).toBeDefined();
        });

        it("refuse un mot de passe vide", async () => {
            await expectApiError(
                authApi.login({
                    loginInput: { email: seed.user.email, password: "" }
                }),
                400,
                "VALIDATION_ERROR"
            );
        });

        it("refuse un body incomplet (email absent)", async () => {
            await expectApiError(
                authApi.login({
                    loginInput: { password: "motdepasse123" } as never
                }),
                400,
                "VALIDATION_ERROR"
            );
        });

        it("refuse un body vide", async () => {
            await expectApiError(
                authApi.login({ loginInput: {} as never }),
                400
            );
        });

        it("retourne 400 pour un JSON mal formé", async () => {
            // Cas impossible à produire avec le SDK : fetch brut.
            const response = await fetch(`${baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: '{"email":'
            });

            expect(response.status).toBe(400);

            const body = await response.json();

            expect(body.error.code).toBe("VALIDATION_ERROR");
            expect(body.error.details.body).toBeDefined();
        });
    });
});