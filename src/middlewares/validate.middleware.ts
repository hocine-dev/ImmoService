import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../modules/user/user.service.js';

const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  if (!schema) {
    console.error("Erreur middleware : Aucun schéma Zod fourni");
    return next(new AppError( 
      "INTERNAL_ERROR", 
      "Erreur de configuration de la validation sur le serveur"
    ));
  }
  
  const result = schema.safeParse({
    body: req.body ?? {},
    params: req.params ?? {},
    query: req.query ?? {},
  });

  if (!result.success) {
    // Transformation des erreurs Zod en Record<string, string[]> (details)
    const details: Record<string, string[]> = {};

    for (const issue of result.error.issues) {
      // On enlève le premier niveau ("body", "params" ou "query") pour cibler directement le champ
      const field = issue.path.slice(1).join(".") || issue.path.join(".");
      
      if (!details[field]) {
        details[field] = [];
      }
      details[field].push(issue.message);
    }

    // On remonte l'erreur standardisée au middleware global via next()
    return next(new AppError(
 
      "VALIDATION_ERROR", 
      "Données invalides", 
      details
    ));
  }

  // Stockage des données validées
  req.validated = result.data;
  next();
};

export default validate;