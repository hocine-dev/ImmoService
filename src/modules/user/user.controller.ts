import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service.js';

export const userController = {
  // GET : Récupérer tous les utilisateurs
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUserRole = req?.user?.role || "ADMIN" ;  
      const users = await userService.getAllUsers(currentUserRole);
      return res.status(200).json({ 
        success: true, 
        data: users 
      });
    } catch (error) {
      res.json(error);
    }
  },

  // GET : Récupérer un utilisateur par son ID
  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.validated.params;
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role
      const user = await userService.getUserById(id,currentUserId,currentUserRole);
      return res.status(200).json({ 
        success: true, 
        data: user 
      });
    } catch (error) {
      res.json(error);
    }
  },

  // POST : Créer un utilisateur (Inscription)
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const newUser = await userService.createUser(req.validated.body);
      return res.status(201).json({ 
        success: true, 
        message: "Utilisateur créé avec succès", 
        data: newUser 
      });
    } catch (error) {
      res.json(error);
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

      return res.status(200).json({ 
        success: true, 
        message: "Utilisateur mis à jour avec succès", 
        data: updatedUser 
      });
    } catch (error) {
      res.json(error);
    }
  },

  // DELETE : Supprimer un utilisateur (avec IDOR)
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const targetId = req.validated.params.id;
      
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      await userService.deleteUser(targetId, currentUserId, currentUserRole);

      return res.status(200).json({ 
        success: true, 
        message: "Utilisateur supprimé avec succès" 
      });
    } catch (error) {
      res.json(error);
    }
  },
};