import DataLoader from "dataloader";

import type { PrismaClient } from "../generated/prisma/client.js";

/**
 * Seules les informations publiques de l'auteur
 * sont exposées à GraphQL.
 */
export type AuteurPublic = {
    id: string;
    name: string;
};

/**
 * Crée un DataLoader pour la relation Annonce.auteur.
 *
 * Chaque clé correspond à l'identifiant d'une annonce.
 * Plusieurs annonces sont chargées en une opération groupée.
 */
export function createAuteurLoader(prisma: PrismaClient) {
    return new DataLoader<string, AuteurPublic | null>(
        async (annonceIds) => {

            // Une recherche groupée plutôt qu'une recherche
            // SQL distincte pour chaque annonce.
            const annonces = await prisma.annonce.findMany({
                where: {
                    id: {
                        in: [...annonceIds]
                    }
                },

                select: {
                    id: true,

                    auteur: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // Indexer les auteurs par identifiant d'annonce.
            const auteursParAnnonce = new Map(
                annonces.map(annonce => [
                    annonce.id,
                    annonce.auteur
                ])
            );

            // DataLoader exige le même ordre que les clés reçues.
            return annonceIds.map(
                id => auteursParAnnonce.get(id) ?? null
            );
        }
    );
}
