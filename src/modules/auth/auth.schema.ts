import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Format d'email invalide"),
    password: z.string().min(1, "Le mot de passe est requis"),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;