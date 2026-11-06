import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await authService.login(req.validated);
      
      return res.status(200).json({
        status: 'success',
        message: 'Connexion réussie',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};