import { expect } from "vitest";
import { AnnoncesApi, Configuration } from "../../sdk/index.js";

export const baseUrl = "http://localhost:3002";

// Client généré depuis OpenAPI, connecté au serveur de test.
export const api = new AnnoncesApi(
    new Configuration({
        basePath: baseUrl
    })
);

/**
 * Récupère un JWT avec les identifiants d’un compte préparé par le seed.
 */
export async function getToken(email: string | undefined, password: string | undefined) {
    const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
    });

    expect(response.status).toBe(200);

    const body = await response.json() as {
        data?: { token?: string };
    };

    expect(body.data?.token).toBeTruthy();
    return body.data!.token!;
}

export async function getAgentToken() {
    return getToken(
        process.env.SEED_AGENT_1_EMAIL,
        process.env.SEED_AGENT_1_PASSWORD
    );
}

export const sdkPost = (token?: string) =>
    new AnnoncesApi(new Configuration({
        basePath: baseUrl,
        accessToken: token
    }));

export const annonceValide = {
    titre: "Appartement test E2E",
    description: "Appartement avec balcon au Havre",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
} as const;