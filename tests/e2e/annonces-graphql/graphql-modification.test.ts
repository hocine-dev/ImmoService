import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:3002";

const annonceValide = {
    titre: "Annonce pour test GraphQL PATCH",
    description: "Test de modification et de sécurité IDOR",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
};

type ModificationResponse = {
    data?: {
        modifierAnnonce?: {
            annonce: {
                id: string;
                titre: string;
                prix: string;
                statut: string;
                auteurId: string;
            } | null;
            erreur: {
                code: string;
                message: string;
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
    email: string | undefined,
    password: string | undefined
): Promise<string> {
    if (!email || !password) {
        throw new Error("Identifiants du seed manquants");
    }

    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    });

    expect(response.status).toBe(200);

    const body = await response.json() as {
        data?: { token?: string };
    };

    if (!body.data?.token) {
        throw new Error("JWT absent de la réponse");
    }

    return body.data.token;
}

async function creerBrouillon(token: string): Promise<string> {
    const response = await fetch(`${BASE_URL}/annonces`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(annonceValide)
    });

    expect(response.status).toBe(201);

    const annonce = await response.json() as {
        id: string;
    };

    expect(annonce.id).toBeTruthy();

    return annonce.id;
}

async function lireAnnonce(
    id: string,
    token: string
): Promise<Record<string, unknown>> {
    const response = await fetch(`${BASE_URL}/annonces/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    expect(response.status).toBe(200);

    return await response.json() as Record<string, unknown>;
}

async function supprimerAnnonce(
    id: string,
    token: string
): Promise<void> {
    const response = await fetch(
        `${BASE_URL}/annonces/${id}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    expect(response.status).toBe(204);
}

async function modifierAnnonce(
    id: string,
    input: Record<string, unknown>,
    token?: string
): Promise<ModificationResponse> {
    const response = await fetch(`${BASE_URL}/graphql`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {})
        },
        body: JSON.stringify({
            query: `
                mutation Modifier(
                    $id: ID!
                    $input: ModifierAnnonceInput!
                ) {
                    modifierAnnonce(id: $id, input: $input) {
                        annonce {
                            id
                            titre
                            prix
                            statut
                            auteurId
                        }
                        erreur {
                            code
                            message
                            details {
                                champ
                                messages
                            }
                        }
                    }
                }
            `,
            variables: { id, input }
        })
    });

    return await response.json() as ModificationResponse;
}

describe("GraphQL - Mutation.modifierAnnonce", () => {

    it("autorise un AGENT à modifier sa propre annonce", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent1);

        try {
            const result = await modifierAnnonce(
                id,
                {
                    titre: "Titre modifié par GraphQL",
                    prix: "200000.00"
                },
                agent1
            );

            expect(result.errors).toBeUndefined();

            const payload = result.data?.modifierAnnonce;

            expect(payload?.erreur).toBeNull();
            expect(payload?.annonce?.id).toBe(id);
            expect(payload?.annonce?.titre)
                .toBe("Titre modifié par GraphQL");
            expect(payload?.annonce?.prix)
                .toBe("200000.00");

            const annonce = await lireAnnonce(id, agent1);
            expect(annonce.titre)
                .toBe("Titre modifié par GraphQL");
            expect(annonce.prix).toBe("200000.00");

        } finally {
            await supprimerAnnonce(id, agent1);
        }
    });

    it("bloque la modification par un autre AGENT (IDOR)", async () => {
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

            const result = await modifierAnnonce(
                id,
                { titre: "Modification IDOR interdite" },
                agent2
            );

            expect(result.errors?.[0]?.extensions?.code)
                .toBe("NOT_FOUND");
            expect(result.data).toBeNull();

            const apres = await lireAnnonce(id, agent1);
            expect(apres).toEqual(avant);

        } finally {
            await supprimerAnnonce(id, agent1);
        }
    });

    it("autorise un ADMIN à modifier l'annonce d'un agent", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const admin = await login(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        const id = await creerBrouillon(agent1);

        try {
            const result = await modifierAnnonce(
                id,
                { prix: "250000.00" },
                admin
            );

            expect(result.errors).toBeUndefined();
            expect(result.data?.modifierAnnonce?.erreur)
                .toBeNull();
            expect(result.data?.modifierAnnonce?.annonce?.prix)
                .toBe("250000.00");

            const annonce = await lireAnnonce(id, agent1);
            expect(annonce.prix).toBe("250000.00");

        } finally {
            await supprimerAnnonce(id, agent1);
        }
    });

    it("refuse la modification pour un USER", async () => {
        const user = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const result = await modifierAnnonce(
            "demo-immo-annonce-01",
            { titre: "Modification interdite" },
            user
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("FORBIDDEN");
        expect(result.data).toBeNull();
    });

    it("refuse la modification sans JWT", async () => {
        const result = await modifierAnnonce(
            "demo-immo-annonce-01",
            { titre: "Modification anonyme" }
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("UNAUTHORIZED");
        expect(result.data).toBeNull();
    });

    it("refuse un prix négatif avec une erreur de validation", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const id = await creerBrouillon(agent1);

        try {
            const avant = await lireAnnonce(id, agent1);

            const result = await modifierAnnonce(
                id,
                { prix: "-100" },
                agent1
            );

            expect(result.errors).toBeUndefined();

            const payload = result.data?.modifierAnnonce;

            expect(payload?.annonce).toBeNull();
            expect(payload?.erreur?.code)
                .toBe("VALIDATION_ERROR");
            expect(
                payload?.erreur?.details.some(
                    detail => detail.champ === "prix"
                )
            ).toBe(true);

            const apres = await lireAnnonce(id, agent1);
            expect(apres).toEqual(avant);

        } finally {
            await supprimerAnnonce(id, agent1);
        }
    });

    it("refuse une modification sans aucun champ", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await modifierAnnonce(
            "demo-immo-annonce-01",
            {},
            agent1
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.modifierAnnonce;

        expect(payload?.annonce).toBeNull();
        expect(payload?.erreur?.code)
            .toBe("VALIDATION_ERROR");
    });

    it("retourne NOT_FOUND pour une annonce inexistante", async () => {
        const agent1 = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await modifierAnnonce(
            "annonce-inexistante-999",
            { titre: "Nouveau titre" },
            agent1
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("NOT_FOUND");
        expect(result.data).toBeNull();
    });
});
