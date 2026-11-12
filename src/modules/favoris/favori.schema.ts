
import { z } from "zod";

export const createFavoriSchema = z.object({
  body: z.object({
    annonceId: z.string().cuid("ID annonce invalide"),
  }),
});

export const deleteFavoriSchema = z.object({
  params: z.object({
    annonceId: z.string().cuid("ID annonce invalide"),
  }),
});
