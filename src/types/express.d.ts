import { Role } from '../services/user.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
      validated?: any; // Si tu utilises un middleware de validation Zod qui stocke les données ici
    }
  }
}