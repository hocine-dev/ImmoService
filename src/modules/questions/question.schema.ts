
import { z } from "zod";

/**
 * Validation de POST /questions/create.
 * Le schéma utilise "body" pour être compatible
 * avec le middleware Zod commun du projet.
 */
export const createQuestionSchema = z.object({
  body: z.object({
    texte: z.string()
      .trim()
      .min(1, "Le texte de la question est requis"),

    annonceId: z.string()
      .trim()
      .min(1, "L'identifiant de l'annonce est requis")
  }).strict()
});

/**
 * Type des données de la question après validation.
 */
export type CreateQuestionInput =
  z.infer<typeof createQuestionSchema>["body"];

export const getQuestionsByAnnonceSchema = z.object({
  params: z.object({
    annonceId: z.string().trim().min(1),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});
