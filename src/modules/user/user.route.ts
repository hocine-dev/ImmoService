import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { Role } from './user.service.js';
import { createUserController } from "./user.controller.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import validate from '../../middlewares/validate.middleware.js';
import rateLimitMiddleware from '../../middlewares/rateLimit.middleware.js';
import { createUserSchema, getUserByIdSchema, updateUserSchema, getUsersSchema } from './user.schema.js';


export function createUserRouter(prisma: PrismaClient) {
  const router = Router();
  const userController = createUserController(prisma);

// ==========================================
// ROUTES UTILISATEURS
// ==========================================

// GET /api/users - Récupérer tous les utilisateurs (Réservé aux ADMINS uniquement !)

/**
 * Sécurité des utilisateurs :
 * La liste des utilisateurs contient des données personnelles.
 * L'accès nécessite un JWT valide et le rôle ADMIN.
 * Le middleware vérifie l'authentification et l'autorisation
 * avant d'exécuter le Controller.
 */
router.get(
  '/getAll',
  authMiddleware([Role.ADMIN]),
  validate(getUsersSchema),
  userController.getUsers
);


// GET /api/users/:id - Récupérer un utilisateur par son ID (Authentifié requis)
router.get(
  '/:id',
  authMiddleware(),
  validate(getUserByIdSchema),
  userController.getUser
);

// POST /api/users - Inscription / Création d'un utilisateur (Route publique ou admin selon ton besoin)
// router.post(
//   '/', 
//   validate(createUserSchema), 
//   userController.create
// );
router.post(
  '/register',
  rateLimitMiddleware.registerLimiter,
  validate(createUserSchema),
  userController.create
);

// PUT /api/users/:id - Mettre à jour un utilisateur (Authentifié requis + Validation Zod + IDOR géré dans le service)
router.put(
  '/:id',
  authMiddleware(),
  validate(updateUserSchema),
  userController.update
);

// DELETE /api/users/:id - Supprimer un utilisateur (Authentifié requis + IDOR géré dans le service)
router.delete(
  '/:id',
  authMiddleware(),
  validate(getUserByIdSchema),
  userController.remove
);

return router;
}
