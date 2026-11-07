import { Request, Response, NextFunction } from 'express';
import { createUserService } from './user.service.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { apiError } from '../../shared/api-error.js';

export function createUserController(prisma: PrismaClient) {
  const userService = createUserService(prisma);

  return {
  // GET : Récupérer tous les utilisateurs
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      /**
 * Sécurité :
 * L'identité de l'utilisateur doit provenir du middleware JWT.
 * On vérifie sa présence avant de transmettre son rôle au Service.
 * Aucun rôle privilégié ne doit être attribué par défaut.
 */
      if (!req.user) {
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Authentification requise")
        );
      }

      const currentUserRole = req.user.role;
      const users = await userService.getAllUsers(currentUserRole, req.validated.query.page, req.validated.query.limit);

      // Accès réservé aux administrateurs.
      if (users === null) {
        return res.status(403).json(
          apiError("FORBIDDEN", "Action non autorisée sur ce profil.")
        );
      }
      return res.status(200).json({
        success: true,
        data: users.data,
        pagination: users.pagination
      });
    } catch (error) {
      /**
      * Gestion centralisée des erreurs :
      * On transmet l'exception au middleware global Express
      * pour conserver le bon statut HTTP et le format JSON
      * commun défini dans src/shared/api-error.ts.
      */
      next(error);
    }
  },

  // GET : Récupérer un utilisateur par son ID
  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.validated.params;
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role
      const user = await userService.getUserById(id, currentUserId, currentUserRole, req.validated.query.page, req.validated.query.limit);

      // Convertir le refus métier en réponse HTTP.
      if ("error" in user && user.error !== undefined) {
        const status = user.error === "FORBIDDEN" ? 403 : 404;
        return res.status(status).json(
          apiError(
            user.error,
            status === 403 ? "Accès refusé" : "Utilisateur introuvable"
          )
        );
      }
      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      // Transmettre l'erreur au gestionnaire global Express
      // pour respecter le statut HTTP et le format API commun.
      next(error);
    }
  },

  // POST : Créer un utilisateur (Inscription)
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const newUser = await userService.createUser(req.validated.body);

      /**
       * Conflit métier : l'adresse email existe déjà.
       * Le Controller retourne HTTP 409 avec le contrat commun.
       */
      if ("error" in newUser) {
        return res.status(409).json(
          apiError("CONFLICT", "Cet email est déjà utilisé", newUser.details)
        );
      }

      return res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès",
        data: newUser
      });
    } catch (error) {
      // Transmettre l'erreur au gestionnaire global Express
      // pour respecter le statut HTTP et le format API commun.
      next(error);
    }
  },

  // PUT : Mettre à jour un utilisateur (avec IDOR)
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const targetId = req.validated.params.id;

      // Récupération des infos de l'utilisateur authentifié (provenant du middleware JWT)
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      const updatedUser = await userService.updateUser(
        targetId,
        currentUserId,
        currentUserRole,
        req.validated.body
      );

      // Ne pas retourner 200 si la modification a été refusée.
      if ("error" in updatedUser) {
        const status = updatedUser.error === "FORBIDDEN" ? 403 : 404;
        return res.status(status).json(
          apiError(
            updatedUser.error,
            status === 403 ? "Accès refusé" : "Utilisateur introuvable"
          )
        );
      }

      return res.status(200).json({
        success: true,
        message: "Utilisateur mis à jour avec succès",
        data: updatedUser
      });
    } catch (error) {
      // Transmettre l'erreur au gestionnaire global Express
      // pour respecter le statut HTTP et le format API commun.
      next(error);
    }
  },

  // DELETE : Supprimer un utilisateur (avec IDOR)
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const targetId = req.validated.params.id;

      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      const result = await userService.deleteUser(
        targetId,
        currentUserId,
        currentUserRole
      );

      // Ne pas annoncer une suppression si elle a été refusée.
      if ("error" in result) {
        const status = result.error === "FORBIDDEN" ? 403 : 404;
        return res.status(status).json(
          apiError(
            result.error,
            status === 403 ? "Accès refusé" : "Utilisateur introuvable"
          )
        );
      }

      return res.status(200).json({
        success: true,
        message: "Utilisateur supprimé avec succès"
      });
    } catch (error) {
      // Transmettre l'erreur au gestionnaire global Express
      // pour respecter le statut HTTP et le format API commun.
      next(error);
    }
  },
  };
}
