import type { PrismaClient } from "../../generated/prisma/client.js";
import { CreateQuestionInput } from "./question.schema.js";
import { canViewQuestions } from "./question.policy.js";
import type { Role } from "../user/user.service.js";


export function createQuestionService(prisma: PrismaClient) {
  return {
  // 1. Créer une question
  async createQuestion(data: CreateQuestionInput & { auteurId: string }) {
    /**
  * Cohérence avec le module annonces :
  * Une question ne peut être créée que sur une annonce publiée.
  * Une annonce en brouillon ou inexistante est considérée
  * comme inaccessible, sans révéler son existence.
  */
    const annonce = await prisma.annonce.findFirst({
      where: {
        id: data.annonceId,
        statut: "PUBLIE"
      }
    });

    if (!annonce) {
      return null;
    }


    const question = await prisma.question.create({
      data: {
        texte: data.texte,
        annonceId: data.annonceId,
        auteurId: data.auteurId,
      },
    });

    return question;
  },

  // 2. Récupérer toutes les questions d'une annonce
  /**
 * Vérifie les droits de consultation des questions.
 * Les règles d'autorisation sont centralisées
 * dans question.policy.ts.
 */
    async getQuestionsByAnnonce(
      annonceId: string,
      user?: { id: string; role: Role },
      page = 1,
      limit = 10
    ) {
      const annonce = await prisma.annonce.findUnique({
        where: { id: annonceId },
        select: { auteurId: true, statut: true }
      });

      if (!annonce || !canViewQuestions(annonce, user)) {
        return null;
      }

      const [total, questions] = await Promise.all([
        prisma.question.count({ where: { annonceId } }),
        prisma.question.findMany({
          where: { annonceId },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            auteur: { select: { id: true, name: true } },
            reponse: true
          },
          orderBy: [
            { createdAt: "desc" },
            { id: "asc" }
          ]
        })
      ]);

      return {
        data: questions,
        pagination: {
          page, limit, total,
          pages: Math.ceil(total / limit)
        }
      };
    },


  /**
   * Supprime une question en vérifiant les droits d'accès.
   * Le Service retourne un résultat métier.
   * Le Controller sera responsable du statut HTTP.
   */
  async deleteQuestion(
    questionId: string,
    userId: string,
    userRole: string
  ) {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    // Question inexistante
    if (!question) {
      return { error: "NOT_FOUND" as const };
    }

    // Protection IDOR : auteur de la question ou ADMIN
    if (question.auteurId !== userId && userRole !== "ADMIN") {
      return { error: "FORBIDDEN" as const };
    }

    await prisma.question.delete({
      where: { id: questionId }
    });

    return { message: "Question supprimée avec succès" };
  }


  };
}
