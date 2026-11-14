import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AuthApi, Configuration, UsersApi } from "../../../sdk/index.js";

const baseUrl = "http://localhost:3002";

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

describe("PUT /users/:id - Tests E2E", () => {
    let userA: TestUser;
    let userB: TestUser;

    beforeAll(async () => {
        userA = await createUser();
        userB = await createUser();
    });

    afterAll(async () => {
        if (userA?.id) await deleteAsAdmin(userA.id);
        if (userB?.id) await deleteAsAdmin(userB.id);
    });

    it("permet à un utilisateur de modifier son propre nom", async () => {
        const response = await usersApi(userA.token).updateUserRaw({
            id: userA.id,
            updateUserInput: { name: "Nouveau Nom" }
        });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data?.id).toBe(userA.id);
        expect(body.data?.name).toBe("Nouveau Nom");
    });

    it("ne retourne jamais le passwordHash", async () => {
        const response = await usersApi(userA.token).updateUserRaw({
            id: userA.id,
            updateUserInput: { name: "Nom Sans Hash" }
        });

        // Le SDK ignore les champs inconnus : on lit donc le JSON brut.
        const rawBody = await response.raw.clone().json();

        expect(response.raw.status).toBe(200);
        expect(rawBody.data.passwordHash).toBeUndefined();
    });

    it("persiste la modification (vérifiée par un GET)", async () => {
        await usersApi(userA.token).updateUser({
            id: userA.id,
            updateUserInput: { name: "Nom Persisté" }
        });

        const profil = await usersApi(userA.token).getUserById({ id: userA.id });

        expect(profil.data?.name).toBe("Nom Persisté");
    });

    it("ignore le rôle envoyé par un utilisateur standard (anti auto-promotion)", async () => {
        const response = await usersApi(userA.token).updateUserRaw({
            id: userA.id,
            updateUserInput: { role: "ADMIN" }
        });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.data?.role).toBe("USER");
    });

    it("permet à un administrateur de modifier le rôle d'un utilisateur", async () => {
        const token = await getAdminToken();

        const response = await usersApi(token).updateUserRaw({
            id: userB.id,
            updateUserInput: { role: "AGENT" }
        });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.data?.role).toBe("AGENT");
    });

    it("permet à un administrateur de modifier le profil d'un autre utilisateur", async () => {
        const token = await getAdminToken();

        const response = await usersApi(token).updateUserRaw({
            id: userA.id,
            updateUserInput: { name: "Modifié Par Admin" }
        });
        const body = await response.value();

        expect(response.raw.status).toBe(200);
        expect(body.data?.name).toBe("Modifié Par Admin");
    });

    it("refuse la modification du profil d'un autre utilisateur (IDOR)", async () => {
        await expectApiError(
            usersApi(userA.token).updateUser({
                id: userB.id,
                updateUserInput: { name: "Pirate" }
            }),
            403,
            "FORBIDDEN"
        );
    });

    it("refuse la modification sans authentification", async () => {
        await expectApiError(
            usersApi().updateUser({
                id: userA.id,
                updateUserInput: { name: "Anonyme" }
            }),
            401
        );
    });

    it("retourne 404 pour un utilisateur inexistant (administrateur)", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).updateUser({
                id: "cm0000000000000000000000x",
                updateUserInput: { name: "Fantôme" }
            }),
            404,
            "NOT_FOUND"
        );
    });

    it("retourne 400 pour un ID invalide", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).updateUser({
                id: "pas-un-cuid",
                updateUserInput: { name: "Test" }
            }),
            400,
            "VALIDATION_ERROR"
        );
    });

    it("refuse un email invalide", async () => {
        await expectApiError(
            usersApi(userA.token).updateUser({
                id: userA.id,
                updateUserInput: { email: "pas-un-email" }
            }),
            400
        );
    });

    it("refuse un nom trop court", async () => {
        await expectApiError(
            usersApi(userA.token).updateUser({
                id: userA.id,
                updateUserInput: { name: "A" }
            }),
            400
        );
    });

    it("refuse un rôle inconnu", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).updateUser({
                id: userA.id,
                updateUserInput: { role: "SUPERADMIN" as never }
            }),
            400
        );
    });
});