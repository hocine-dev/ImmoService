import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express from "express";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createGraphqlAnnonceHandler } from "../../../src/graphql/annonces.js";

let prisma: PrismaClient;
let server: Server;
let url: string;

let nombreSQL = 0;
let idsTemporaires: string[] = [];

/**
 * ÉTAPE 1 : PRÉPARATION
 *
 * On utilise la base de test et un serveur temporaire.
 * On prépare 20 annonces publiées pour la comparaison.
 */
beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL_TEST manquante");
    }

    // Prisma utilise la base de test.
    // On active les événements pour compter les requêtes SQL.
    prisma = new PrismaClient({
        adapter: new PrismaPg({
            connectionString: databaseUrl
        }),
        log: [{ level: "query", emit: "event" }] as never
    });

    // Chaque requête SQL exécutée augmente le compteur.
    (prisma.$on as unknown as (
        eventType: "query",
        callback: () => void
    ) => void)("query", () => {
        nombreSQL++;
    });

    // Récupérer un agent existant dans le seed.
    const agent = await prisma.user.findFirst({
        where: { role: "AGENT" },
        select: { id: true }
    });

    if (!agent) {
        throw new Error("Aucun agent dans la base de test");
    }

    // Le seed contient 12 annonces publiées.
    // On crée seulement les annonces manquantes pour arriver à 20.
    const total = await prisma.annonce.count({
        where: { statut: "PUBLIE" }
    });

    const manquantes = Math.max(0, 20 - total);

    idsTemporaires = Array.from(
        { length: manquantes },
        () => `test-n1-${randomUUID()}`
    );

    if (idsTemporaires.length > 0) {
        await prisma.annonce.createMany({
            data: idsTemporaires.map(id => ({
                id,
                titre: "Annonce test DataLoader",
                description: "Mesure du problème N+1",
                type: "VENTE",
                typePropriete: "APPARTEMENT",
                statut: "PUBLIE",
                prix: "185000.00",
                ville: "Le Havre",
                surface: 75,
                chambres: 2,
                auteurId: agent.id
            }))
        });
    }

    // Petit serveur temporaire pour utiliser notre vrai handler GraphQL.
    // Il utilise le même Prisma que notre compteur SQL.
    const app = express();
    app.use(express.json());
    app.all("/graphql", createGraphqlAnnonceHandler(prisma));

    server = await new Promise<Server>(resolve => {
        const instance = app.listen(0, "127.0.0.1", () => {
            resolve(instance);
        });
    });

    const adresse = server.address();

    if (!adresse || typeof adresse === "string") {
        throw new Error("Port du serveur introuvable");
    }

    url = `http://127.0.0.1:${adresse.port}/graphql`;
});

/**
 * ÉTAPE 2 : NETTOYAGE
 *
 * Après le test :
 * - arrêter le serveur temporaire ;
 * - supprimer uniquement nos annonces de test ;
 * - fermer Prisma.
 */
afterAll(async () => {
    if (server) {
        await new Promise<void>(resolve => {
            server.close(() => resolve());
        });
    }

    if (prisma) {
        try {
            if (idsTemporaires.length > 0) {
                await prisma.annonce.deleteMany({
                    where: {
                        id: { in: idsTemporaires }
                    }
                });
            }
        } finally {
            await prisma.$disconnect();
        }
    }
});

/**
 * ÉTAPE 3 : MESURE
 *
 * Exécuter GraphQL avec N annonces et leurs auteurs.
 * Compter uniquement les requêtes SQL de cet appel.
 */
async function compterSQL(limit: number): Promise<number> {
    // Remettre le compteur à zéro avant chaque mesure.
    nombreSQL = 0;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `
                query ($limit: Int!) {
                    annonces(limit: $limit) {
                        data {
                            id
                            auteur {
                                id
                                name
                            }
                        }
                    }
                }
            `,
            variables: { limit }
        })
    });

    const resultat = await response.json() as {
        data?: {
            annonces?: {
                data: Array<{
                    auteur: { id: string; name: string };
                }>;
            };
        };
        errors?: unknown[];
    };

    // Vérifier que GraphQL a vraiment retourné N annonces.
    expect(response.status).toBe(200);
    expect(resultat.errors).toBeUndefined();
    expect(resultat.data?.annonces?.data).toHaveLength(limit);

    // Vérifier que les auteurs ont réellement été chargés.
    expect(
        resultat.data!.annonces!.data.every(
            annonce => Boolean(annonce.auteur?.id)
        )
    ).toBe(true);

    return nombreSQL;
}

/**
 * ÉTAPE 4 : VÉRIFICATION N+1
 *
 * Avec DataLoader, le nombre de requêtes SQL
 * doit rester identique pour 2 et 20 annonces.
 */
it("évite N+1 pour la relation Annonce.auteur", async () => {
    const sql2 = await compterSQL(2);
    const sql20 = await compterSQL(20);

    console.log("SQL pour 2 annonces :", sql2);
    console.log("SQL pour 20 annonces :", sql20);

    // Vérifier que nous avons bien compté des requêtes.
    expect(sql2).toBeGreaterThan(0);

    // Vérifier l'absence de croissance N+1.
    expect(sql20).toBe(sql2);
});
