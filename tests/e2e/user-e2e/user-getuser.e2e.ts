import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AuthApi, Configuration, UsersApi } from "../../../sdk/index.js";

const baseUrl = "http://localhost:3002";

// En-tête Authorization envoyé explicitement : fonctionne même si
// `securitySchemes` n'est pas déclaré dans openapi.yaml.
const usersApi = (token?: string) =>
    new UsersApi(new Configuration({
        basePath: baseUrl,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }));

const authApi = new AuthApi(new Configuration({ basePath: baseUrl }));

const uniqueEmail = () =>
    `e2e.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;

async function getToken(email: string | undefined, password: string | undefined) {
    const response = await authApi.login({
        loginInput: { email: email as string, password: password as string }
    });

    expect(response.data.token).toBeTruthy();
    return response.data.token;
}

let adminTokenPromise: Promise<string> | undefined;

// Un seul login admin par fichier : évite le slow-down / rate limit.
const getAdminToken = () =>
    (adminTokenPromise ??= getToken(
        process.env.SEED_ADMIN_EMAIL,
        process.env.SEED_ADMIN_PASSWORD
    ));

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

type TestUser = { id: string; email: string; password: string; token: string };

// Crée un utilisateur jetable et se connecte une seule fois pour réutiliser le token.
async function createUser(): Promise<TestUser> {
    const email = uniqueEmail();
    const password = "motdepasse123";

    const response = await usersApi().registerUserRaw({
        createUserInput: { name: "Utilisateur E2E", email, password }
    });

    expect(response.raw.status).toBe(201);
    const body = await response.value();

    const token = await getToken(email, password);

    return { id: body.data!.id!, email, password, token };
}

// Nettoyage : ignore l'erreur si le compte n'existe déjà plus.
async function deleteAsAdmin(id: string) {
    const token = await getAdminToken();
    await usersApi(token).deleteUser({ id }).catch(() => undefined);
}

describe("GET /users/:id - Tests E2E", () => {
    let userA: TestUser;
    let userB: TestUser;

    // Deux utilisateurs jetables pour tester l'IDOR.
    beforeAll(async () => {
        userA = await createUser();
        userB = await createUser();
    });

    afterAll(async () => {
        if (userA?.id) await deleteAsAdmin(userA.id);
        if (userB?.id) await deleteAsAdmin(userB.id);
    });

    it("permet à un utilisateur de consulter son propre profil", async () => {
        const response = await usersApi(userA.token).getUserByIdRaw({ id: userA.id });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data?.id).toBe(userA.id);
        expect(body.data?.email).toBe(userA.email);
        expect(body.data?.role).toBe("USER");
    });

    it("inclut les annonces, favoris et leur pagination", async () => {
        const response = await usersApi(userA.token).getUserByIdRaw({ id: userA.id });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(Array.isArray(body.data?.annonces)).toBe(true);
        expect(Array.isArray(body.data?.favoris)).toBe(true);
        expect(body.data?.pagination?.annonces).toMatchObject({ page: 1, limit: 10, total: 0 });
        expect(body.data?.pagination?.favoris).toMatchObject({ page: 1, limit: 10, total: 0 });
    });

    it("ne retourne jamais le passwordHash", async () => {
        const response = await usersApi(userA.token).getUserByIdRaw({ id: userA.id });

        // Le SDK ignore les champs inconnus : on lit donc le JSON brut.
        const rawBody = await response.raw.clone().json();

        expect(response.raw.status).toBe(200);
        expect(rawBody.data.passwordHash).toBeUndefined();
        expect(rawBody.data.password).toBeUndefined();
    });

    it("permet à un administrateur de consulter le profil d'un autre utilisateur", async () => {
        const token = await getAdminToken();
        const response = await usersApi(token).getUserByIdRaw({ id: userA.id });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.data?.id).toBe(userA.id);
    });

    it("respecte la pagination passée en query", async () => {
        const response = await usersApi(userA.token).getUserByIdRaw({
            id: userA.id,
            page: 2,
            limit: 5
        });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.data?.pagination?.annonces).toMatchObject({ page: 2, limit: 5 });
    });

    it("refuse l'accès au profil d'un autre utilisateur (IDOR)", async () => {
        await expectApiError(
            usersApi(userA.token).getUserById({ id: userB.id }),
            403,
            "FORBIDDEN"
        );
    });

    it("refuse l'accès sans authentification", async () => {
        await expectApiError(usersApi().getUserById({ id: userA.id }), 401);
    });

    it("retourne 404 pour un utilisateur inexistant (administrateur)", async () => {
        const token = await getAdminToken();

        // CUID valide mais inexistant.
        await expectApiError(
            usersApi(token).getUserById({ id: "cm0000000000000000000000x" }),
            404,
            "NOT_FOUND"
        );
    });

    it("retourne 400 pour un ID invalide", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).getUserById({ id: "pas-un-cuid" }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("retourne 400 pour une pagination invalide", async () => {
        await expectApiError(
            usersApi(userA.token).getUserById({ id: userA.id, limit: 1000 }),
            400
        );
    });
});