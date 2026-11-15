import { describe, it, expect } from "vitest";
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

const getAdminToken = () =>
    getToken(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);

/**
 * Vérifie qu'une requête SDK est rejetée avec le statut attendu.
 * Retourne le body d'erreur pour d'éventuelles assertions supplémentaires.
 */
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

// Nettoyage : suppression du compte créé, avec le compte administrateur.
async function deleteAsAdmin(id: string) {
    const token = await getAdminToken();
    const suppression = await usersApi(token).deleteUserRaw({ id });
    expect(suppression.raw.status).toBe(200);
}

const utilisateurValide = {
    name: "Utilisateur E2E",
    password: "motdepasse123"
};

describe("POST /users/register - Tests E2E", () => {

    it("crée un utilisateur avec le rôle USER", async () => {
        const email = uniqueEmail();

        const response = await usersApi().registerUserRaw({
            createUserInput: { ...utilisateurValide, email }
        });

        const body = await response.value();

        try {
            expect(response.raw.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data?.id).toBeTruthy();
            expect(body.data?.email).toBe(email);
            expect(body.data?.role).toBe("USER");
        } finally {
            if (body.data?.id) await deleteAsAdmin(body.data.id);
        }
    });
    
    it("ne retourne jamais le passwordHash", async () => {
        const response = await usersApi().registerUserRaw({
            createUserInput: { ...utilisateurValide, email: uniqueEmail() }
        });

        // Le SDK ignore les champs inconnus : on lit donc le JSON brut.
        const rawBody = await response.raw.clone().json();
        const body = await response.value();

        try {
            expect(response.raw.status).toBe(201);
            expect(rawBody.data.passwordHash).toBeUndefined();
            expect(rawBody.data.password).toBeUndefined();
        } finally {
            if (body.data?.id) await deleteAsAdmin(body.data.id);
        }
    });
    
    it("ignore le rôle ADMIN envoyé dans le body (anti auto-promotion)", async () => {
        
        const response = await usersApi().registerUserRaw({
            createUserInput: {
                ...utilisateurValide,
                email: uniqueEmail(),
                role: "ADMIN"
            } as never
        });

        const body = await response.value();

        try {
            expect(response.raw.status).toBe(201);
            expect(body.data?.role).toBe("USER");
        } finally {
            if (body.data?.id) await deleteAsAdmin(body.data.id);
        }
    });
   
    it("permet de se connecter avec le compte créé", async () => {
        const email = uniqueEmail();

        const response = await usersApi().registerUserRaw({
            createUserInput: { ...utilisateurValide, email }
        });

        const body = await response.value();

        try {
            expect(response.raw.status).toBe(201);

            const loginResponse = await authApi.loginRaw({
                loginInput: { email, password: utilisateurValide.password }
            });

            expect(loginResponse.raw.status).toBe(200);
        } finally {
            if (body.data?.id) await deleteAsAdmin(body.data.id);
        }
    });
     
    it("retourne 409 si l'email existe déjà", async () => {
        const email = uniqueEmail();

        const first = await usersApi().registerUserRaw({
            createUserInput: { ...utilisateurValide, email }
        });
        const firstBody = await first.value();

        try {
            expect(first.raw.status).toBe(201);

            const body = await expectApiError(
                usersApi().registerUser({
                    createUserInput: { ...utilisateurValide, email }
                }),
                409,
                "CONFLICT"
            );

            expect(body.error.details.email).toBeDefined();
        } finally {
            if (firstBody.data?.id) await deleteAsAdmin(firstBody.data.id);
        }
    });

    it("refuse un email invalide", async () => {
        const body = await expectApiError(
            usersApi().registerUser({
                createUserInput: { ...utilisateurValide, email: "pas-un-email" }
            }),
            400,
            "VALIDATION_ERROR"
        );

        expect(body.error.details.email).toBeDefined();
    });

    it("refuse un mot de passe trop court", async () => {
        await expectApiError(
            usersApi().registerUser({
                createUserInput: {
                    ...utilisateurValide,
                    email: uniqueEmail(),
                    password: "123"
                }
            }),
            400,
            "VALIDATION_ERROR"
        );
    });
    
    it("refuse un nom trop court", async () => {
        await expectApiError(
            usersApi().registerUser({
                createUserInput: {
                    ...utilisateurValide,
                    email: uniqueEmail(),
                    name: "A"
                }
            }),
            400
        );
    });

    it("refuse un body incomplet", async () => {
        await expectApiError(
            usersApi().registerUser({ createUserInput: {} as never }),
            400
        );
    });

    
});