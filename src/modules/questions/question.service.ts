import { AppError, prisma } from "../user/user.service.js";
import { CreateQuestionInput } from "./question.schema.js";


export const questionService = {
  // 1. Créer une question
  async createQuestion(data: CreateQuestionInput & { auteurId: string }) {
    // Vérifier si l'annonce existe
    const annonce = await prisma.annonce.findUnique({
      where: { id: data.annonceId },
    });

    if (!annonce) {
      throw new AppError("NOT_FOUND", "L'annonce spécifiée n'existe pas.");
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
  async getQuestionsByAnnonce(annonceId: string) {
    return await prisma.question.findMany({
      where: { annonceId },
      include: {
        auteur: {
          select: { id: true, name: true },
        },
        reponse: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // 3. Supprimer une question (avec protection IDOR : auteur ou admin uniquement)
  async deleteQuestion(questionId: string, userId: string, userRole: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new AppError( "NOT_FOUND", "Question introuvable.");
    }

    // Vérification IDOR / Rôle
    if (question.auteurId !== userId && userRole !== 'ADMIN') {
      throw new AppError("FORBIDDEN", "Vous n'avez pas l'autorisation de supprimer cette question.");
    }

    await prisma.question.delete({
      where: { id: questionId },
    });

    return { message: "Question supprimée avec succès" };
  },
};