import { describe, it, expect } from "vitest";

const BASE = "http://127.0.0.1:3002";

type GraphqlResponse = {
    data?: {
        supprimerAnnonce?: {
            supprime: boolean;
            erreur: {
                code: string;
                details: Array<{
                    champ: string;
                    messages: string[];
                }>;
            } | null;
        } | null;
    } | null;
    errors?: Array<{
        message: string;
        extensions?: { code?: string };
    }>;
};

async function login(
    email?: string,
    password?: string
): Promise<string> {
    if (!email || !password) {
        throw new Error("Identifiants du seed manquants");
    }

    const response = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    expect(response.status).toBe(200);

    const body = await response.json() as {
        data?: { token?: string };
    };

    expect(body.data?.token).toBeTruthy();
    return body.data!.token!;
}

async function creerBrouillon(token: string): Promise<string> {
    const response = await fetch(`${BASE}/annonces`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            titre: "Annonce temporaire pour suppression GraphQL",
            description: "Test E2E de suppression sécurisée",
            type: "VENTE",
            typePropriete: "APPARTEMENT",
            prix: "185000.00",
            ville: "Le Havre",
            surface: 75,
            chambres: 2
        })
    });

    expect(response.status).toBe(201);

    const annonce = await response.json() as { id: string };
    expect(annonce.id).toBeTruthy();
    return annonce.id;
}

async function lireAnnonce(id: string, token: string) {
    const response = await fetch(`${BASE}/annonces/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    expect(response.status).toBe(200);
    return response.json();
}

async function nettoyer(id: string, token: string) {
    const response = await fetch(`${BASE}/annonces/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (response.status === 404) {
        return;
    }

    expect(response.status).toBe(200);

    const suppression = await fetch(`${BASE}/annonces/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    expect(suppression.status).toBe(204);
}

async function supprimerGraphql(
    id: string,
    token?: string
): Promise<GraphqlResponse> {
    const response = await fetch(`${BASE}/graphql`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {})
        },
        body: JSON.stringify({
            query: `
                mutation Supprimer($id: ID!) {
                    supprimerAnnonce(id: $id) {
                        supprime
                        erreur {
                            code
                            details {
                                champ
                                messages
                            }
                        }
                    }
                }
            `,
            variables: { id }
        })
    });

    return response.json() as Promise<GraphqlResponse>;
}

describe("GraphQL - Mutation.supprimerAnnonce", () => {

    it("autorise un AGENT à supprimer sa propre annonce", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const result = await supprimerGraphql(id, agent);

            expect(result.errors).toBeUndefined();
            expect(result.data?.supprimerAnnonce?.supprime)
                .toBe(true);
            expect(result.data?.supprimerAnnonce?.erreur)
                .toBeNull();

            const response = await fetch(
                `${BASE}/annonces/${id}`,
                {
                    headers: {
                        Authorization: `Bearer ${agent}`
                    }
                }
            );

            expect(response.status).toBe(404);
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("bloque la suppression par un autre AGENT (IDOR)", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const agent2 = await login(
            process.env.SEED_AGENT_2_EMAIL,
            process.env.SEED_AGENT_2_PASSWORD
        );

        const id = await creerBrouillon(agent1);

        try {
            const avant = await lireAnnonce(id, agent1);
            const result = await supprimerGraphql(id, agent2);

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("NOT_FOUND");
            expect(result.data).toBeNull();

            const apres = await lireAnnonce(id, agent1);
            expect(apres).toEqual(avant);
        } finally {
            await nettoyer(id, agent1);
        }
    });

    it("autorise un ADMIN à supprimer l'annonce d'un agent", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const admin = await login(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const result = await supprimerGraphql(id, admin);

            expect(result.errors).toBeUndefined();
            expect(result.data?.supprimerAnnonce?.supprime)
                .toBe(true);

            const response = await fetch(
                `${BASE}/annonces/${id}`,
                {
                    headers: {
                        Authorization: `Bearer ${agent}`
                    }
                }
            );

            expect(response.status).toBe(404);
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("refuse la suppression pour un USER", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const result = await supprimerGraphql(id, user);

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("FORBIDDEN");
            expect(result.data).toBeNull();

            const annonce = await lireAnnonce(id, agent);
            expect(annonce).toBeTruthy();
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("refuse la suppression sans JWT", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const result = await supprimerGraphql(id);

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("UNAUTHORIZED");
            expect(result.data).toBeNull();

            const annonce = await lireAnnonce(id, agent);
            expect(annonce).toBeTruthy();
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("refuse un identifiant invalide", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await supprimerGraphql("   ", agent);

        expect(result.errors).toBeUndefined();

        const payload = result.data?.supprimerAnnonce;

        expect(payload?.supprime).toBe(false);
        expect(payload?.erreur?.code)
            .toBe("VALIDATION_ERROR");
    });

    it("retourne NOT_FOUND pour une annonce inexistante", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await supprimerGraphql(
            "annonce-inexistante-999",
            agent
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("NOT_FOUND");
        expect(result.data).toBeNull();
    });
});
