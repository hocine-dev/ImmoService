import { z } from "zod";

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const getUsersSchema = z.object({
  query: paginationQuery,
});


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
  query: paginationQuery,
  params: z.object({
    id: z.string().cuid("ID utilisateur invalide"),
  }),
});