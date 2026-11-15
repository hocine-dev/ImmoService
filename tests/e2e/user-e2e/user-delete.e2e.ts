import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AuthApi, Configuration, UsersApi } from "../../../sdk/index.js";


const baseUrl = "http://localhost:3002";

const usersApi = (token?: string) =>
    new UsersApi(new Configuration({ basePath: baseUrl, accessToken: token }));

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

const getAdminToken = () =>
    getToken(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);

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

async function createUser() {
    const email = uniqueEmail();
    const password = "motdepasse123";

    const response = await usersApi().registerUserRaw({
        createUserInput: { name: "Utilisateur E2E", email, password }
    });

    expect(response.raw.status).toBe(201);
    const body = await response.value();

    return { id: body.data!.id!, email, password };
}

// Nettoyage : ignore l'erreur si le compte n'existe déjà plus.
async function deleteAsAdmin(id: string) {
    const token = await getAdminToken();
    await usersApi(token).deleteUser({ id }).catch(() => undefined);
}

describe("DELETE /users/:id - Tests E2E", () => {

    it("permet à un utilisateur de supprimer son propre compte", async () => {
        const user = await createUser();
            try {
            const token = await getToken(user.email, user.password);
            const response = await usersApi(token).deleteUserRaw({ id: user.id });
            const body = await response.value();

            expect(response.raw.status).toBe(200);
            expect(body.success).toBe(true);

            // Le compte doit avoir disparu.
            const adminToken = await getAdminToken();
            
                await expectApiError(
                usersApi(adminToken).getUserById({ id: user.id }),
                404
            );
            }  finally {
            await deleteAsAdmin(user.id);
        }
            
       
    });

    it("permet à un administrateur de supprimer un autre utilisateur", async () => {
        const user = await createUser();

        try {
            const adminToken = await getAdminToken();
            const response = await usersApi(adminToken).deleteUserRaw({ id: user.id });

            expect(response.raw.status).toBe(200);

            await expectApiError(
                usersApi(adminToken).getUserById({ id: user.id }),
                404
            );
        } finally {
            await deleteAsAdmin(user.id);
        }
    });

    

    it("ne retourne pas le passwordHash dans la réponse", async () => {
        const user = await createUser();

        try {
            const adminToken = await getAdminToken();
            const response = await usersApi(adminToken).deleteUserRaw({ id: user.id });

            // Le SDK ignore les champs inconnus : on lit donc le texte brut.
            const text = await response.raw.text();

            expect(response.raw.status).toBe(200);
            expect(text).not.toContain("passwordHash");
        } finally {
            await deleteAsAdmin(user.id);
        }
    });
    
    it("empêche la connexion après suppression du compte", async () => {
        const user = await createUser();

        try {
            const token = await getToken(user.email, user.password);
            const response = await usersApi(token).deleteUserRaw({ id: user.id });
            expect(response.raw.status).toBe(200);

            await expectApiError(
                authApi.login({
                    loginInput: { email: user.email, password: user.password }
                }),
                401
            );
        } finally {
            await deleteAsAdmin(user.id);
        }
    });
    
    describe("contrôles d'accès", () => {
        let userA: { id: string; email: string; password: string };
        let userB: { id: string; email: string; password: string };

        beforeAll(async () => {
            userA = await createUser();
            userB = await createUser();
        });

        afterAll(async () => {
            if (userA?.id) await deleteAsAdmin(userA.id);
            if (userB?.id) await deleteAsAdmin(userB.id);
        });

        it("refuse la suppression d'un autre utilisateur (IDOR)", async () => {
            const token = await getToken(userA.email, userA.password);

            await expectApiError(
                usersApi(token).deleteUser({ id: userB.id }),
                403,
                "FORBIDDEN"
            );

            // Le compte ciblé doit toujours exister.
            const adminToken = await getAdminToken();
            const check = await usersApi(adminToken).getUserByIdRaw({ id: userB.id });
            expect(check.raw.status).toBe(200);
        });
       
        it("refuse la suppression sans authentification", async () => {
            await expectApiError(usersApi().deleteUser({ id: userA.id }), 401);

            const adminToken = await getAdminToken();
            const check = await usersApi(adminToken).getUserByIdRaw({ id: userA.id });
            expect(check.raw.status).toBe(200);
        });
    });
 
    it("retourne 404 pour un utilisateur inexistant (administrateur)", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).deleteUser({ id: "cm0000000000000000000000x" }),
            404,
            "NOT_FOUND"
        );
    });

    it("retourne 400 pour un ID invalide", async () => {
        const token = await getAdminToken();

        await expectApiError(
            usersApi(token).deleteUser({ id: "pas-un-cuid" }),
            400,
            "VALIDATION_ERROR"
        );
    })
});