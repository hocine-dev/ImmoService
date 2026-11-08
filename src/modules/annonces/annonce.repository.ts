
import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

import type { AnnonceQuery, ChangeStatutAnnonceRequest, MesAnnoncesQuery, UpdateAnnonceInput } from "./annonce.schema.js";

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



    /**
     * Modifie une annonce existante.
     *
     * Protection IDOR :
     * - ADMIN : peut modifier toutes les annonces.
     * - AGENT : peut modifier uniquement ses annonces.
     *
     * Le contrôle du propriétaire est effectué directement
     * dans la condition SQL de mise à jour.
     */
    async function updateAnnonce(
        id: string,
        input: UpdateAnnonceInput,
        utilisateurId: string,
        isAdmin: boolean
    ) {
        const result = await prisma.annonce.updateMany({
            where: {
                id,

                // Pour un AGENT, l'auteur doit correspondre au JWT.
                // Pour un ADMIN, aucune restriction sur l'auteur.
                ...(isAdmin ? {} : { auteurId: utilisateurId })
            },

            data: {
                // Seuls les champs présents seront modifiés.
                titre: input.titre,
                description: input.description,
                type: input.type,
                typePropriete: input.typePropriete,
                ville: input.ville,
                surface: input.surface,
                chambres: input.chambres,
                etat: input.etat,

                // Conversion du prix en Decimal pour Prisma.
                prix: input.prix === undefined
                    ? undefined
                    : new Prisma.Decimal(input.prix),

                // Conversion ISO 8601 vers Date.
                dateDisponibilite: input.dateDisponibilite === undefined
                    ? undefined
                    : new Date(input.dateDisponibilite)
            }
        });

        /**
         * Aucune ligne modifiée :
         * - annonce inexistante ;
         * - ou annonce appartenant à un autre agent.
         *
         * Dans les deux cas, on retourne null.
         */
        if (result.count === 0) {
            return null;
        }

        // Récupérer l'annonce actualisée avec ses photos.
        const annonce = await prisma.annonce.findUnique({
            where: { id },
            include: { photos: true }
        });

        if (!annonce) {
            return null;
        }

        // Même format JSON que POST /annonces.
        return {
            ...annonce,
            prix: annonce.prix.toFixed(2),
            dateDisponibilite:
                annonce.dateDisponibilite?.toISOString() ?? null,
            createdAt: annonce.createdAt.toISOString(),
            updatedAt: annonce.updatedAt.toISOString()
        };
    }


    /**
     * Supprime une annonce si l'utilisateur est autorisé.
     *
     * Un AGENT peut supprimer uniquement ses annonces.
     * Un ADMIN peut supprimer toutes les annonces.
     *
     * La vérification du propriétaire est effectuée
     * directement dans la requête SQL via Prisma.
     */
    async function deleteAnnonce(
        id: string,
        utilisateurId: string,
        isAdmin: boolean
    ): Promise<boolean> {

        const result = await prisma.annonce.deleteMany({
            where: {
                id,

                // Pour un agent, imposer son identifiant.
                // Pour un administrateur, ne pas filtrer
                // sur le propriétaire.
                ...(isAdmin ? {} : { auteurId: utilisateurId })
            }
        });

        // count = 1 : annonce supprimée.
        // count = 0 : inexistante ou accès interdit.
        return result.count > 0;
    }



    /**
     * Publie ou dépublie une annonce.
     *
     * Si l'annonce possède déjà le statut demandé,
     * aucune ligne n'est modifiée dans PostgreSQL.
     *
     * Protection IDOR : un agent ne peut modifier
     * que ses propres annonces.
     */
    async function changeStatutAnnonce(
        id: string,
        statut: ChangeStatutAnnonceRequest["body"]["statut"],
        utilisateurId: string,
        isAdmin: boolean
    ) {
        // Modifier uniquement si le statut est différent.
        const result = await prisma.annonce.updateMany({
            where: {
                id,

                // Vérification du propriétaire pour un agent.
                ...(isAdmin ? {} : { auteurId: utilisateurId }),

                // Empêche une modification inutile.
                statut: { not: statut }
            },
            data: {
                statut
            }
        });

        // Récupérer l'annonce uniquement si elle est
        // accessible à cet utilisateur.
        const annonce = await prisma.annonce.findFirst({
            where: {
                id,
                ...(isAdmin ? {} : { auteurId: utilisateurId })
            },
            select: {
                id: true,
                statut: true,
                auteurId: true,
                updatedAt: true
            }
        });

        // Aucune annonce trouvée ou accessible : null.
        // Si le statut était déjà correct, l'annonce
        // est retournée sans avoir été modifiée.
        return annonce;
    }


    /**
     * Récupère les annonces d'un utilisateur authentifié.
     *
     * Contrairement à GET /annonces, cette méthode
     * retourne aussi les annonces en brouillon.
     *
     * Le filtre auteurId est obligatoire :
     * il provient du JWT et jamais du client.
     */
    async function findMesAnnonces(
        query: MesAnnoncesQuery,
        auteurId: string
    ) {
        const { page, limit, ville, type, prixMax, statut } = query;

        // Construire les filtres Prisma.
        const where = {
            // Sécurité : uniquement les annonces du propriétaire.
            auteurId,

            // Filtres facultatifs.
            ...(statut !== undefined ? { statut } : {}),

            ...(ville !== undefined ? {
                ville: {
                    contains: ville,
                    mode: "insensitive" as const
                }
            } : {}),

            ...(type !== undefined ? { type } : {}),

            ...(prixMax !== undefined ? {
                prix: { lte: prixMax }
            } : {})
        };

        // Compter les annonces et récupérer la page demandée.
        const [total, annonces] = await Promise.all([
            prisma.annonce.count({ where }),

            prisma.annonce.findMany({
                where,

                skip: (page - 1) * limit,
                take: limit,

                // Ordre stable pour la pagination.
                orderBy: [
                    { createdAt: "desc" },
                    { id: "asc" }
                ],

                include: {
                    photos: true
                }
            })
        ]);

        // Convertir les valeurs Prisma en données JSON.
        return {
            annonces: annonces.map(annonce => ({
                ...annonce,
                prix: annonce.prix.toFixed(2),
                dateDisponibilite:
                    annonce.dateDisponibilite.toISOString(),
                createdAt: annonce.createdAt.toISOString(),
                updatedAt: annonce.updatedAt.toISOString()
            })),
            total
        };
    }


    return {
        findPublishedPage,
        findPublishedById,
        createAnnonce,
        updateAnnonce,
        deleteAnnonce,
        changeStatutAnnonce,
        findMesAnnonces
    };
}
