import { describe, it, expect } from "vitest";
import { AuthApi, Configuration, UsersApi } from "../../sdk/index.js";

const baseUrl = "http://localhost:3002";

// En-tête Authorization envoyé explicitement : fonctionne même si
// `securitySchemes` n'est pas déclaré dans openapi.yaml.
const usersApi = (token?: string) =>
    new UsersApi(new Configuration({
        basePath: baseUrl,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }));

const authApi = new AuthApi(new Configuration({ basePath: baseUrl }));

async function login(email: string | undefined, password: string | undefined) {
    const response = await authApi.login({
        loginInput: { email: email as string, password: password as string }
    });

    expect(response.data.token).toBeTruthy();
    return response.data.token;
}

// Un seul login par rôle et par fichier : évite le slow-down / rate limit.
const cache = new Map<string, Promise<string>>();

function cachedToken(role: string, email?: string, password?: string) {
    if (!cache.has(role)) cache.set(role, login(email, password));
    return cache.get(role)!;
}

const getAdminToken = () =>
    cachedToken("admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);

const getAgentToken = () =>
    cachedToken("agent", process.env.SEED_AGENT_1_EMAIL, process.env.SEED_AGENT_1_PASSWORD);

const getUserToken = () =>
    cachedToken("user", process.env.SEED_USER_1_EMAIL, process.env.SEED_USER_1_PASSWORD);

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

describe("GET /users/getAll - Tests E2E", () => {

    it("retourne la liste paginée pour un administrateur", async () => {
        const token = await getAdminToken();
        const response = await usersApi(token).getAllUsersRaw({});
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data!.length).toBeGreaterThan(0);
        expect(body.pagination).toMatchObject({ page: 1, limit: 10 });
        expect(body.pagination!.total).toBeGreaterThanOrEqual(body.data!.length);
    });

    it("ne retourne aucune donnée sensible (passwordHash)", async () => {
        const token = await getAdminToken();
        const response = await usersApi(token).getAllUsersRaw({});

        // Le SDK ignore les champs inconnus : on lit donc le JSON brut.
        const rawBody = await response.raw.clone().json();

        expect(response.raw.status).toBe(200);

        for (const user of rawBody.data) {
            expect(user.id).toBeTruthy();
            expect(user.email).toBeTruthy();
            expect(user.role).toBeTruthy();
            expect(user.passwordHash).toBeUndefined();
            expect(user.password).toBeUndefined();
        }
    });

    it("respecte les paramètres de pagination", async () => {
        const token = await getAdminToken();
        const response = await usersApi(token).getAllUsersRaw({ page: 1, limit: 2 });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.data!.length).toBeLessThanOrEqual(2);
        expect(body.pagination!.limit).toBe(2);
        expect(body.pagination!.pages).toBe(Math.ceil(body.pagination!.total! / 2));
    });

    it("retourne des pages différentes pour page=1 et page=2", async () => {
        const token = await getAdminToken();

        const page1 = await usersApi(token).getAllUsers({ page: 1, limit: 1 });
        const page2 = await usersApi(token).getAllUsers({ page: 2, limit: 1 });

        // Ce test suppose au moins 2 utilisateurs en base (seed).
        expect(page1.data).toHaveLength(1);
        expect(page2.data).toHaveLength(1);
        expect(page1.data![0].id).not.toBe(page2.data![0].id);
    });

    it("refuse l'accès sans authentification", async () => {
        await expectApiError(usersApi().getAllUsers({}), 401);
    });

    it("refuse un token invalide", async () => {
        await expectApiError(usersApi("token.invalide.xyz").getAllUsers({}), 401);
    });

    it("refuse l'accès à un utilisateur standard", async () => {
        const token = await getUserToken();
        await expectApiError(usersApi(token).getAllUsers({}), 403);
    });

    it("refuse l'accès à un agent", async () => {
        const token = await getAgentToken();
        await expectApiError(usersApi(token).getAllUsers({}), 403);
    });

    it("refuse limit > 100", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).getAllUsers({ limit: 1000 }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("refuse page = 0", async () => {
        const token = await getAdminToken();
        await expectApiError(usersApi(token).getAllUsers({ page: 0 }), 400);
    });

    it("refuse des paramètres de pagination non numériques", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).getAllUsers({
                page: "abc" as unknown as number,
                limit: "xyz" as unknown as number
            }),
            400
        );
    });
});