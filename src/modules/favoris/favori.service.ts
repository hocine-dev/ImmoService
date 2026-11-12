
import type { PrismaClient } from "../../generated/prisma/client.js";

type CreateFavoriData = {
  annonceId: string;
};

export function createFavoriService(prisma: PrismaClient) {
  return {
    // CREATE : Ajouter une annonce aux favoris
    async createFavori(userId: string, data: CreateFavoriData) {
      // Vérifier si l'annonce existe
      const annonce = await prisma.annonce.findUnique({
        where: { id: data.annonceId },
        select: { id: true },
      });

      if (!annonce) {
        return { error: "ANNONCE_NOT_FOUND" as const };
      }

      // Vérifier si l'annonce est déjà dans les favoris
      const existingFavori = await prisma.favori.findUnique({
        where: {
          userId_annonceId: {
            userId,
            annonceId: data.annonceId,
          },
        },
      });

      if (existingFavori) {
        return { error: "CONFLICT" as const };
      }

      // Créer le favori
      const favori = await prisma.favori.create({
        data: {
          userId,
          annonceId: data.annonceId,
        },
        include: {
          annonce: true,
        },
      });

      return favori;
    },

    // DELETE : Retirer une annonce des favoris
    async deleteFavori(userId: string, annonceId: string) {
      // Vérifier si le favori existe pour cet utilisateur
      const favori = await prisma.favori.findUnique({
        where: {
          userId_annonceId: {
            userId,
            annonceId,
          },
        },
      });

      if (!favori) {
        return { error: "NOT_FOUND" as const };
      }

      // Supprimer le favori
      await prisma.favori.delete({
        where: {
          userId_annonceId: {
            userId,
            annonceId,
          },
        },
      });

      return { success: true };
    },
  };
}
