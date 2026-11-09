import { describe, it, expect } from "vitest";

const BASE = "http://127.0.0.1:3002";

type GraphqlResponse = {
    data?: {
        changerStatutAnnonce?: {
            annonce: {
                id: string;
                statut: string;
                auteurId: string;
            } | null;
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
            titre: "Annonce E2E statut GraphQL",
            description: "Publication et dépublication GraphQL",
            type: "VENTE",
            typePropriete: "APPARTEMENT",
            prix: "185000.00",
            ville: "Le Havre",
            surface: 75,
            chambres: 2
        })
    });

    expect(response.status).toBe(201);

    const annonce = await response.json() as {
        id: string;
        statut: string;
    };

    expect(annonce.statut).toBe("BROUILLON");
    return annonce.id;
}

async function lireAnnonce(
    id: string,
    token: string
): Promise<Record<string, unknown>> {
    const response = await fetch(`${BASE}/annonces/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    expect(response.status).toBe(200);
    return await response.json() as Record<string, unknown>;
}

async function nettoyer(id: string, token: string) {
    const response = await fetch(`${BASE}/annonces/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    expect(response.status).toBe(204);
}

async function changerStatut(
    id: string,
    statut: string,
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
                mutation ChangerStatut(
                    $id: ID!
                    $statut: StatutAnnonce!
                ) {
                    changerStatutAnnonce(
                        id: $id
                        statut: $statut
                    ) {
                        annonce {
                            id
                            statut
                            auteurId
                        }
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
            variables: { id, statut }
        })
    });

    return await response.json() as GraphqlResponse;
}

describe("GraphQL - Mutation.changerStatutAnnonce", () => {

    it("autorise un AGENT à publier son brouillon", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const result = await changerStatut(id, "PUBLIE", agent);

            expect(result.errors).toBeUndefined();
            expect(result.data?.changerStatutAnnonce?.erreur)
                .toBeNull();
            expect(result.data?.changerStatutAnnonce?.annonce?.statut)
                .toBe("PUBLIE");

            const publicResponse = await fetch(`${BASE}/annonces/${id}`);
            expect(publicResponse.status).toBe(200);

            const annonce = await lireAnnonce(id, agent);
            expect(annonce.statut).toBe("PUBLIE");
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("autorise un AGENT à dépublier son annonce", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const publication = await changerStatut(id, "PUBLIE", agent);
            expect(publication.data?.changerStatutAnnonce?.annonce?.statut)
                .toBe("PUBLIE");

            const result = await changerStatut(id, "BROUILLON", agent);

            expect(result.errors).toBeUndefined();
            expect(result.data?.changerStatutAnnonce?.annonce?.statut)
                .toBe("BROUILLON");

            const publicResponse = await fetch(`${BASE}/annonces/${id}`);
            expect(publicResponse.status).toBe(404);

            const annonce = await lireAnnonce(id, agent);
            expect(annonce.statut).toBe("BROUILLON");
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("empêche un autre AGENT de publier (IDOR)", async () => {
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
            const result = await changerStatut(id, "PUBLIE", agent2);

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("NOT_FOUND");
            expect(result.data).toBeNull();

            const apres = await lireAnnonce(id, agent1);
            expect(apres).toEqual(avant);
        } finally {
            await nettoyer(id, agent1);
        }
    });

    it("autorise un ADMIN à publier l'annonce d'un agent", async () => {
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
            const result = await changerStatut(id, "PUBLIE", admin);

            expect(result.errors).toBeUndefined();
            expect(result.data?.changerStatutAnnonce?.annonce?.statut)
                .toBe("PUBLIE");

            const annonce = await lireAnnonce(id, agent);
            expect(annonce.statut).toBe("PUBLIE");
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("refuse le changement de statut pour un USER", async () => {
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
            const result = await changerStatut(id, "PUBLIE", user);

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("FORBIDDEN");
            expect(result.data).toBeNull();

            const annonce = await lireAnnonce(id, agent);
            expect(annonce.statut).toBe("BROUILLON");
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("refuse le changement de statut sans JWT", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent);

        try {
            const result = await changerStatut(id, "PUBLIE");

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("UNAUTHORIZED");
            expect(result.data).toBeNull();

            const annonce = await lireAnnonce(id, agent);
            expect(annonce.statut).toBe("BROUILLON");
        } finally {
            await nettoyer(id, agent);
        }
    });

    it("refuse un identifiant invalide avec Zod", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await changerStatut("   ", "PUBLIE", agent);

        expect(result.errors).toBeUndefined();
        expect(result.data?.changerStatutAnnonce?.annonce)
            .toBeNull();
        expect(result.data?.changerStatutAnnonce?.erreur?.code)
            .toBe("VALIDATION_ERROR");
    });

    it("retourne NOT_FOUND pour une annonce inexistante", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await changerStatut(
            "annonce-inexistante-999",
            "PUBLIE",
            agent
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("NOT_FOUND");
        expect(result.data).toBeNull();
    });

    it("rejette un statut non déclaré dans l'enum GraphQL", async () => {
        const agent = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await changerStatut(
            "demo-immo-annonce-01",
            "ARCHIVE",
            agent
        );

        expect(result.errors?.length).toBeGreaterThan(0);
        expect(result.data == null).toBe(true);
    });
});
