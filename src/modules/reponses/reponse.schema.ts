import { z } from "zod";

/**
 * POST /reponses/create
 * L'auteur de la réponse vient du JWT, jamais du body :
 * les champs inconnus sont donc refusés (.strict()).
 */
export const createReponseSchema = z.object({
  body: z
    .object({
      texte: z.string().trim().min(1, "Le texte de la réponse est obligatoire"),
      questionId: z.string().cuid("ID question invalide"),
    })
    .strict(),
});

/** GET /reponses/question/:questionId */
export const getReponseByQuestionSchema = z.object({
  params: z.object({
    questionId: z.string().cuid("ID question invalide"),
  }),
});

/** DELETE /reponses/:id */
export const deleteReponseSchema = z.object({
  params: z.object({
    id: z.string().cuid("ID réponse invalide"),
  }),
});

export type CreateReponseInput = z.infer<typeof createReponseSchema>["body"];