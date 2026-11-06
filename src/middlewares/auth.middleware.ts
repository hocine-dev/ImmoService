import jwt, { JwtPayload } from "jsonwebtoken";
import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import { AppError, Role } from "../modules/user/user.service.js";


const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("JWT_SECRET doit être défini dans le fichier .env");
}

// Interface pour typer le contenu décodé du token JWT
interface DecodedToken extends JwtPayload {
  id: string;
  role: Role;
}

const authMiddleware = (roles: Role[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError(401, "UNAUTHORIZED", "Token manquant"));
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return next(new AppError(401, "UNAUTHORIZED", "Token manquant"));
    }

    try {
      const decoded = jwt.verify(token, SECRET, {
        algorithms: ["HS256"],
      }) as DecodedToken;

      // Vérification des rôles requis
      if (
        roles.length > 0 &&
        (!decoded.role || !roles.includes(decoded.role))
      ) {
        return next(new AppError(403, "FORBIDDEN", "Accès refusé"));
      }

      // Injection de l'utilisateur authentifié dans req.user
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };
      
      next();
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return next(new AppError(401, "UNAUTHORIZED", "Token expiré"));
      }

      return next(new AppError(401, "UNAUTHORIZED", "Token invalide"));
    }
  };
};

export default authMiddleware;