import { Request, Response, NextFunction } from 'express';
import { createAuthService } from "./auth.service.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { apiError } from '../../shared/api-error.js';

export function createAuthController(prisma: PrismaClient) {
  const authService = createAuthService(prisma);
  return {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.validated);


      /**
       * Authentification :
       * Le Service retourne null lorsque les identifiants
       * sont incorrects. Le Controller renvoie alors HTTP 401
       * en utilisant le format d'erreur commun ImmoService.
       */
      if (result === null) {
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Email ou mot de passe incorrect.")
        );
      }


      return res.status(200).json({
        status: 'success',
        message: 'Connexion réussie',
        data: result,
      });
    } catch (error) {
      /**
     * Gestion des erreurs :
     * On transmet l'exception au middleware global Express.
     * Cela évite de retourner une erreur avec HTTP 200
     * et permet de conserver le contrat commun de l'API.
     */
      next(error);
    }
  },
  };
}
