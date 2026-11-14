
import { describe, it, expect } from "vitest";
import {
    AuthApi,
    Configuration,
    UsersApi,
    FavorisApi
} from "../../../sdk/index.js";

const baseUrl = "http://localhost:3002";
const annonceId = "demo-immo-annonce-01";

const authApi = new AuthApi(new Configuration({ basePath: baseUrl }));

const usersApi = (token?: string) =>
    new UsersApi(new Configuration({
        basePath: baseUrl,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }));

const favorisApi = (token?: string) =>
    new FavorisApi(new Configuration({
        basePath: baseUrl,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }));

const uniqueEmail = () =>
    `e2e.favori.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;

const utilisateurValide = {
    name: "Utilisateur Favori E2E",
    password: "motdepasse123"
};

async function getToken(email: string, password: string) {
    const response = await authApi.login({
        loginInput: { email, password }
    });

    expect(response.data.token).toBeTruthy();
    return response.data.token;
}

const getAdminToken = () =>
    getToken(
        process.env.SEED_ADMIN_EMAIL as string,
        process.env.SEED_ADMIN_PASSWORD as string
    );

async function createTestUser() {
    const email = uniqueEmail();

    const response = await usersApi().registerUserRaw({
        createUserInput: { ...utilisateurValide, email }
    });

    const body = await response.value();

    expect(response.raw.status).toBe(201);
    expect(body.data?.id).toBeTruthy();

    const token = await getToken(email, utilisateurValide.password);

    return {
        id: body.data!.id!,
        token
    };
}

async function deleteTestUser(id: string) {
    const adminToken = await getAdminToken();
    const response = await usersApi(adminToken).deleteUserRaw({ id });

    expect(response.raw.status).toBe(200);
}

async function expectApiError(
    promise: Promise<unknown>,
    status: number,
    code?: string
) {
    const error = (await promise.then(() => null, (e: unknown) => e)) as
        { response: Response } | null;

    expect(error, "la requête aurait dû être rejetée").not.toBeNull();
    expect(error!.response.status).toBe(status);

    if (!code) return undefined;

    const body = await error!.response.json();
    expect(body.error.code).toBe(code);

    return body;
}

describe("POST /favoris - Tests E2E", () => {

    it("ajoute une annonce aux favoris", async () => {
        const user = await createTestUser();

        try {
            const response = await 
            favorisApi(user.token).favorisPostRaw({
                favorisPostRequest: { annonceId }
            })
        

            expect(response.raw.status).toBe(201);
        } finally {
            await deleteTestUser(user.id);
        }
    });

    it("retourne 409 si l'annonce est déjà dans les favoris", async () => {
        const user = await createTestUser();

        try {
            const first = await favorisApi(user.token).favorisPostRaw({
                                favorisPostRequest: { annonceId }
                            });

            expect(first.raw.status).toBe(201);

            await expectApiError(
                favorisApi(user.token).favorisPost({
                    favorisPostRequest: { annonceId }
                }),
                409,
                "CONFLICT"
            );
        } finally {
            await deleteTestUser(user.id);
        }
    });

    it("retourne 404 si l'annonce n'existe pas", async () => {
        const user = await createTestUser();

        try {
            await expectApiError(
                favorisApi(user.token).favorisPost({
                    favorisPostRequest: {
                        annonceId: "cm000000000000000000000000"
                    }
                }),
                404,
                "NOT_FOUND"
            );
        } finally {
            await deleteTestUser(user.id);
        }
    });

    it("refuse une requête sans authentification", async () => {
        await expectApiError(
            favorisApi().favorisPost({
                favorisPostRequest: { annonceId }
            }),
            401
        );
    });

    it("refuse un body incomplet", async () => {
        const user = await createTestUser();

        try {
            await expectApiError(
                favorisApi(user.token).favorisPost({
                    favorisPostRequest: {} as never
                }),
                400
            );
        } finally {
            await deleteTestUser(user.id);
        }
    });
});
