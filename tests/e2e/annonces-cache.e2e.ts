import { describe, it, expect } from "vitest";
import { AnnoncesApi, Configuration } from "../../sdk/index.js";

const baseUrl = "http://localhost:3002";

async function getToken(email: string | undefined, password: string | undefined) {
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

async function getAgentToken() {
    return getToken(
        process.env.SEED_AGENT_1_EMAIL,
        process.env.SEED_AGENT_1_PASSWORD
    );
}

const sdkPost = (token?: string) =>
    new AnnoncesApi(new Configuration({
        basePath: baseUrl,
        accessToken: token
    }));

const annonceValide = {
    titre: "Appartement test E2E",
    description: "Appartement avec balcon au Havre",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: "185000.00",
    ville: "Le Havre",
    surface: 75,
    chambres: 2
} as const;

describe("Cache HTTP REST - Annonces", () => {

    it("retourne 304 lorsque l'ETag est inchangé", async () => {
        const url = `${baseUrl}/annonces?page=1&limit=10`;

        // Première requête : réponse JSON normale.
        const premiere = await fetch(url);

        expect(premiere.status).toBe(200);
        expect(premiere.headers.get("cache-control"))
            .toBe("public, max-age=0, must-revalidate");

        const etag = premiere.headers.get("etag");
        expect(etag).toBeTruthy();

        // Consommer la première réponse.
        await premiere.json();

        // Deuxième requête : demander une revalidation.
        const seconde = await fetch(url, {
            headers: {
                "If-None-Match": etag!,
                "Cache-Control": "max-age=0"

            }
        });

        // Aucun JSON à retransférer.
        expect(seconde.status).toBe(304);
        expect(seconde.headers.get("etag")).toBe(etag);
        expect(await seconde.text()).toBe("");
    });

    it("change l'ETag lorsqu'une annonce devient publique", async () => {
        const token = await getAgentToken();
        const url = `${baseUrl}/annonces?limit=100`;

        // État initial de la liste publique.
        const avant = await fetch(url);
        expect(avant.status).toBe(200);

        const ancienEtag = avant.headers.get("etag");
        expect(ancienEtag).toBeTruthy();

        // Créer une annonce privée pour ce test.
        const annonce = await sdkPost(token).createAnnonce({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Test cache ${Date.now()}`
            }
        });

        try {
            // Rendre l'annonce publique.
            const publication = await fetch(
                `${baseUrl}/annonces/${annonce.id}/statut`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        statut: "PUBLIE"
                    })
                }
            );

            expect(publication.status).toBe(200);
            expect(publication.headers.get("cache-control"))
                .toBe("no-store");

            // Le client tente de réutiliser son ancien ETag.
            const apres = await fetch(url, {
                headers: {
                    "If-None-Match": ancienEtag!
                }
            });

            // Le contenu a changé : réponse 200, pas 304.
            expect(apres.status).toBe(200);

            const nouvelEtag = apres.headers.get("etag");
            expect(nouvelEtag).toBeTruthy();
            expect(nouvelEtag).not.toBe(ancienEtag);

            const resultat = await apres.json();

            const ids = resultat.data.map(
                (item: { id: string }) => item.id
            );

            expect(ids).toContain(annonce.id);

        } finally {
            // Nettoyage, même si une assertion échoue.
            const suppression = await fetch(
                `${baseUrl}/annonces/${annonce.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            expect(suppression.status).toBe(204);
            expect(suppression.headers.get("cache-control"))
                .toBe("no-store");
        }
    });

    it("interdit le cache des annonces privées et des écritures", async () => {
        const token = await getAgentToken();

        const headers = {
            Authorization: `Bearer ${token}`
        };

        // Liste personnelle : cache interdit.
        const miennes = await fetch(
            `${baseUrl}/annonces/miennes`,
            { headers }
        );

        expect(miennes.status).toBe(200);
        expect(miennes.headers.get("cache-control"))
            .toBe("private, no-store");

        // Créer un brouillon.
        const creation = await sdkPost(token).createAnnonceRaw({
            createAnnonceInput: {
                ...annonceValide,
                titre: `Test cache privé ${Date.now()}`
            }
        });

        const annonce = await creation.value();

        try {
            expect(creation.raw.status).toBe(201);
            expect(creation.raw.headers.get("cache-control"))
                .toBe("no-store");

            const url = `${baseUrl}/annonces/${annonce.id}`;

            // Un brouillon accessible à l'auteur reste privé.
            const detail = await fetch(url, { headers });

            expect(detail.status).toBe(200);
            expect(detail.headers.get("cache-control"))
                .toBe("private, no-store");

            // Un visiteur ne peut pas le consulter.
            const visiteur = await fetch(url);

            expect(visiteur.status).toBe(404);
            expect(visiteur.headers.get("cache-control"))
                .toBe("private, no-store");

            // Une modification ne doit pas être stockée.
            const modification = await fetch(url, {
                method: "PATCH",
                headers: {
                    ...headers,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    titre: "Annonce modifiée"
                })
            });

            expect(modification.status).toBe(200);
            expect(modification.headers.get("cache-control"))
                .toBe("no-store");

        } finally {
            const suppression = await fetch(
                `${baseUrl}/annonces/${annonce.id}`,
                {
                    method: "DELETE",
                    headers
                }
            );

            expect(suppression.status).toBe(204);
            expect(suppression.headers.get("cache-control"))
                .toBe("no-store");
        }
    });

});
