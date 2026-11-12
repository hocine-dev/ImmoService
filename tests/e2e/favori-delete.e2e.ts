
import { describe, it, expect } from "vitest";
import {
    AuthApi,
    Configuration,
    UsersApi,
    FavorisApi
} from "../../sdk/index.js";

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
    `e2e.favori.delete.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;

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

async function addFavorite(token: string) {
    const response = await favorisApi(token).favorisPostRaw({
        favorisPostRequest: { annonceId }
    });

    expect(response.raw.status).toBe(201);
}

describe("DELETE /favoris/:annonceId - Tests E2E", () => {

    it("supprime une annonce des favoris", async () => {
        const user = await createTestUser();

        try {
            // Préparation : ajout du favori.
            await addFavorite(user.token);

            const response = await favorisApi(user.token).favorisAnnonceIdDeleteRaw({
                annonceId
            });

            expect(response.raw.status).toBe(200);

            const body = await response.value();
            expect(body.success).toBe(true);
        } finally {
            await deleteTestUser(user.id);
        }
    });

    it("retourne 404 si le favori n'existe pas", async () => {
        const user = await createTestUser();

        try {
            await expectApiError(
                favorisApi(user.token).favorisAnnonceIdDelete({
                    annonceId
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
            favorisApi().favorisAnnonceIdDelete({
                annonceId
            }),
            401
        );
    });

    it("refuse un identifiant d'annonce invalide", async () => {
        const user = await createTestUser();

        try {
            await expectApiError(
                favorisApi(user.token).favorisAnnonceIdDelete({
                    annonceId: "123"
                }),
                404,
                "NOT_FOUND"
            );
        } finally {
            await deleteTestUser(user.id);
        }
    });

    it("ne permet pas de supprimer le favori d'un autre utilisateur", async () => {
        const userA = await createTestUser();
        const userB = await createTestUser();

        try {
            // L'utilisateur A ajoute l'annonce à ses favoris.
            await addFavorite(userA.token);

            // L'utilisateur B ne possède pas ce favori.
            await expectApiError(
                favorisApi(userB.token).favorisAnnonceIdDelete({
                    annonceId
                }),
                404,
                "NOT_FOUND"
            );
        } finally {
            await deleteTestUser(userA.id);
            await deleteTestUser(userB.id);
        }
    });
});
