import type { PrismaClient } from "../../generated/prisma/client.js";
import { canViewQuestions } from "../questions/question.policy.js";
import { Role } from "../user/user.service.js";
import type { CreateReponseInput } from "./reponse.schema.js";

/** Utilisateur authentifié, tel que fourni par le middleware JWT. */
export type AuthUser = { id: string; role: Role };

export function createReponseService(prisma: PrismaClient) {
  return {
    /**
     * Répond à une question.
     * Règles :
     * - seul un ADMIN ou l'auteur (agent) de l'annonce concernée peut répondre ;
     * - une question n'a qu'une seule réponse (questionId est unique) ;
     * - l'auteur de la réponse est toujours l'utilisateur authentifié.
     * Le Service retourne un résultat métier, le Controller choisit le statut HTTP.
     */
    async createReponse(data: CreateReponseInput, user: AuthUser) {
      const question = await prisma.question.findUnique({
        where: { id: data.questionId },
        select: { annonceId: true },
      });

      if (!question) {
        return { error: "NOT_FOUND" as const };
      }

      const annonce = await prisma.annonce.findUnique({
        where: { id: question.annonceId },
        select: { auteurId: true },
      });

      if (!annonce) {
        return { error: "NOT_FOUND" as const };
      }

      // Protection IDOR : ADMIN ou propriétaire de l'annonce.
      if (user.role !== Role.ADMIN && annonce.auteurId !== user.id) {
        return { error: "FORBIDDEN" as const };
      }

      // Une seule réponse par question.
      const existante = await prisma.reponse.findUnique({
        where: { questionId: data.questionId },
        select: { id: true },
      });

      if (existante) {
        return { error: "CONFLICT" as const };
      }

      try {
        return await prisma.reponse.create({
          data: {
            texte: data.texte,
            questionId: data.questionId,
            auteurId: user.id,
          },
        });
      } catch (error) {
        // Deux réponses simultanées : la contrainte unique de la base tranche.
        if ((error as { code?: string }).code === "P2002") {
          return { error: "CONFLICT" as const };
        }
        throw error;
      }
    },

    /**
     * Récupère la réponse d'une question.
     * Mêmes règles de consultation que les questions (question.policy.ts) :
     * - annonce publiée : accès public ;
     * - brouillon : ADMIN ou agent propriétaire.
     * Retourne null si la question, l'annonce ou la réponse n'existe pas, ou si
     * l'accès est refusé : même erreur 404 pour ne pas révéler l'existence d'un brouillon.
     */
    async getReponseByQuestion(questionId: string, user?: AuthUser) {
      const question = await prisma.question.findUnique({
        where: { id: questionId },
        select: { annonceId: true },
      });

      if (!question) {
        return null;
      }

      const annonce = await prisma.annonce.findUnique({
        where: { id: question.annonceId },
        select: { auteurId: true, statut: true },
      });

      if (!annonce || !canViewQuestions(annonce, user)) {
        return null;
      }

      return prisma.reponse.findUnique({
        where: { questionId },
        include: {
          auteur: { select: { id: true, name: true } },
        },
      });
    },

    /**
     * Supprime une réponse.
     * Seul l'auteur de la réponse ou un ADMIN peut effectuer cette action.
     * Le Service retourne un résultat métier, le Controller choisit le statut HTTP.
     */
    async deleteReponse(reponseId: string, userId: string, userRole: Role) {
      const reponse = await prisma.reponse.findUnique({
        where: { id: reponseId },
      });

      if (!reponse) {
        return { error: "NOT_FOUND" as const };
      }

      // Protection IDOR : auteur de la réponse ou ADMIN.
      if (reponse.auteurId !== userId && userRole !== Role.ADMIN) {
        return { error: "FORBIDDEN" as const };
      }

      await prisma.reponse.delete({
        where: { id: reponseId },
      });

      return { message: "Réponse supprimée avec succès" };
    },
  };
}