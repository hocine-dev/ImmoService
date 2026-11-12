
import { z } from "zod";

export const createFavoriSchema = z.object({
  body: z.object({
    annonceId: z.string().min(1,"ID annonce invalide"),
  }),
});

export const deleteFavoriSchema = z.object({
  params: z.object({
    annonceId: z.string().min(1,"ID annonce invalide"),
  }),
});
