
import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

import type { AnnonceQuery } from "./annonce.schema.js";

import type { CreateAnnonceInput } from "./annonce.schema.js";

/**
 * Repository des annonces.
 * Responsable exclusivement de l'accès aux données.
 */
export function createAnnonceRepository(
    prisma: PrismaClient
) {

    async function findPublishedPage(query: AnnonceQuery) {
        const { page, limit, ville, type, prixMax } = query;

        // 1. Filtre obligatoire : annonces publiées
        const where: Prisma.AnnonceWhereInput = {
            statut: "PUBLIE"
        };

        // 2. Filtre optionnel : ville
        if (ville !== undefined) {
            where.ville = {
                equals: ville,
                mode: "insensitive"
            };
        }

        // 3. Filtre optionnel : type de transaction
        if (type !== undefined) {
            where.type = type;
        }

        // 4. Filtre optionnel : prix maximal
        if (prixMax !== undefined) {
            where.prix = {
                lte: new Prisma.Decimal(String(prixMax))
            };
        }

        // 5. Nombre total d'annonces correspondantes
        const total = await prisma.annonce.count({
            where
        });

        // 6. Calcul de la pagination
        const skip = (page - 1) * limit;

        if (!Number.isSafeInteger(skip) || skip < 0) {
            throw new RangeError("Pagination invalide");
        }

        // Page vide : aucune autre requête nécessaire
        if (skip >= total) {
            return { annonces: [], total };
        }

        // 7. Récupération des annonces
        const result = await prisma.annonce.findMany({
            where,

            select: {
                id: true,
                titre: true,
                type: true,
                typePropriete: true,
                etat: true,
                prix: true,
                ville: true,
                surface: true,
                chambres: true,
                createdAt: true
            },

            orderBy: [
                { createdAt: "desc" },
                { id: "desc" }
            ],

            skip,
            take: limit
        });

        // 8. Conversion explicite des types pour l'API
        const annonces = result.map((annonce) => ({
            ...annonce,
            prix: annonce.prix.toFixed(2),
            createdAt: annonce.createdAt.toISOString()
        }));

        return {
            annonces,
            total
        };
    }

    /**
     * Recherche une annonce publiée à partir de son identifiant.
     * Retourne null si l'annonce n'existe pas ou est en brouillon.
     */
    async function findPublishedById(id: string) {
        const annonce = await prisma.annonce.findFirst({
            where: {
                id,
                statut: "PUBLIE"
            },
            include: {
                photos: true
            }
        });

        // Annonce inexistante ou non publiée
        if (!annonce) {
            return null;
        }

        // Conversion des types pour la réponse JSON
        return {
            ...annonce,
            prix: annonce.prix.toFixed(2),
            createdAt: annonce.createdAt.toISOString()
        };
    }


    /**
     * Crée une annonce pour un agent authentifié.
     * Toute nouvelle annonce est enregistrée en brouillon.
     */
    async function createAnnonce(
        input: CreateAnnonceInput,
        auteurId: string
    ) {
        const annonce = await prisma.annonce.create({
            data: {
                titre: input.titre,
                description: input.description,
                type: input.type,
                typePropriete: input.typePropriete,
                prix: new Prisma.Decimal(input.prix),
                ville: input.ville,
                surface: input.surface,
                chambres: input.chambres,

                // Champs facultatifs
                etat: input.etat,
                dateDisponibilite: input.dateDisponibilite
                    ? new Date(input.dateDisponibilite)
                    : undefined,

                // Champs contrôlés par le serveur
                statut: "BROUILLON",
                auteurId
            },
            include: {
                photos: true
            }
        });

        // Conversion des types Prisma pour la réponse JSON
        return {
            ...annonce,
            prix: annonce.prix.toFixed(2),
            dateDisponibilite: annonce.dateDisponibilite?.toISOString() ?? null,
            createdAt: annonce.createdAt.toISOString(),
            updatedAt: annonce.updatedAt.toISOString()
        };
    }


    return {
        findPublishedPage,
        findPublishedById,
        createAnnonce
    };
}
