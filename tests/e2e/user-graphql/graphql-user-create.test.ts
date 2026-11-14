
import { describe, it, expect } from "vitest";

const GRAPHQL_URL = "http://127.0.0.1:3002/graphql/users";

type GraphQLResult = {
    data?: {
        registerUser?: {
            user: {
                id: string;
                name: string;
                email: string;
                role: string;
            } | null;
            erreur: {
                code: string;
                message: string;
                details: {
                    champ: string;
                    messages: string[];
                }[];
            } | null;
        };
    };
    errors?: {
        message: string;
        extensions?: {
            code?: string;
        };
    }[];
};

async function graphql(query: string): Promise<GraphQLResult> {
    const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
    });

    return response.json() as Promise<GraphQLResult>;
}

function uniqueEmail() {
    return `user-e2e-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}@example.test`;
}

async function registerUser(
    name: string,
    email: string,
    password: string
) {
    const query = `
        mutation {
            registerUser(input: {
                name: "${name}"
                email: "${email}"
                password: "${password}"
            }) {
                user {
                    id
                    name
                    email
                    role
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
    `;

    return graphql(query);
}

describe("GraphQL User - Création", () => {

    it("crée un utilisateur avec des données valides", async () => {
        const email = uniqueEmail();

        const result = await registerUser(
            "Utilisateur E2E",
            email,
            "MotDePasse123!"
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.registerUser;

        expect(payload).toBeDefined();
        expect(payload?.erreur).toBeNull();

        expect(payload?.user).toMatchObject({
            name: "Utilisateur E2E",
            email,
            role: "USER",
        });

        expect(payload?.user?.id).toBeDefined();
    });

    it("refuse la création avec un email déjà utilisé", async () => {
        const email = uniqueEmail();

        const firstResult = await registerUser(
            "Premier utilisateur",
            email,
            "MotDePasse123!"
        );

        expect(firstResult.errors).toBeUndefined();
        expect(firstResult.data?.registerUser?.user).not.toBeNull();

        const secondResult = await registerUser(
            "Deuxième utilisateur",
            email,
            "MotDePasse123!"
        );

        expect(secondResult.errors).toBeUndefined();

        const payload = secondResult.data?.registerUser;

        expect(payload?.user).toBeNull();
        expect(payload?.erreur?.code).toBe("CONFLICT");
        expect(payload?.erreur?.message).toBe(
            "Cet email est déjà utilisé."
        );
    });

    it("refuse la création avec des données invalides", async () => {
        const result = await registerUser(
            "",
            "email-invalide",
            ""
        );

        expect(result.errors).toBeUndefined();

        const payload = result.data?.registerUser;

        expect(payload?.user).toBeNull();
        expect(payload?.erreur?.code).toBe("VALIDATION_ERROR");
        expect(payload?.erreur?.details.length).toBeGreaterThan(0);
    });
});
