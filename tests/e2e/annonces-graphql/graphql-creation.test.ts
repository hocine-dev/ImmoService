import { describe, it, expect } from "vitest";

const BASE_URL = "http://127.0.0.1:3002";

/**
 * Données valides communes à tous les tests.
 * Une mutation réussie doit créer un brouillon.
 */
const annonceValide = {
    titre: "Appartement test GraphQL",
    description: "Annonce créée pendant les tests E2E",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
};

type CreationResponse = {
    data?: {
        creerAnnonce?: {
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
        };
    } | null;
    errors?: Array<{
        message: string;
        extensions?: {
            code?: string;
        };
    }>;
};

/**
 * Obtient un JWT réel depuis le module REST existant.
 * Aucune création manuelle de token.
 */
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

/**
 * Exécute la mutation de création avec des variables
 * GraphQL, ce qui évite de construire une requête
 * en concaténant les données utilisateur.
 */
async function creerAnnonceGraphql(
    input: Record<string, unknown>,
    token?: string
): Promise<CreationResponse> {

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
                mutation Creer($input: CreerAnnonceInput!) {
                    creerAnnonce(input: $input) {
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
            variables: { input }
        })
    });

    return await response.json() as CreationResponse;
}

/**
 * Nettoie la base E2E après une création.
 * On utilise la route REST déjà testée.
 */
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

describe("GraphQL - Mutation.creerAnnonce", () => {

    it("autorise un AGENT à créer un brouillon", async () => {
        const token = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await creerAnnonceGraphql(
            annonceValide,
            token
        );

        const payload = result.data?.creerAnnonce;
        const annonce = payload?.annonce;

        try {
            expect(result.errors).toBeUndefined();
            expect(payload?.erreur).toBeNull();

            expect(annonce?.id).toBeTruthy();
            expect(annonce?.titre).toBe(annonceValide.titre);
            expect(annonce?.prix).toBe("185000.00");
            expect(annonce?.statut).toBe("BROUILLON");
            expect(annonce?.auteurId).toBeTruthy();
        } finally {
            if (annonce?.id) {
                await supprimerAnnonce(annonce.id, token);
            }
        }
    });

    it("autorise un ADMIN à créer une annonce", async () => {
        const token = await login(
            process.env.SEED_ADMIN_EMAIL,
            process.env.SEED_ADMIN_PASSWORD
        );

        const result = await creerAnnonceGraphql(
            annonceValide,
            token
        );

        const payload = result.data?.creerAnnonce;
        const annonce = payload?.annonce;

        try {
            expect(result.errors).toBeUndefined();
            expect(payload?.erreur).toBeNull();
            expect(annonce?.id).toBeTruthy();
            expect(annonce?.statut).toBe("BROUILLON");
        } finally {
            if (annonce?.id) {
                await supprimerAnnonce(annonce.id, token);
            }
        }
    });

    it("refuse la création pour un USER", async () => {
        const token = await login(
            process.env.SEED_USER_1_EMAIL,
            process.env.SEED_USER_1_PASSWORD
        );

        const result = await creerAnnonceGraphql(
            annonceValide,
            token
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("FORBIDDEN");

        expect(result.data).toBeNull();
    });

    it("refuse la création sans JWT", async () => {
        const result = await creerAnnonceGraphql(
            annonceValide
        );

        expect(result.errors?.[0]?.extensions?.code)
            .toBe("UNAUTHORIZED");

        expect(result.data).toBeNull();
    });

    it("refuse un prix négatif avec une erreur de validation", async () => {
        const token = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await creerAnnonceGraphql(
            {
                ...annonceValide,
                prix: "-100"
            },
            token
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.creerAnnonce;

        expect(payload?.annonce).toBeNull();
        expect(payload?.erreur?.code)
            .toBe("VALIDATION_ERROR");

        expect(
            payload?.erreur?.details.some(
                detail => detail.champ === "prix"
            )
        ).toBe(true);
    });

    it("empêche le client de choisir auteurId", async () => {
        const token = await login(
            process.env.SEED_AGENT_1_EMAIL,
            process.env.SEED_AGENT_1_PASSWORD
        );

        const result = await creerAnnonceGraphql(
            {
                ...annonceValide,
                auteurId: "identifiant-usurpe"
            },
            token
        );

        // Le champ auteurId n'existe pas
        // dans CreerAnnonceInput.
        expect(result.errors?.length).toBeGreaterThan(0);
        expect(result.data?.creerAnnonce).toBeUndefined();
    });
});
