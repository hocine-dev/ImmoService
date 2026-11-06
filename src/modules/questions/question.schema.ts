import { z } from 'zod';

export const createQuestionSchema = z.object({
  texte: z.string().min(1, "Le texte de la question est requis"),
  annonceId: z.string().cuid("ID d'annonce invalide"),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;