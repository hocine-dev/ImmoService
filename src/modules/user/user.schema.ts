import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
    email: z.string().email("Format d'email invalide"),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    role: z.enum(["USER", "AGENT", "ADMIN"]).optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(["USER", "AGENT", "ADMIN"]).optional(),
  }),
  params: z.object({
    id: z.string().cuid("ID utilisateur invalide"),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().cuid("ID utilisateur invalide"),
  }),
});