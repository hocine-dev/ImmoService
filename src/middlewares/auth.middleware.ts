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

      // 1. Si `decoded` est une chaîne (ex: JWT signé sans objet), le payload est malformé
      if (
        typeof decoded === "string" ||

        // 2. Vérifie que la propriété `id` existe et qu'il s'agit bien d'une chaîne de caractères
        typeof decoded.id !== "string" ||

        // 3. S'assure que l'ID n'est pas vide (évite les espaces seuls comme "   ")
        decoded.id.trim() === "" ||

        // 4. Vérifie que le rôle du token correspond bien à l'un des rôles autorisés dans l'enum `Role`
        !Object.values(Role).includes(decoded.role as Role)
      ) {
        // 5. Si l'une des vérifications échoue, on rejette la requête avec un statut 401 Unauthorized
        return res.status(401).json(
          apiError("UNAUTHORIZED", "Token invalide")
        );
      }

      // 1. Si des rôles spécifiques sont requis pour cette route (`roles.length > 0`)
      //    ET que le rôle de l'utilisateur (`decoded.role`) ne fait PAS partie de cette liste
      if (
        roles.length > 0 &&
        (!roles.includes(decoded.role))
      ) {
        // 2. L'utilisateur est authentifié mais n'a pas les privilèges nécessaires :
        //    On rejette la requête avec un statut 403 Forbidden et le message "Accès refusé"
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