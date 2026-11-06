import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { Role } from './user.service.js';
import { userController } from './user.controller.js';
import validate from '../../middlewares/validate.middleware.js';
import { createUserSchema, getUserByIdSchema, updateUserSchema } from './user.schema.js';


const router = Router();

// ==========================================
// ROUTES UTILISATEURS
// ==========================================

// GET /api/users - Récupérer tous les utilisateurs (Réservé aux ADMINS et AGENTS)
router.get(
  '/getAll', 
  //authMiddleware([Role.ADMIN, Role.AGENT]), 
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

export default router;