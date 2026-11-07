import jwt from "jsonwebtoken";
import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import { Role } from "../modules/user/user.service.js";
/**
 * Gestion uniforme des erreurs  :
 * Les erreurs d'authentification et d'autorisation utilisent
 * le même format HTTP que le module.
 * Aucun système AppError parallèle n'est nécessaire.
 */
import { apiError } from "../shared/api-error.js";


/**
 * Sécurité JWT :
 * Le serveur doit obligatoirement utiliser un secret défini dans .env.
 * Une valeur par défaut comme "fallback_secret" est dangereuse :
 * elle permettrait à un attaquant de fabriquer des JWT valides
 * et d'usurper les rôles ADMIN ou AGENT.
 * Si JWT_SECRET est absent, on bloque le démarrage du serveur.
 */
const SECRET = process.env.JWT_SECRET;


if (!SECRET) {
  throw new Error(
    "JWT_SECRET manquant dans les variables d'environnement"
  );
}



const authMiddleware = (roles: Role[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json(
        apiError("UNAUTHORIZED", "Token manquant")
      );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json(
        apiError("UNAUTHORIZED", "Token manquant")
      );
    }

    try {

      /**
       * Sécurité JWT :
       * La vérification de signature ne garantit pas que le contenu
       * du token possède les champs attendus.
       * On contrôle donc l'identifiant et le rôle avant de permettre
       * l'accès aux routes protégées.
       */
      const decoded = jwt.verify(token, SECRET, {
        algorithms: ["HS256"],
      });

      if (
        typeof decoded === "string" ||
        typeof decoded.id !== "string" ||
        decoded.id.trim() === "" ||
        !Object.values(Role).includes(decoded.role as Role)
      ) {
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Token invalide")
        );
      }

      // Vérification des rôles requis
      if (
        roles.length > 0 &&
        (!roles.includes(decoded.role))
      ) {
        return res.status(403).json(
          apiError("FORBIDDEN", "Accès refusé")
        );
      }

      // Injection de l'utilisateur authentifié dans req.user
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Token expiré")
        );
      }

      return res.status(401).json(
        apiError("UNAUTHORIZED", "Token invalide")
      );
    }
  };
};



/**
 * Authentification facultative :
 * - Sans JWT : le visiteur peut continuer sans identité.
 * - Avec JWT : on vérifie obligatoirement le token.
 * - Si le JWT est invalide ou expiré : HTTP 401.
 */
export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.headers.authorization) {
    next();
    return;
  }

  authMiddleware()(req, res, next);
};


export default authMiddleware;